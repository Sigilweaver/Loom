---
sidebar_position: 5
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

## Assigning to Groups

A connection is not accessible to users until assigned to at least one group:

1. Go to **Admin > Groups**
2. Select a group
3. Go to **Connections** tab
4. Add the connection

Users in that group can now use the connection in workflows.

## What Users See

Users see:
- Connection name
- Connection type
- Health status

Users do **not** see:
- Host, port, database
- Username, password

This is intentional - users can use connections without knowing where they point.
