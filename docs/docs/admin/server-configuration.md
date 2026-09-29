---
sidebar_position: 3
title: Server Configuration
---

# Server Configuration

Reference for the Server's environment variables. Names are case-insensitive. Set them in the environment or in a `.env` file in the Server's working directory. List values (such as `CORS_ORIGINS`) must be JSON arrays.

The defaults below are what the code ships with. The desktop app and the Docker images override some of them. Where that happens, the section says so.

## Core

| Variable     | Default   | Meaning                                              |
| ------------ | --------- | ---------------------------------------------------- |
| `HOST`       | `0.0.0.0` | Bind address                                         |
| `PORT`       | `25811`   | HTTP port                                            |
| `RELOAD`     | `false`   | Auto-reload on code changes (development only)      |
| `LOG_LEVEL`  | `info`    | `debug`, `info`, `warning` or `error`                |
| `LOG_FORMAT` | `text`    | `text` or `json`. Use `json` for log aggregation     |

## Identity in Hub

| Variable              | Default                     | Meaning                                                                 |
| --------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `SERVER_NAME`         | `server-<port>`             | Name shown in Hub                                                       |
| `PUBLIC_ENDPOINT_URL` | `http://localhost:<port>`   | Address that Hub and Studio use to reach this Server. Set it whenever the Server is not on the same host as its clients. |

## CORS

| Variable       | Default                      | Meaning                                                                  |
| -------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `CORS_MODE`    | `development`                | `development` allows any origin. `production` allows only `CORS_ORIGINS`. |
| `CORS_ORIGINS` | `["http://localhost:25810"]` | Allowed origins in `production` mode (JSON array)                        |

The default `development` mode is permissive. `docker/docker-compose.yml` sets `CORS_MODE=production`. Do the same for any Server that is not on localhost.

```bash
CORS_MODE=production
CORS_ORIGINS=["https://studio.example.com"]
```

## Execution limits

| Variable                     | Default | Meaning                                                              |
| ---------------------------- | ------- | -------------------------------------------------------------------- |
| `MAX_EXECUTION_TIME_SECONDS` | `300`   | Wall-clock budget for one workflow execution. `0` disables it.       |
| `MAX_PREVIEW_ROWS`           | `10000` | Upper limit on rows returned in a preview                            |
| `MAX_MEMORY_MB`              | `4096`  | Defined but not enforced by the current code                         |

The time limit is checked between steps. A single long Polars operation cannot be interrupted, so a run can overshoot the budget by the length of that operation.

## Parallel execution

| Variable             | Default    | Meaning                                                        |
| -------------------- | ---------- | -------------------------------------------------------------- |
| `EXECUTION_MODE`     | `parallel` | `parallel` runs independent branches together. `sequential` runs one tool at a time. |
| `MAX_PARALLEL_TOOLS` | `4`        | Concurrent tools in `parallel` mode. `0` means unlimited.       |

Lower `MAX_PARALLEL_TOOLS`, or use `sequential`, on hosts with little memory.

## Authentication

| Variable              | Default     | Meaning                                                      |
| --------------------- | ----------- | ------------------------------------------------------------ |
| `AUTH_MODE`           | `ephemeral` | How requests are authenticated. See below.                   |
| `SESSION_TOKEN`       | empty       | Bearer token for `ephemeral` and `static` modes              |
| `AUTH_PROTECT_DOCS`   | `true`      | Require authentication for `/docs`, `/redoc` and `/openapi.json` |
| `AUTH_PROTECT_HEALTH` | `true`      | Require authentication for `/api/health`                     |

