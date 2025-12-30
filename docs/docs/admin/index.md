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

[Hub connections](./connections) let you provide database access to teams without sharing passwords. Create a connection once, assign it to groups, and users can execute workflows against it - without ever seeing the host, username, or password.

## User and Group Management

Organize users into [groups](./groups) that control which connections they can access. Add users to multiple groups as needed. When someone leaves a team, remove them from the group and they immediately lose access.

- [User Management](./users) - Create accounts, assign roles
- [Groups](./groups) - Control connection access

## Execution Infrastructure

[Servers](./servers) are stateless executors that register with Hub automatically. Hub tracks server health, dispatches workflows, and handles failover. Add more servers to scale execution capacity.

## Getting Started

1. **First login** - The first user to register becomes Owner
2. **Create groups** - Organize users by team or access level
3. **Set up connections** - Add database connections and assign to groups
4. **Create user accounts** - Add users and assign to groups

Servers register automatically when configured with `HUB_URL`.
