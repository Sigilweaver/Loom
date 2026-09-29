---
sidebar_position: 10
title: Hub Connections
---

# Hub Connections

A Hub connection stores a database login or a folder path in Hub, encrypted. Users can use it in workflows without seeing the credentials.

## Kinds of connection

| Type           | What it holds                                                | What users do with it                               |
| -------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| **Database**   | Type (PostgreSQL, MySQL, SQLite or SQL Server), host, port, database, username, password | Pick it in a Read tool and run a query |
| **Filesystem** | A path on the Server, either a local path or a UNC path      | Browse and read files in that folder, and write to it unless it is read-only |

Both kinds can be marked **read-only** and can carry a description.

## Client and Hub connections

| | Client connections | Hub connections |
|---|---|---|
| Stored | The user's machine | Hub, encrypted |
| Managed by | The individual user | An administrator |
| Credentials visible to | The user | Nobody after they are saved |
| Use for | Personal and development databases | Team and production databases |

## Create a connection

Open **Admin > Connections** and click **Create Connection**.

1. Choose the type, **Database** or **Filesystem**.
2. Enter a name and an optional description.
3. Fill in the details. For a database: type, host, port, database name, username and password. For SQLite, the database name is the file path, and it must be allowed by the Server's file access rules or your file grants. For a filesystem: the path and whether it is a local or UNC path.
4. Turn on **Read only** if users should not write through this connection.
5. Use **Test Connection** to check it, then save.

Credentials are encrypted before they are stored, using the key in `CONNECTION_ENCRYPTION_KEY`. See [Hub Configuration](./hub-configuration.md).

## Health

Hub tests every connection in the background, about once an hour, and shows a status: healthy, unhealthy, error or unknown. **Check** a single connection, or check all of them, from the connections page.

## Give users access

A connection is invisible to users until it is in a grant group that a user group holds.

1. Open **Admin > Grant Groups**, create or open a grant group and add the connection.
2. Open **Admin > User Groups**, open a group and assign the grant group.

Members of that user group can now use the connection. See [Grant Groups](./grant-groups.md).

## What users see

Users see the connection's name, type and health. They do not see the host, port, database, username or password.

Studio's **Remote** file browser lists the folders a user has been granted, and the files inside them.

## Query safety

When a user previews or runs a database query, the Server rejects queries that contain write or DDL keywords such as `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE` and `TRUNCATE`. Treat this as a safety net. **Create the database login with read-only permissions**, because a keyword filter is not a substitute for database permissions.

## Rotating credentials

Edit the connection and enter the new username and password. Leave the fields blank to keep the current values. Users need to do nothing.

## Deleting a connection

Deleting removes it from every grant group. Workflows that reference it stop working until they use another connection.