| Mode        | Behavior                                                                                       | Use it for                  |
| ----------- | ---------------------------------------------------------------------------------------------- | --------------------------- |
| `ephemeral` | Requires a bearer token. If `SESSION_TOKEN` is empty, the Server generates one and logs it once. The desktop app sets its own token on each launch. | The bundled desktop Server  |
| `static`    | Requires the bearer token in `SESSION_TOKEN`. The Server refuses to start if it is empty.     | A standalone Server         |
| `hub`       | Workflow and file requests carry a Hub-issued token, and the Server asks Hub to authorize each one. Requires `HUB_URL`. | Servers used with Hub |
| `disabled`  | No authentication. The Server logs a warning at startup.                                       | Isolated development only   |

The Docker entrypoint sets `AUTH_MODE=hub` when `HUB_URL` is present and `disabled` otherwise, unless you set `AUTH_MODE` yourself.

```bash
# Standalone Server with a fixed token
AUTH_MODE=static
SESSION_TOKEN=change-me-to-a-long-random-string
```

## Hub integration

Used when `AUTH_MODE=hub`.

| Variable                  | Default | Meaning                                                                 |
| ------------------------- | ------- | ----------------------------------------------------------------------- |
| `HUB_URL`                 | empty   | Hub's base URL. Required in `hub` mode.                                 |
| `HUB_SERVER_TOKEN`        | empty   | Identifies this Server to Hub. Choose a long random string.             |
| `HUB_REGISTRATION_SECRET` | empty   | Must equal Hub's `SERVER_REGISTRATION_SECRET`                           |

The Server registers itself and repeats the registration every 30 seconds, but only when `HUB_URL` and `HUB_SERVER_TOKEN` are both set. See [Server Management](./servers.md).

```bash
AUTH_MODE=hub
HUB_URL=https://hub.example.com
HUB_SERVER_TOKEN=a-long-random-string-unique-to-this-server
HUB_REGISTRATION_SECRET=the-shared-registration-secret
SERVER_NAME=analytics-1
PUBLIC_ENDPOINT_URL=https://analytics-1.example.com
```

## File access

Controls which paths workflows may read and write.

| Variable               | Default | Meaning                                                                  |
| ---------------------- | ------- | ------------------------------------------------------------------------ |
| `FILE_ACCESS_MODE`     | `auto`  | `open`, `allowlist`, `hub` or `auto`                                     |
| `ALLOWED_FILE_PATHS`   | `[]`    | Allowed directories for `allowlist` mode (JSON array)                    |
| `RESTRICT_FILE_ACCESS` | `false` | Older switch. Only consulted when `FILE_ACCESS_MODE=auto`.               |

| Mode        | Behavior                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------ |
| `open`      | No restriction. The Server can read and write any path its process can. It logs a warning. |
| `allowlist` | Only paths inside `ALLOWED_FILE_PATHS`. The list must not be empty.                        |
| `hub`       | Only paths that Hub granted for the request. Requires `AUTH_MODE=hub`.                     |
| `auto`      | `hub` when `AUTH_MODE=hub`. Otherwise `allowlist` when `RESTRICT_FILE_ACCESS=true` and paths are listed, else `open`. |

The Server refuses to start on contradictory settings, for example `allowlist` with no paths, or `RESTRICT_FILE_ACCESS=true` with an empty list.

For anything other than a single-user desktop, set `allowlist` or `hub` explicitly.

```bash
FILE_ACCESS_MODE=allowlist
ALLOWED_FILE_PATHS=["/data/shared","/data/exports"]
```

## Cache

The Server caches the output of blocking tools on disk. See [Performance and Caching](../user/interface/caching.md).

| Variable               | Default                    | Meaning                                       |
| ---------------------- | -------------------------- | --------------------------------------------- |
| `CACHE_ENABLED`        | `true`                     | Turn caching on or off                        |
| `CACHE_PATH`           | `../.working/server/cache` | Directory for cache files                     |
| `CACHE_RETENTION_DAYS` | `7`                        | Delete files older than this. `0` keeps them. |
| `CACHE_MAX_SIZE_GB`    | `20.0`                     | Maximum total size. `0` means unlimited.      |
| `CACHE_CLEAR_ON_CLOSE` | `true`                     | Clear a workflow's cache when Studio closes it |

