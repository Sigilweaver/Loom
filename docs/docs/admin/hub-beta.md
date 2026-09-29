---
sidebar_position: 5
title: Hub Open Beta
---

# Hub Open Beta

Hub is in open beta. It works, it has tests, and teams can use it. It also has known limits that you should plan around. This page lists them so you can decide whether Hub fits your situation today.

## Run one Hub

Hub is designed to run as a **single process**. Several parts of it live in memory:

| Part                     | What lives in the Hub process                                                          | Effect with more than one replica                              |
| ------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Scheduler**            | An in-process scheduler loads every enabled schedule from the database at startup.     | Each replica fires every schedule, so runs happen more than once. |
| **Live updates**         | Execution status events pass through an in-memory broker.                              | A browser sees only events from the replica it is connected to.  |
| **Server tokens**        | By default, issued tokens are kept in memory (`TOKEN_STORE_BACKEND=memory`).           | A token issued by one replica is unknown to the others.       |

`TOKEN_STORE_BACKEND=postgres` removes the last problem. The other two remain, so do not run several Hub replicas yet.

## Executions are not durable

When a user clicks **Run Now** or a schedule fires, Hub records an execution and then runs it as a background task inside the Hub process. The task makes one HTTP request to the Server and waits for the answer.

What that means in practice:

- **A Hub restart loses in-flight work.** Hub does not reconcile executions at startup. An execution that was queued or running when Hub stopped stays in that state.
- **There is a time limit.** Hub waits for a Server's answer for ten times `SERVER_TIMEOUT_SECONDS`, which is 100 seconds by default. A longer workflow is marked failed in Hub with "Execution timeout". The Server may still finish it.
- **Cancel is bookkeeping.** **Cancel** marks the execution as cancelled in Hub. It does not stop the work on the Server.
- **There is no retry.** A failed scheduled run waits for the next scheduled time.

For long-running work, keep workflows short, or run them from Studio in External or Hub mode, where Studio holds the connection.

## Server selection is simple

When a user or a schedule does not name a Server, Hub picks an online Server. The selection is not load-aware. In practice it is the first online Server by name. Pin a Server explicitly for a schedule if it matters.

## Runs started by Hub use a system identity

A run started with **Run Now** or by a schedule is made by a Hub system identity, not by the user who clicked. That identity has no connection grants. Workflows that read from Hub-managed database connections therefore do not run this way today. Workflows that read files the Server can reach are fine. Runs that a user starts from Studio in Hub mode use the user's own grants.

## Some features exist only in the API

These work, but have no screen in the web app yet:

- Workflow **revision history**, with diff and rollback
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
