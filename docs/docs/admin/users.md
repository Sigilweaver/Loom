---
sidebar_position: 7
title: User Management
---

# User Management

Manage accounts from **Admin > Users**. You need the Owner or Admin role.

## Create a user

Click **Create User** and fill in:

- **Username**: 3 to 255 characters, unique.
- **Password**: 8 to 128 characters.
- **Role**: see [Roles and Permissions](./roles.md). New accounts default to User.

Hub has no self-service sign-up. After the first account, only an Owner or Admin can create accounts.

## Edit a user

Click the edit icon to change the username, password or role.

:::warning Role changes
Changing a User to an Admin or Auditor removes their access to the user area (workflows, schedules and executions they created). The data stays in Hub, but they can no longer open it. Consider giving the person a second account instead.
:::

Admins can manage Auditors and Users. Only the Owner can manage Admins.

## Delete a user

Click the delete icon and confirm. When a user is deleted:

- Their sessions end and their group memberships are removed.
- Their workflows, schedules and executions stay in the database.

You cannot delete the Owner or your own account.

## The Owner account

The first account registered on a fresh Hub is the Owner. It cannot be deleted and its role cannot change. Its password can be changed by the Owner from the profile menu.

Register the Owner account right after the first start, before other people can reach Hub.

## Your own account

Every user can change their own username and password from the profile menu in the web app. It asks for the current password.

There is no password reset by email. If someone forgets a password, an Owner or Admin sets a new one.