At startup the Server deletes expired files and, if the cache is over its size limit, removes the oldest files first.

## Archive

The Server can archive each execution for debugging and audit: the workflow, timings, the order tools ran and any error.

| Variable                 | Default                       | Meaning                                       |
| ------------------------ | ----------------------------- | --------------------------------------------- |
| `ARCHIVE_ENABLED`        | `true`                        | Turn archiving on or off                      |
| `ARCHIVE_PATH`           | `../.working/server/archives` | Directory for archives                        |
| `ARCHIVE_RETENTION_DAYS` | `30`                          | Delete archives older than this. `0` keeps them. |

## Audit log

The Server writes one log line per API request to a daily file.

| Variable               | Default                    | Meaning                                       |
| ---------------------- | -------------------------- | --------------------------------------------- |
| `AUDIT_ENABLED`        | `true`                     | Turn request logging on or off                |
| `AUDIT_PATH`           | `../.working/server/audit` | Directory for log files                       |
| `AUDIT_RETENTION_DAYS` | `30`                       | Delete logs older than this. `0` keeps them.  |

This log is separate from the Hub audit log. See [Security Model](./security.md).

## Safety limits

These stop a single tool from producing an output large enough to crash the Server. Set a limit to `0` to disable it.

| Variable                     | Default     | Meaning                                       |
| ---------------------------- | ----------- | --------------------------------------------- |
| `SAFETY_MAX_PIVOT_COLUMNS`   | `1000`      | Most unique values allowed in a Pivot's column field |
| `SAFETY_MAX_CROSS_JOIN_ROWS` | `10000000`  | Most rows a cross join (a Join with no keys) may produce |
| `SAFETY_MAX_UNPIVOT_ROWS`    | `100000000` | Most rows an Unpivot may produce              |

## Rate limiting

| Variable                | Default      | Meaning                                                     |
| ----------------------- | ------------ | ----------------------------------------------------------- |
| `RATE_LIMIT_ENABLED`    | `false`      | Limit requests per client                                   |
| `RATE_LIMIT_WORKFLOW`   | `600/minute` | Default limit when rate limiting is on                      |

## Server-stored connections

The Server can keep encrypted database connections of its own. New deployments should use [Hub connections](./connections.md) instead. The Studio Connection Manager does not create these.

| Variable                    | Default                               | Meaning                          |
| --------------------------- | ------------------------------------- | -------------------------------- |
| `CONNECTION_ENCRYPTION_KEY` | empty                                 | Fernet key for the store         |
| `CONNECTION_STORE_PATH`     | `../.working/server/connections.json` | Store file                       |

Without a key, the connections API returns 503. Generate a key with `openssl rand -base64 32 | tr '+/' '-_'`.

## AI proxy

| Variable             | Default                  | Meaning                                                              |
| -------------------- | ------------------------ | -------------------------------------------------------------------- |
| `OLLAMA_DEFAULT_URL` | `http://localhost:11434` | Base URL used for the OpenAI-compatible provider when Studio sends none. It is still subject to the proxy's block on private and loopback addresses. |

## Example: a Server behind Hub

```bash
PORT=25811
LOG_LEVEL=info
LOG_FORMAT=json

CORS_MODE=production
CORS_ORIGINS=["https://studio.example.com"]

AUTH_MODE=hub
HUB_URL=https://hub.example.com
HUB_SERVER_TOKEN=a-long-random-string-unique-to-this-server
HUB_REGISTRATION_SECRET=the-shared-registration-secret
SERVER_NAME=analytics-1
PUBLIC_ENDPOINT_URL=https://analytics-1.example.com

MAX_EXECUTION_TIME_SECONDS=600
MAX_PARALLEL_TOOLS=4

CACHE_PATH=/var/lib/sigilweaver-loom/cache
CACHE_MAX_SIZE_GB=100
```
