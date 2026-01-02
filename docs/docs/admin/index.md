---
sidebar_position: 1
---

# Administrator Guide

Hub is the orchestration platform for Sigilweaver, built for teams and enterprises that need centralized control over workflows, credentials, and user access.

## Security First

Hub implements a [zero-trust security model](./security) where **users never see database credentials**. Credentials are encrypted at rest, decrypted only during execution, and flow directly from Hub to Server - never to users. Single-use, workflow-bound tokens prevent replay attacks and credential theft.

## Role-Based Access Control

Hub enforces strict [separation between administrators and users](./roles). Admins manage infrastructure (users, groups, connections, servers) but cannot execute workflows. Users build and run workflows but cannot access administrative functions. This separation provides clear audit trails and supports compliance requirements.

## Centralized Credential Management

[Hub connections](./connections) let you provide database access to teams without sharing passwords. Create a connection once, assign it to [grant groups](./grant-groups), and users can execute workflows against it - without ever seeing the host, username, or password.

## Permission Hierarchy

Hub uses a three-level permission hierarchy for clear audit trails:

```
Users → User Groups → Grant Groups → Connections
```

- [User Management](./users) - Create accounts, assign roles
- [User Groups](./groups) - Organize users into teams
- [Grant Groups](./grant-groups) - Reusable permission bundles
- [Connections](./connections) - Database credentials

This design ensures a single audit path from any user to any connection they can access.

## Execution Infrastructure

[Servers](./servers) are stateless executors that register with Hub automatically. Hub tracks server health, dispatches workflows, and handles failover. Add more servers to scale execution capacity.

## Getting Started

1. **First login** - The first user to register becomes Owner
2. **Create connections** - Add database connections
3. **Create grant groups** - Bundle connections by purpose (e.g., "Production DBs")
4. **Create user groups** - Organize users by team
5. **Assign grant groups to user groups** - Grant access to connections
6. **Create user accounts** - Add users and assign to groups

Servers register automatically when configured with `HUB_URL`.
