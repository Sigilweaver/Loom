---
sidebar_position: 8
title: Server Management
---

# Server Management

Servers are the processes that run workflows. Hub keeps a list of them, watches their health and sends them work.

## Add a Server

### Automatic registration

A Server registers itself when it is configured with `HUB_URL` and `HUB_SERVER_TOKEN`, and presents `HUB_REGISTRATION_SECRET`. It repeats the registration every 30 seconds, so it reconnects on its own after a restart of either side. The registration is accepted only when the secret matches Hub's `SERVER_REGISTRATION_SECRET`.

| Variable                  | Set on | Meaning                                                              |
| ------------------------- | ------ | -------------------------------------------------------------------- |
| `AUTH_MODE=hub`           | Server | Makes the Server authorize requests through Hub                      |
| `HUB_URL`                 | Server | Where the Server reaches Hub                                         |
| `HUB_SERVER_TOKEN`        | Server | Identifies this Server. Hub tells Servers apart by this token.       |
| `HUB_REGISTRATION_SECRET` | Server | Must equal Hub's `SERVER_REGISTRATION_SECRET`                        |
| `SERVER_NAME`             | Server | Display name                                                         |
| `PUBLIC_ENDPOINT_URL`     | Server | The address that Hub and Studio use to reach the Server              |

See [Server Configuration](./server-configuration.md) and the [Deployment Guide](./deployment.md).

:::caution Set PUBLIC_ENDPOINT_URL
If you leave it empty, the Server advertises `http://localhost:<port>`. Hub cannot reach that from another host, and neither can Studio. Hub also gives this address to Studio, so it has to work from your users' machines.
:::

### Manual registration

1. Open **Admin > Servers** and click **Register Server**.
2. Enter a name and the endpoint URL. You can add an auth token as well.
3. Save. Hub checks the Server straight away.

You need the Owner or Admin role.

## Status

| Status      | Meaning                                                                    |
| ----------- | -------------------------------------------------------------------------- |
| **Online**  | Answered its last health check                                             |
| **Offline** | Failed three health checks in a row                                        |
| **Unknown** | Not checked yet                                                            |

Hub checks each Server every 30 seconds (`SERVER_POLL_INTERVAL_SECONDS`). A single failed check does not change the status. A failing Server is retried with a growing delay, up to 60 seconds. One successful check returns it to Online. Use the refresh button to check a Server now, and **Test** to try an endpoint before you save it.

## How Hub picks a Server

When a run does not name a Server, Hub chooses among the Servers that are Online. The choice is simple and not load-aware. In practice it is the first online Server by name. A user or schedule can name a specific Server. See [Hub Open Beta](./hub-beta.md).

## Server groups

You can assign a Server to a user group. The assignment decides which Servers members of that group can **see** when they pick a target Server for a schedule. It does not stop a user from running work on a Server that Hub picks for them.

The web app has no screen for this yet. Use the API as an Admin or Owner:

```bash
# Assign
curl -X POST   -H "Authorization: Bearer $TOKEN" "$HUB/api/v1/servers/$SERVER_ID/groups/$GROUP_ID"
# Remove
curl -X DELETE -H "Authorization: Bearer $TOKEN" "$HUB/api/v1/servers/$SERVER_ID/groups/$GROUP_ID"
```

`$TOKEN` is a session token from `POST /api/v1/auth/login`. Users whose groups have no Servers see an empty Server list and can leave the target as automatic.

## Remove a Server

Delete it from **Admin > Servers**. A Server that is still configured with `HUB_URL` registers again within 30 seconds, so stop or reconfigure it as well.
