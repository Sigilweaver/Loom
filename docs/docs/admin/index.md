---
sidebar_position: 1
title: Administrator Guide
sidebar_label: Overview
---

# Administrator Guide

Hub is the optional team platform for Sigilweaver Loom. It centralizes users, roles, database credentials, Servers, schedules and an audit log. This guide is for the people who deploy and run it.

:::note Open beta
Hub is in open beta. Read [Hub Open Beta](./hub-beta.md) before you rely on it, especially the limits on restarts and replicas.
:::

## What Hub does

- **Users and roles.** Four [roles](./roles.md): Owner, Admin, Auditor and User.
- **Shared connections.** [Connections](./connections.md) keep database credentials in Hub, encrypted. Users can use a connection without ever seeing its password.
- **Access control.** [Users](./users.md) join [user groups](./groups.md). Groups are granted [grant groups](./grant-groups.md). Grant groups contain connections.
- **Execution.** [Servers](./servers.md) run workflows. Hub tracks their health and sends work to them.
- **Scheduling and history.** Users upload workflows, run them and schedule them in the Hub web app.
- **Audit log.** Hub records security-relevant events in a hash-chained log that auditors can verify.

## The permission chain

```
Users -> User Groups -> Grant Groups -> Connections
```

A user can reach a connection only if every link exists. That gives you a single path to check when you ask why someone has access.

## Set up a Hub

1. **[Deploy](./deployment.md)** Hub, PostgreSQL and at least one Server with Docker Compose.
2. **Claim the Owner account.** The first person to register on a fresh Hub becomes the Owner. Do this right after the first start, before you expose Hub to others.
3. **Register a Server**, or configure it to [register itself](./servers.md).
4. **Create connections** in **Admin > Connections**.
5. **Create grant groups** that bundle connections by purpose, such as "Production databases".
6. **Create user groups** for your teams and assign grant groups to them.
7. **Create users** and add them to groups.

## Reference

| Page                                           | What is in it                                   |
| ---------------------------------------------- | ----------------------------------------------- |
| [Deployment Guide](./deployment.md)            | Docker Compose, secrets, HTTPS, remote Servers, updates |
| [Server Configuration](./server-configuration.md) | Every Server environment variable            |
| [Hub Configuration](./hub-configuration.md)    | Every Hub environment variable                  |
| [Hub Open Beta](./hub-beta.md)                 | Current limitations                             |
| [Security Model](./security.md)                | How credentials, tokens and roles work          |
