---
sidebar_position: 9
title: Using Hub
---

# Using Hub

Hub is the optional team platform. This page explains what you do with it as a Studio user. Administrators should read the [Administrator Guide](../../admin/index.md).

:::note Open beta
Hub is in open beta. See [Hub Open Beta](../../admin/hub-beta.md) for the current limitations.
:::

## What you use Hub for

| You want to...                                 | Where                                   |
| ---------------------------------------------- | --------------------------------------- |
| Query a database without knowing its password  | Studio, with a Hub connection           |
| Run workflows on a shared Server               | Studio in Hub mode, or the Hub web app  |
| Keep workflows in one shared place             | The Hub web app                         |
| Run a workflow on a schedule                   | The Hub web app                         |
| See what ran and whether it worked             | The Hub web app                         |

Studio connects to Hub for connections and for running workflows. Storing, sharing and scheduling workflows happens in the Hub web app.

## Connect Studio to Hub

1. Open the **Settings** tab and expand **Execution**.
2. Set **Execution Mode** to **Hub**.
3. Enter the **Hub URL** your administrator gave you.
4. Click **Login to Hub** and sign in with your Hub username and password.
5. Optionally turn on **Remember login** to stay signed in between sessions.

The status box shows **Connected as** your username when it works.

## What changes in Hub mode

- **Hub connections** appear under **Settings > Connections** and in the connection list of database Read tools, marked `[Hub]`. You can use them but not see their credentials.
- **Previews and runs** go through Hub. For each request, Studio asks Hub for a short-lived token, sends the request to a Server that Hub picked, and the Server asks Hub for the credentials it needs. You never handle the credentials.
- **File browsing** with the **Remote** button shows only the folders your administrator granted you.
- Your **local connections** still work.

Hub mode needs a Server that Hub can reach and that is online. If Hub reports that no healthy server is available, ask your administrator.

## The Hub web app

Open your Hub URL in a browser and sign in. Users see four pages.

| Page            | What it does                                                                                |
| --------------- | ------------------------------------------------------------------------------------------- |
| **Home**        | Your recent workflows and executions.                                                       |
| **Workflows**   | Upload `.swwf` files, organize them in folders with tags, download them, and click **Run Now**. |
| **Executions**  | History of your runs. Filter by status, cancel a queued or running execution, and read the error of a failed one. Status updates live. |
| **Schedules**   | Run a workflow every few minutes, hourly, daily, weekly or monthly. You can also enter a cron expression. |

To share a workflow, save it in Studio, then upload the `.swwf` file on the **Workflows** page.

Administrators and auditors use a separate admin area of the same app. See [Roles and Permissions](../../admin/roles.md).

:::caution Runs started from Hub
A run started with **Run Now** or by a schedule is made by a Hub system identity, not by you. That identity has no connection grants, so workflows that need Hub-managed database connections do not run this way today. File-based workflows are fine, provided the Server can read the files.
:::

## If Hub is unavailable

- Local work is not affected. You can still open, edit and save workflows.
- In Hub mode, previews and runs stop until Hub is back. Switch **Execution Mode** to **Bundled** or **External** to keep working against a Server without Hub.
- Hub connections are unavailable until you reconnect.

## More help

- Ask your administrator for your Hub URL and login.
- [Managing Connections](./connections.md)
- [Administrator Guide](../../admin/index.md)
