---
sidebar_position: 6
title: Roles and Permissions
---

# Roles and Permissions

Hub has four roles. Administration and operation are kept apart on purpose.

| Role        | Who                                                                       |
| ----------- | ------------------------------------------------------------------------- |
| **Owner**   | The first account registered on a fresh Hub. There is exactly one.        |
| **Admin**   | Manages infrastructure and people. Assigned by the Owner.                 |
| **Auditor** | Read-only access to everything, including the audit log.                  |
| **User**    | Builds, runs and schedules workflows. The default role.                   |

## Permission matrix

**C**reate, **R**ead, **U**pdate, **D**elete. A dash means no access.

| Resource         | Owner    | Admin    | Auditor | User               |
| ---------------- | -------- | -------- | ------- | ------------------ |
| Users            | CRUD     | CRUD (see below) | R | -                  |
| User groups      | CRUD     | CRUD     | R       | R (own groups)     |
| Grant groups     | CRUD     | CRUD     | R       | -                  |
| Connections      | CRUD     | CRUD     | R       | R (granted ones)   |
| Servers          | CRUD     | CRUD     | R       | R (via own groups) |
| Workflows        | R, D (all) | R, D (all) | R     | CRUD (own)         |
| Schedules        | R, D (all) | R, D (all) | R     | CRUD (own)         |
| Executions       | R        | R        | R       | Create and read (own) |
| Audit log        | R        | R        | R       | -                  |

Key points:

- Owners and Admins can delete any workflow or schedule but cannot create, edit or run them.
- **Only the User role can start executions.** Owners, Admins and Auditors cannot.
- Users see only the workflows, schedules and executions they created.
- Auditors have read access to everything but cannot delete anything.

## Who can manage whom

| Actor     | Can create, edit and delete                 | Can assign the roles           |
| --------- | ------------------------------------------- | ------------------------------ |
| **Owner** | Any other user                              | Admin, Auditor, User           |
| **Admin** | Auditors and Users only                     | Auditor, User                  |

Nobody can assign the Owner role, edit the Owner or delete the Owner. You cannot edit or delete your own account from the user list. Change your own name and password from the profile menu instead.

## Why administrators cannot run workflows

Administrators manage infrastructure and users operate it. Keeping the roles apart gives you:

- **Clear audit trails.** Administrative actions and operational use are different events.
- **Least privilege.** An administrator does not need to run workflows to do the job.
- **Clean role boundaries** for reviews and compliance.

If someone needs both, give them two accounts.

## Group membership

Only accounts with the **User** role can be members of user groups. Owners, Admins and Auditors already see every resource, and groups exist to control what Users can reach.

## What decides who can use a Server

Users see the Servers assigned to their groups. When a user or schedule does not name a Server, Hub chooses one automatically from the Servers that are online. The group assignment controls what appears in a user's list, not which Server Hub picks. See [Server Management](./servers.md).
