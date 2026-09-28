---
sidebar_position: 7
title: Managing Connections
---

# Managing Connections

A **connection** tells Loom how to reach a database. Workflows store only a connection ID, so credentials never appear in a `.swwf` file.

## Kinds of connections

| Kind       | Where credentials live                                | Who manages it   | Can you see the password? |
| ---------- | ----------------------------------------------------- | ---------------- | ------------------------- |
| **Client** | Your machine, in the operating system's credential store | You           | You typed it, but Studio never shows it again |
| **Hub**    | Hub, encrypted                                        | A Hub administrator | No                     |

Client connections need the desktop app. The browser build cannot store them. Hub connections appear when you are [logged in to Hub](./hub.md) and belong to a group that has been granted them.

## Open the Connection Manager

Open the **Settings** tab in the left pane and expand **Connections**. In Hub mode with an active login, Hub connections are listed first, then your local ones.

## Create a client connection

1. Click **Add Connection**.
2. Fill in the form:
   - **Connection Name**: any label you will recognize.
   - **Database Type**: PostgreSQL, MySQL or SQL Server. The port fills in with the default (5432, 3306 or 1433).
   - **Host**, **Port** and **Database**.
   - **Username** and **Password**.
3. Save.

SQLite does not use a connection. Choose the SQLite source in a Read tool and pick the database file. See [Read (Input)](../tools/input-output/input.md).

## Edit or delete a connection

Use the pencil or trash icon next to a connection. When you edit, leave **Username** and **Password** blank to keep the stored values. You cannot change a connection's type after you create it. You cannot edit or delete Hub connections.

Deleting a connection breaks workflows that use it. Check before you delete.

## Use a connection in a workflow

1. Add a **Read** tool.
2. Choose a database source: PostgreSQL, MySQL or SQL Server.
3. Pick a connection from the list. Hub connections are marked `[Hub]` and yours `[Local]`. Choose **Configure new connection** to jump to Settings.
4. Write a SQL query. Loom rejects queries that contain write or DDL keywords such as `INSERT`, `UPDATE`, `DELETE`, `DROP` or `CREATE`. This is a safety net, not a guarantee, so give the database user read-only permissions.

The query runs when you preview or run the workflow, not while you type. Results from database sources are cached on the Server so repeated previews do not query the database again. See [Performance and Caching](./caching.md).

## How credentials are handled

- Workflow files store connection IDs only.
- The JSON view and the exported Python code do not contain credentials. Exported code uses placeholders.
- **Client connection credentials are sent to the Server** when you run or preview a workflow, because the Server opens the database connection. Use HTTPS if the Server is not on your own machine.
- **Hub connection credentials stay on Hub.** The Server asks Hub for them only for the duration of the request. You never receive them. Prefer Hub connections for production databases and shared work.

See the [Security Model](../../admin/security.md) for how Hub protects credentials.

## Sharing workflows

| Situation                          | What happens                                                         |
| ---------------------------------- | -------------------------------------------------------------------- |
| Same machine                       | Client connections work as they are.                                 |
| Another machine                    | The other person needs a connection with the same ID, or a Hub connection. |
| Hub connections                    | Work for anyone who has been granted the connection.                 |

For team workflows, use Hub connections.

## Troubleshooting

**Connection not found.** The workflow references an ID that does not exist on this machine. Recreate the connection, or select another one in the Read tool.

**Client credential storage not available.** You are using the browser build, or the operating system's credential store is unavailable. Use the desktop app, or use a Hub connection.

**Failed to connect.** Check that the database is running, the host and port are right, the user may connect from your Server's address, and no firewall blocks the port. Remember that the Server opens the connection, so the Server must be able to reach the database.

**Hub connections do not appear.** Confirm you are in Hub mode and logged in. Then ask your administrator whether you belong to a group that has been granted the connection. See [User Groups](../../admin/groups.md).
