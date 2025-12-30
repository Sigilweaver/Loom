---
sidebar_position: 8
---

# Using Hub

Hub is Sigilweaver's orchestration platform for teams. When connected to Hub, you get access to shared database connections, centralized workflow storage, and scheduled execution.

## Connecting to Hub

1. Open **Settings** from the header bar
2. Go to the **Hub** tab
3. Enter your Hub URL (provided by your administrator)
4. Enter your username and password
5. Click **Connect**

Once connected, Hub features become available throughout Studio.

## Hub Connections

When connected to Hub, you'll see **Hub connections** in addition to your local client connections. These are database connections managed by your administrator.

**Hub connections are different from client connections:**

| | Client Connections | Hub Connections |
|---|---|---|
| Created by | You | Administrator |
| Credentials visible | Yes (you entered them) | No (hidden from you) |
| Available on | This machine only | Any machine connected to Hub |
| Managed in | Studio Settings | Hub admin panel |

You can use Hub connections in your workflows just like client connections - select them from the connection dropdown in database tools. The difference is you never see the actual credentials.

:::tip Why Hub Connections?
Hub connections let you query production databases without knowing the password. Your administrator controls who has access through group membership. If you leave the team, they remove you from the group and you lose access - no password rotation needed.
:::

## Workflow Storage

Hub provides centralized workflow storage:

- **Upload workflows** to Hub for backup and sharing
- **Download workflows** from Hub to your local machine
- **Share with team** - Anyone with Hub access can see uploaded workflows

### Uploading a Workflow

1. Save your workflow locally
2. Click **Upload to Hub** in the workflow menu
3. Choose a folder and add tags (optional)
4. Click **Upload**

### Downloading a Workflow

1. Open the **Hub Workflows** panel
2. Browse or search for the workflow
3. Click to download and open

## Scheduled Execution

Hub can run your workflows on a schedule without Studio open:

1. Upload your workflow to Hub
2. Create a schedule in the Hub interface (or ask your administrator)
3. Hub runs the workflow at the specified times
4. View execution history and results in Hub

:::note Schedules
Schedule management may be done through the Hub web interface or by your administrator, depending on your organization's setup.
:::

## What Happens When Hub is Unavailable

If Hub goes offline or you lose network connection:

- **Client connections** continue to work normally
- **Hub connections** become unavailable until reconnected
- **Local workflows** are unaffected
- **Uploaded workflows** are stored on Hub and inaccessible until reconnected

Your local work is never blocked by Hub availability.

## For More Information

- Ask your administrator for your Hub URL and credentials
- See the [Administrator Guide](/admin/) for details on how Hub is configured
- See [Managing Connections](./connections) for details on connection types
