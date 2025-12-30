---
sidebar_position: 3
---

# User Management

Manage user accounts from **Admin > Users**. Requires Owner or Admin role.

## Creating Users

Click **Create User** and fill in:

- **Username** - Must be unique
- **Password** - Minimum 8 characters
- **Role** - See [Roles and Permissions](./roles)

## Editing Users

Click the edit icon to change username, password, or role.

:::warning Role Changes
Changing a user from User to Admin/Auditor removes their access to the user area (workflows, schedules, executions they created). The data is preserved but they cannot access it. Consider creating a separate admin account instead.
:::

## Deleting Users

Click the delete icon and confirm. When a user is deleted:

- Workflows, schedules, and executions remain in the database
- Group memberships are removed
- The Owner account cannot be deleted

## The Owner Account

The first user to register becomes Owner. This account:

- Cannot be deleted
- Cannot have its role changed
- Has full administrative access
