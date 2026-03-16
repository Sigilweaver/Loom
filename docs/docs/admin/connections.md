---
sidebar_position: 6
---

# Hub Connections

Hub connections are database credentials managed centrally and shared with users through groups. Users can execute workflows using these connections without seeing the credentials.

## Client vs Hub Connections

| | Client Connections | Hub Connections |
|---|---|---|
| Stored | User's machine | Hub (encrypted) |
| Managed by | Individual user | Administrator |
| Credentials visible to | User | Nobody (zero-trust) |
| Use case | Personal/development | Team/production |

## Creating Connections

From **Admin > Connections**:

1. Click **Create Connection**
2. Enter connection details (name, type, host, port, database, username, password)
3. Click **Test Connection** to verify
4. Click **Save**

Credentials are encrypted before storage. The encryption key is stored separately in `CONNECTION_ENCRYPTION_KEY` environment variable.

## Assigning to Grant Groups

A connection is not accessible to users until assigned to a grant group that is linked to a user group:

1. Go to **Admin > Grant Groups**
2. Create or select a grant group
3. In the **Connections** section, click **Add Connection**
4. Select the connection to add
5. Go to **Admin > User Groups**, select a user group
6. Go to the **Grant Groups** tab and assign the grant group

Users in that user group can now use the connection in workflows.

## What Users See

Users see:
- Connection name
- Connection type
- Health status

Users do **not** see:
- Host, port, database
- Username, password

This is intentional - users can use connections without knowing where they point.

## Query Safety

When users inspect or preview data through the database data source, all queries are validated to block destructive SQL operations. Statements containing `DROP`, `ALTER`, `CREATE`, `DELETE`, `UPDATE`, `INSERT`, `TRUNCATE`, `GRANT`, `REVOKE`, or `EXEC`/`EXECUTE` are rejected before reaching the database. This applies to both schema inspection and data preview paths.
