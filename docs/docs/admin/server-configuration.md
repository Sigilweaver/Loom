# Server Configuration

Complete reference for Sigilweaver Loom Server environment variables. All settings are case-insensitive and can be set via `.env` file or environment variables.

## Core Settings

| Variable     | Default   | Description                                            |
| ------------ | --------- | ------------------------------------------------------ |
| `HOST`       | `0.0.0.0` | Server bind address                                    |
| `PORT`       | `25811`   | HTTP server port                                       |
| `RELOAD`     | `false`   | Enable hot reload (development only)                   |
| `LOG_LEVEL`  | `info`    | Logging verbosity: `debug`, `info`, `warning`, `error` |
| `LOG_FORMAT` | `text`    | Log output format: `text` or `json`                    |

### Example

```bash
PORT=25811
LOG_LEVEL=info
LOG_FORMAT=json  # For production log aggregation
```

## CORS Settings

Control Cross-Origin Resource Sharing for browser-based clients.

| Variable       | Default                      | Description                                         |
| -------------- | ---------------------------- | --------------------------------------------------- |
| `CORS_ORIGINS` | `["http://localhost:25810"]` | Allowed origins (JSON array)                        |
| `CORS_MODE`    | `development`                | `development` (permissive) or `production` (strict) |

### Example

```bash
CORS_ORIGINS=["https://studio.example.com"]
CORS_MODE=production
```

## Execution Limits

Prevent runaway workflows from consuming excessive resources.

| Variable                     | Default | Description                                 |
| ---------------------------- | ------- | ------------------------------------------- |
| `MAX_EXECUTION_TIME_SECONDS` | `300`   | Maximum workflow execution time (5 minutes) |
| `MAX_MEMORY_MB`              | `4096`  | Maximum memory usage (4 GB)                 |
| `MAX_PREVIEW_ROWS`           | `10000` | Maximum rows returned in preview responses  |

## Authentication

Server supports four authentication modes:

| Mode        | Description                  | Use Case               |
| ----------- | ---------------------------- | ---------------------- |
| `disabled`  | No authentication            | Development            |
| `ephemeral` | Token generated per session  | Desktop app (Electron) |
| `static`    | Fixed token from environment | Simple deployments     |
| `hub`       | Token validated with Hub     | Team/Multi-user        |

### Configuration

| Variable              | Default    | Description                           |
| --------------------- | ---------- | ------------------------------------- |
| `AUTH_MODE`           | `disabled` | Authentication mode                   |
| `SESSION_TOKEN`       | `""`       | Token for `ephemeral`/`static` modes  |
| `AUTH_PROTECT_DOCS`   | `true`     | Require auth for `/docs` and `/redoc` |
| `AUTH_PROTECT_HEALTH` | `true`     | Require auth for `/api/health`        |

### Examples

```bash
# Development (no auth)
AUTH_MODE=disabled

# Static token (simple deployment)
AUTH_MODE=static
SESSION_TOKEN=my-secret-token-here

# Hub mode (team)
AUTH_MODE=hub
HUB_URL=https://hub.example.com
HUB_SERVER_TOKEN=server-token-from-hub
```

## Hub Integration

When `AUTH_MODE=hub`, Server validates tokens with Hub and receives credentials just-in-time.

| Variable                  | Default | Description                                      |
| ------------------------- | ------- | ------------------------------------------------ |
| `HUB_URL`                 | `""`    | Hub server URL                                   |
| `HUB_SERVER_TOKEN`        | `""`    | This server's auth token (from Hub registration) |
| `HUB_REGISTRATION_SECRET` | `""`    | Shared secret for auto-registration              |

### Auto-Registration

If `HUB_REGISTRATION_SECRET` is set, Server automatically registers with Hub on startup:

```bash
AUTH_MODE=hub
HUB_URL=https://hub.example.com
HUB_REGISTRATION_SECRET=shared-secret-with-hub
```

Hub must have the same secret configured in `SERVER_REGISTRATION_SECRET`.

## File Security

Control which filesystem paths workflows can access.

| Variable               | Default | Description                                   |
| ---------------------- | ------- | --------------------------------------------- |
| `RESTRICT_FILE_ACCESS` | `true`  | Enable file path restrictions                 |
| `ALLOWED_FILE_PATHS`   | `[]`    | Whitelist of allowed directories (JSON array) |

### Example

```bash
RESTRICT_FILE_ACCESS=true
ALLOWED_FILE_PATHS=["/data/shared", "/data/exports"]
```

:::warning
When `RESTRICT_FILE_ACCESS=true` with an empty `ALLOWED_FILE_PATHS`, file browsing is disabled. In Hub mode, file access is controlled by Hub filesystem connections.
:::

## Cache Settings

Server caches outputs of blocking operations (sort, summarize, join) to avoid re-computation.

| Variable               | Default                    | Description                                |
| ---------------------- | -------------------------- | ------------------------------------------ |
| `CACHE_ENABLED`        | `true`                     | Enable blocking tool cache                 |
| `CACHE_PATH`           | `../.working/server/cache` | Cache storage directory                    |
| `CACHE_RETENTION_DAYS` | `7`                        | Delete files older than this (0 = forever) |
| `CACHE_MAX_SIZE_GB`    | `20.0`                     | Maximum total cache size (0 = unlimited)   |
| `CACHE_CLEAR_ON_CLOSE` | `true`                     | Clear workflow cache when Studio closes it |

