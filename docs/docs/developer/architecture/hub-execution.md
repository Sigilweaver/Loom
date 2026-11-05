---
sidebar_position: 6
title: Hub Execution Dispatch
description: How Hub queues, claims, runs and recovers workflow executions and schedule occurrences
---

# Hub Execution Dispatch

Hub keeps executions and schedule occurrences in PostgreSQL, and every Hub process takes part in running them. No process is a leader. A process can stop at any point and the others carry on. One process on its own uses exactly the same code.

The code is in `hub/backend/app/domain/executions/dispatcher.py` (executions) and `hub/backend/app/domain/schedules/scheduler.py` (schedule occurrences).

## Goals

- Queued work survives a Hub restart.
- An execution is sent to a Server at most once, by one process.
- A schedule occurrence creates at most one execution, across all processes.
- Work owned by a process that stopped is recovered after a bounded time.
- Shutdown is predictable.

## State model

An execution row is both the record users see and the queue entry.

| Status | Meaning | Lease (`claim_token`) |
| ------ | ------- | --------------------- |
| `queued`, no claim | Waiting for a process | none |
| `queued`, claimed | A process is preparing it: loading the workflow, resolving the user, issuing a capability token | held |
| `running` | The request has been, or is being, sent to the Server | held |
| `completed`, `failed`, `cancelled` | Terminal | ignored |

Columns used by dispatch:

| Column | Use |
| ------ | --- |
| `claim_token` | A new random UUID on every claim. Every later write by the runner is conditional on it (a fencing token) |
| `claimed_by` | Host, process ID and a random suffix of the claiming process. For operators only; nothing depends on it |
| `heartbeat_at` | Lease renewal time, set from the database clock |
| `attempts` | Number of claims |
| `scheduled_for` | The cron occurrence a scheduled execution was created for |

All lease times come from the database clock (`now()`), so processes with skewed clocks agree on when a lease has expired.

## Claiming executions

`trigger_execution` commits a `queued` row and wakes the local dispatcher. Each process also polls once a second, so work queued by another process starts within about a second.

A claim is one statement:

```sql
WITH candidates AS MATERIALIZED (
  SELECT id FROM executions
  WHERE status = 'queued'
    AND (claim_token IS NULL
         OR (heartbeat_at < now() - :stale AND attempts < :max_attempts))
  ORDER BY queued_at
  LIMIT :free_slots
  FOR UPDATE SKIP LOCKED)
UPDATE executions
SET claim_token = gen_random_uuid(), claimed_by = :me,
    heartbeat_at = now(), attempts = attempts + 1
FROM candidates WHERE executions.id = candidates.id
RETURNING id, claim_token, attempts;
```

`SKIP LOCKED` lets concurrent claimers take disjoint rows without waiting on each other. The CTE is `MATERIALIZED` so the locked candidate set is computed once and a claim never takes more than its free slots. A process claims no more than its free slots (`EXECUTION_MAX_CONCURRENT`). The partial index `ix_executions_active` covers the queued and running rows the claim and the sweep read.

## Running

The runner owns a claim, not a row. While it runs:

1. A heartbeat task refreshes `heartbeat_at` every 15 seconds with `UPDATE ... WHERE id = :id AND claim_token = :token AND status IN ('queued', 'running')`. If that matches no row, the run was cancelled or recovered elsewhere, and the runner stops waiting for the Server.
2. The runner prepares the run. A deterministic failure, such as a missing workflow file, a deleted user or a failed token issue, marks the execution failed.
3. `queued` becomes `running` with a conditional update on the token. If it matches nothing, the runner sends nothing.
4. The runner sends the request to the Server and waits for the answer or for the lease to be lost.
5. It writes the terminal state with a conditional update on the token and an active status. A result that arrives after the run was cancelled or recovered is discarded and logged.
6. It stores outputs as artifacts. A storage failure is logged and does not fail the execution.

## Recovery and retries

Each process runs a sweep at startup and every 30 seconds. The sweep is made of conditional `UPDATE`s, so several processes can sweep at once.

