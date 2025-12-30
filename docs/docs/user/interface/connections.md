---
sidebar_position: 7
---

# Managing Connections

Sigilweaver supports connecting to external databases for querying data directly in your workflows. Database credentials are handled securely through the Connection Manager.

## Accessing the Connection Manager

Open **Settings** from the header bar and navigate to the **Connections** tab. Here you can view, create, edit, and delete database connections.

## Connection Types

### Client Connections

Client connections store credentials locally on your machine using Electron's secure storage (safeStorage API). These connections are:

- **Private to you** - Only accessible on the machine where they were created
- **Encrypted at rest** - Protected by your operating system's credential storage
- **Ideal for** - Personal databases, development environments, individual work

### Hub Connections

Hub connections are managed by your organization's administrators through [Sigilweaver Hub](/admin/). The credentials are stored on the Hub server using Fernet encryption. These connections are:

- **Managed centrally** - Administrators create and maintain connections
- **Shared through groups** - Available to users who are members of assigned groups
- **Opaque to users** - You can use the connection but cannot see the username/password
- **Ideal for** - Team databases, production systems, controlled access environments

:::note Hub Connections
Hub connections appear in your connection list when you're connected to a Hub server and are a member of groups with assigned connections. You can use them in workflows but cannot edit or view their credentials.

See the [Administrator Guide](/admin/connections) for details on how Hub connections are managed.
:::

## Creating a Client Connection

1. Click **Add Connection** in the Connection Manager
2. Fill in the connection details:
   - **Name**: A descriptive name for the connection
   - **Type**: Database type (currently PostgreSQL)
   - **Host**: Database server hostname or IP
   - **Port**: Database port (default: 5432 for PostgreSQL)
   - **Database**: Name of the database to connect to
   - **Username**: Database user
   - **Password**: Database password
3. Click **Test Connection** to verify connectivity
4. Click **Save** to store the connection

## Editing a Client Connection

1. Find the connection in the list
2. Click the edit (pencil) icon
3. Update the fields as needed
4. Leave username/password blank to keep existing credentials
5. Click **Save**

:::note Hub Connections
You cannot edit Hub connections - they are managed by your administrator. Contact your admin if credentials need to be updated.
:::

## Deleting a Client Connection

1. Find the connection in the list
2. Click the delete (trash) icon
3. Confirm deletion

:::warning
Deleting a connection may break workflows that use it. Check your workflows before removing connections.

Hub connections cannot be deleted by users - contact your administrator.
:::

## Using Connections in Workflows

1. Add an **Input** tool to your workflow
2. Select **Database** as the data source category
3. Choose **PostgreSQL** as the database type
4. Select your connection from the dropdown
5. Enter your SQL query
6. The query results are available as output

## Security Model

Sigilweaver is designed to protect your database credentials:

### What's Protected

- **Credentials never appear in workflow files** - Only connection IDs are saved
- **Python code exports omit credentials** - Generated code uses placeholder comments
- **JSON previews strip sensitive data** - Workflow JSON shows IDs, not passwords
- **Hub credentials stay on Hub** - Users cannot extract Hub-managed passwords

### How It Works

| Connection Type | Storage | Who Can Access | Sent to Server |
|-----------------|---------|----------------|----------------|
| Client | Electron safeStorage (OS keychain) | Only you, on this machine | **Yes** - when executing workflows |
| Hub | Fernet-encrypted on Hub server | Hub administrators only | No - Hub resolves internally |

:::important Client Credentials Are Transmitted
**Client connections** store credentials on your local machine, but they are **sent to the Server** when you execute a workflow that queries a database. The Server needs the credentials to connect to your database and run the query.

This means:
- Your credentials are transmitted over the network (use HTTPS/localhost)
- The Server temporarily has access to your credentials during execution
- For production or sensitive databases, use **Hub connections** instead

**Hub connections** are different - the credentials are stored on the Hub server and resolved internally. They are never transmitted to your machine and you cannot see the actual username/password. This is the recommended approach for team databases.

See [Hub Security Model](/admin/security) for details on how Hub protects credentials.
:::

### Workflow Portability

When you share a workflow that uses database connections:

- **Same machine**: Client connections work automatically (your credentials are available)
- **Different machine**: User must have matching connection IDs configured
- **Hub connections**: Work automatically for anyone with access to the same Hub and group membership

:::tip Best Practice
**For team workflows**, use **Hub connections** so all team members can run the workflow without configuring individual credentials.

**For production databases**, always use **Hub connections** - this keeps credentials centrally managed and avoids transmitting them from client machines. Client connections are best for local development databases or personal data sources.
:::

## Troubleshooting

### "Connection not found"

The workflow references a connection ID that doesn't exist on your machine or server. Create a new connection with the same settings, or ask your administrator to set up a server connection.

### "Encryption not available"

Client connections require the desktop application with Electron. If running in a browser or without safeStorage support, you can only use server connections.

### "Failed to connect"

Check:
- Is the database server running?
- Are the host and port correct?
- Is the database name spelled correctly?
- Does the user have permission to connect?
- Are there firewall rules blocking the connection?

### "Hub connections unavailable"

You may not be connected to a Hub server, or you may not be in any groups with connections assigned.

**Solutions:**
- Connect to Hub from Studio settings
- Ask your administrator to add you to groups with connections
- See [Groups](/admin/groups) for how group membership works