### Cache Behavior

- **TTL cleanup**: Files older than `CACHE_RETENTION_DAYS` are deleted on startup
- **LRU eviction**: If cache exceeds `CACHE_MAX_SIZE_GB`, oldest files are evicted
- **Workflow close**: If `CACHE_CLEAR_ON_CLOSE=true`, cache is cleared when workflow closes

### Example

```bash
CACHE_ENABLED=true
CACHE_PATH=/var/lib/sigilweaver-loom/cache
CACHE_RETENTION_DAYS=7
CACHE_MAX_SIZE_GB=50.0
```

## Archive Settings

Server archives workflow executions for audit and debugging.

| Variable                 | Default                       | Description                                     |
| ------------------------ | ----------------------------- | ----------------------------------------------- |
| `ARCHIVE_ENABLED`        | `true`                        | Enable workflow execution archiving             |
| `ARCHIVE_PATH`           | `../.working/server/archives` | Archive storage directory                       |
| `ARCHIVE_RETENTION_DAYS` | `30`                          | Auto-cleanup after this many days (0 = forever) |

### What's Archived

- Original workflow JSON
- Execution timing and status
- Tool execution sequence
- Error details (if failed)
- Result summaries

## Audit Settings

Audit logging tracks API requests for compliance and debugging.

| Variable               | Default                    | Description                                |
| ---------------------- | -------------------------- | ------------------------------------------ |
| `AUDIT_ENABLED`        | `true`                     | Enable audit logging                       |
| `AUDIT_PATH`           | `../.working/server/audit` | Audit log directory                        |
| `AUDIT_RETENTION_DAYS` | `30`                       | Cleanup logs older than this (0 = forever) |

## Parallel Execution

Execute independent tools concurrently for improved performance.

| Variable             | Default      | Description                                        |
| -------------------- | ------------ | -------------------------------------------------- |
| `EXECUTION_MODE`     | `sequential` | `sequential` (safe) or `parallel`                  |
| `MAX_PARALLEL_TOOLS` | `4`          | Maximum concurrent tool executions (0 = unlimited) |

:::note
Parallel execution can significantly speed up workflows with independent branches, but uses more memory. Start with `sequential` and enable `parallel` after testing.
:::

## Safety Limits

Prevent tools from creating outputs that could crash the application or consume excessive resources.

| Variable                     | Default     | Description                             |
| ---------------------------- | ----------- | --------------------------------------- |
| `SAFETY_MAX_PIVOT_COLUMNS`   | `1000`      | Max unique values in pivot "on" column  |
| `SAFETY_MAX_CROSS_JOIN_ROWS` | `10000000`  | Max rows from cross join (left × right) |
| `SAFETY_MAX_UNPIVOT_ROWS`    | `100000000` | Max rows after unpivot (rows × columns) |

Set to `0` to disable individual limits (not recommended).

### Example Error

If a pivot would create 5000 columns but limit is 1000:

```
Safety limit exceeded: Pivot would create 5000 columns, but maximum is 1000.
Reduce unique values in the "on" column or increase SAFETY_MAX_PIVOT_COLUMNS.
```

## Connection Store

Server can store database connections with encrypted credentials.

| Variable                    | Default                               | Description                          |
| --------------------------- | ------------------------------------- | ------------------------------------ |
| `CONNECTION_ENCRYPTION_KEY` | `""`                                  | Fernet key for credential encryption |
| `CONNECTION_STORE_PATH`     | `../.working/server/connections.json` | Connection storage file              |

### Generating an Encryption Key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Example

```bash
CONNECTION_ENCRYPTION_KEY=your-fernet-key-here
CONNECTION_STORE_PATH=/var/lib/sigilweaver-loom/connections.json
```

:::warning
Without `CONNECTION_ENCRYPTION_KEY`, server connections are disabled. Client-owned connections (stored in Studio) still work.
:::

## Complete Example

Production-ready configuration:

```bash
# Core
PORT=25811
LOG_LEVEL=info
LOG_FORMAT=json

# CORS
CORS_ORIGINS=["https://studio.example.com"]
CORS_MODE=production

# Authentication (Hub mode)
AUTH_MODE=hub
HUB_URL=https://hub.example.com
HUB_SERVER_TOKEN=your-server-token

# Limits
MAX_EXECUTION_TIME_SECONDS=600
MAX_MEMORY_MB=8192
MAX_PREVIEW_ROWS=10000

# Cache
CACHE_ENABLED=true
CACHE_PATH=/var/lib/sigilweaver-loom/cache
CACHE_MAX_SIZE_GB=100.0

# Safety
SAFETY_MAX_PIVOT_COLUMNS=2000
SAFETY_MAX_CROSS_JOIN_ROWS=50000000

# Connections
CONNECTION_ENCRYPTION_KEY=your-fernet-key-here
```