| Situation | Result |
| --------- | ------ |
| `queued`, claimed, lease older than `EXECUTION_STALE_SECONDS`, attempts left | Claimable again by any process; nothing was sent to a Server |
| `queued`, claimed, lease expired, `attempts >= EXECUTION_MAX_ATTEMPTS` | `failed`: "Not started: the Hub lost this run N time(s) before it was sent to the Server." |
| `running`, lease expired | `failed`: "Interrupted: ... outcome on the Server is unknown." |
| `queued`, never claimed | Left alone; it waits for a process |

A run is retried automatically only if it never reached the Server. Once a request may have been sent, its outcome is unknown and workflows can write data, so Hub records the run as interrupted and does not run it again. A user or the next schedule occurrence starts a new run.

A process that was only cut off from the database cannot cause a duplicate. When it reconnects, its token no longer matches, so its writes and its start transition do nothing.

## Cancellation

**Cancel** sets the status to `cancelled` from any process. An unclaimed run is never claimed. A preparing run fails its start transition. The heartbeat of a running run sees the change within 15 seconds, and the runner stops waiting for the Server. The Server has no cancel endpoint, so work already sent keeps running there; its result is discarded.

## Shutdown

On shutdown a process stops the scheduler, stops claiming, and then:

- Runs that are still preparing are released: the claim is cleared and the attempt refunded, so another process can claim them at once.
- Running executions get `EXECUTION_SHUTDOWN_GRACE_SECONDS` to finish. Any still running afterwards are marked interrupted.

If the process is killed instead, the sweep on another process (or on the restarted one) recovers its runs after `EXECUTION_STALE_SECONDS`. Set the container stop timeout above the grace period.

## Schedule occurrences

Every process polls once a second for enabled schedules whose `next_trigger_at` is due by the database clock. For each one it:

1. Locks the schedule row with `FOR UPDATE SKIP LOCKED`. If another process holds the lock, it moves on.
2. Advances `next_trigger_at` and inserts the `queued` execution with `scheduled_for` set to the occurrence, in the same transaction.
3. Commits. A dispatcher runs the execution like any other.

The partial unique index `uq_executions_schedule_occurrence` on `(schedule_id, scheduled_for)` makes "at most one execution per occurrence" a database guarantee rather than only a property of the locking. If an occurrence already has an execution (for example after `next_trigger_at` was restored from a backup), the scheduler skips to the next occurrence.

If the execution cannot be created, for example because no Server is online, nothing is committed and the occurrence stays due. It is retried on every poll and logged once per occurrence. Missed occurrences are coalesced: after an outage, a schedule runs once, not once per missed interval.

## Observability

- Logs: claims (execution, attempt, process), lease loss, releases, interruptions and every sweep that fails rows, with execution IDs.
- The `claimed_by`, `attempts` and `heartbeat_at` columns show who owns a run and when it was last seen.
- Error messages on failed executions say whether the run reached the Server.

## Multi-process topology

Executions and schedules are safe with any number of Hub processes against one PostgreSQL database. Two other parts need configuration or still assume one process:

- Capability tokens must be shared: set `TOKEN_STORE_BACKEND=postgres`. A Server presents the token to whichever process the load balancer picks.
- Live execution events use an in-process broker. A browser connected to one process does not see events for runs dispatched by another; it sees the current state when it reloads.

## Settings

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `EXECUTION_STALE_SECONDS` | `120` | Lease length; at least 30 |
| `EXECUTION_MAX_CONCURRENT` | `32` | Runs one process executes at a time |
| `EXECUTION_MAX_ATTEMPTS` | `3` | Claims before a run that never reached a Server is failed |
| `EXECUTION_SHUTDOWN_GRACE_SECONDS` | `5` | Time running executions get to finish on shutdown |

## Tests

`hub/backend/tests/test_executions/test_durability.py` runs several dispatcher instances against the test database, each standing in for one Hub process. The tests cover a restart with queued work, concurrent claims, exactly-once execution across three replicas, lease loss while preparing and while running, the attempt cap, cancellation, shutdown and the `010` migration. `tests/test_schedules/test_scheduler.py` runs competing schedulers and dispatchers and checks that an occurrence produces one execution and one Server request.
