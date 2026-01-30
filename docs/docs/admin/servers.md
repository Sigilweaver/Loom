---
sidebar_position: 7
---

# Server Management

Servers are stateless executors that run workflows. When properly configured, servers register with Hub automatically.

## Automatic Registration

Configure a server to register with Hub by setting environment variables:

- `HUB_URL` - Hub's address (e.g., `http://hub.internal:25802`)
- `SERVER_REGISTRATION_SECRET` - Shared secret (must match Hub's configuration)

On startup, the server registers itself with Hub. No manual registration required.

## Manual Registration

If automatic registration is not configured, register servers manually from **Admin > Servers**:

1. Click **Register Server**
2. Enter name and endpoint URL
3. Click **Register**

## Server Status

| Status      | Meaning                     |
| ----------- | --------------------------- |
| **Online**  | Responding to health checks |
| **Offline** | Not responding              |
| **Unknown** | Not yet checked             |

Hub polls servers periodically (default: 30 seconds). Click the refresh icon to check immediately.

## Server Selection

When executing a workflow, Hub selects an available server using round-robin. If no servers are online, the execution fails.
