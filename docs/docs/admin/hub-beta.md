---
sidebar_position: 5
title: Hub Open Beta
---

# Hub Open Beta

Hub is in open beta. It works, it has tests, and teams can use it. It also has known limits that you should plan around. This page lists them so you can decide whether Hub fits your situation today.

## Run one Hub

Run Hub as a **single process**. Scheduled occurrences are coordinated through PostgreSQL, but live updates and the default token store still live in memory:

| Part                     | What lives in the Hub process                                                          | Effect with more than one replica                              |
| ------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Scheduler**            | Each process polls persisted next occurrences once per second and claims a due schedule under a row lock. | Competing dispatchers create at most one execution per claimed occurrence. |
| **Live updates**         | Execution status events pass through an in-memory broker.                              | A browser sees only events from the replica it is connected to.  |
| **Server tokens**        | By default, issued tokens are kept in memory (`TOKEN_STORE_BACKEND=memory`).           | A token issued by one replica is unknown to the others.       |

`TOKEN_STORE_BACKEND=postgres` shares tokens between processes. Live updates still need a shared broker before several Hub replicas are supported. Schedule edits are read from the database; a replacement process can dispatch an overdue occurrence. Missed cron intervals are coalesced into one attempt rather than replayed individually. Schedules use five cron fields: minute, hour, day, month and weekday. Weekday 0 or 7 means Sunday and 1 means Monday; symbolic days, lists, ranges and steps are supported. Invalid cron expressions and timezones are rejected on create and update. When upgrading from the older weekday mapping, edit and save weekly schedules to recalculate any already-persisted next occurrence.

## Execution recovery has limits

When a user clicks **Run Now** or a schedule fires, Hub records an execution and then runs it as a background task inside the Hub process. The task makes one HTTP request to the Server and waits for the answer.

What that means in practice:

- **A Hub restart interrupts its runner.** Execution records survive in PostgreSQL. A sweep at startup and every 60 seconds marks queued or running records failed when their last heartbeat is older than `EXECUTION_STALE_SECONDS` (120 seconds by default). Runners refresh that heartbeat every 15 seconds. The failure message says the outcome on the Server is unknown; Hub does not resume the run.
- **There is a time limit.** Hub waits for a Server's answer for ten times `SERVER_TIMEOUT_SECONDS`, which is 100 seconds by default. A longer workflow is marked failed in Hub with "Execution timeout". The Server may still finish it.
- **Cancel is bookkeeping.** **Cancel** marks the execution as cancelled in Hub. It does not stop the work on the Server.
- **Executions are not retried.** Once an execution record is committed, a failed run waits for the next scheduled occurrence. An attempt that fails before the execution and occurrence claim commit is retried on a later scheduler poll.

For long-running work, keep workflows short, or run them from Studio in External or Hub mode, where Studio holds the connection.

## Server selection

When a user or a schedule does not name a Server, Hub picks an online Server. Hub picks the least-loaded one, meaning the Server with the fewest queued or running executions. Ties are broken at random. Pin a Server explicitly for a schedule if a specific one matters.

## Who a Hub run belongs to

A run started with **Run Now** runs as the user who clicked. A scheduled run runs as the user who created the schedule. Either way, the run uses that user's own connection and file grants, so workflows that read from Hub-managed database connections work.

## Some features exist only in the API

These work, but have no screen in the web app yet:

- Execution **artifacts**: outputs stored by Hub as CSV and downloadable per execution
- Execution logs, code, plans and connection records for auditors (`/api/v1/executions/{id}/...`)

Use the interactive API documentation at `/docs` on your Hub to call them.

## Not built yet

- **Settings page.** **Admin > Settings** is a placeholder.
- **Single sign-on.** Accounts are local usernames and passwords.
- **Per-user API tokens.** Automation has to use a user login.
- **Notifications** by email or webhook.
- **Password reset by email.** An Owner or Admin resets passwords.

## Small print about the audit log

Hub records events in a hash-chained log. **Admin > Audit Log** browses it and can verify the chain for the most recent events. Verification detects edits inside the recorded range. It does not, on its own, protect the database from someone who can rewrite the whole chain.

## Practical advice

- Back up PostgreSQL and the workflow volume before every upgrade.
- Monitor Server health in **Admin > Servers** and expect brief blips. A Server is marked Offline only after three failed checks in a row.
- Put Hub behind HTTPS. See the [Deployment Guide](./deployment.md).
- Report anything surprising on [GitHub](https://github.com/Sigilweaver/Loom/issues).

The [Roadmap](../roadmap.md) lists where these gaps sit in the plan.
