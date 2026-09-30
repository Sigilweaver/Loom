# Sigilweaver Loom Server

The execution engine that powers Sigilweaver Loom workflows.

## What is Server?

Server is the component that actually runs your data pipelines. When you click "Execute" in Studio, your workflow is sent to Server, which processes your data and returns results.

Server is built on:
- **[FastAPI](https://fastapi.tiangolo.com/)** - A modern Python web framework
- **[Polars](https://pola.rs/)** - A blazing-fast DataFrame library with lazy evaluation

## Key Features

### Lazy Evaluation

Server doesn't process data row-by-row. Instead, it builds an optimized query plan and executes it all at once. This means you can work with datasets larger than your RAM - Server only loads what it needs.

### Tool-Based Architecture

Every operation in Sigilweaver Loom (filter, join, aggregate, etc.) is a "tool". Server has a registry of tools that it uses to execute workflows. This makes it easy to add new capabilities.

### Stateless Execution

Each request contains everything Server needs to run. This means you can:
- Run multiple Server instances behind a load balancer
- Connect Studio to any Server without session affinity
- Scale horizontally for high-throughput workloads

## Running Server

### Standalone

```bash
cd server
uv sync
uv run uvicorn app.main:app --port 25811
```

### With the Dev Script

```bash
./scripts/dev.py --server
```

Server runs on port **25811** by default.

## API Reference

### Workflow Execution

| Endpoint                      | Method | Description                                      |
| ----------------------------- | ------ | ------------------------------------------------ |
| `/api/workflow/execute`       | POST   | Execute entire workflow or up to a specific tool |
| `/api/workflow/tool/execute`  | POST   | Execute a single tool and its dependencies       |
| `/api/workflow/tool/schema`   | POST   | Get output schema without full execution         |
| `/api/workflow/tool/metadata` | POST   | Get column metadata for autocomplete             |
| `/api/workflow/tool/profile`  | POST   | Profile columns for data quality stats           |
| `/api/workflow/preview_all`   | POST   | Execute and return preview for all tools         |
| `/api/workflow/preview_code`  | POST   | Generate Python code from workflow               |
| `/api/workflow/cache/clear`   | POST   | Clear cache for a specific workflow              |

### Cache Management

| Endpoint                 | Method | Description                                        |
| ------------------------ | ------ | -------------------------------------------------- |
| `/api/cache/clear`       | POST   | Clear cache for a workflow                         |
| `/api/cache/close`       | POST   | Notify workflow closed (triggers clear if enabled) |
| `/api/cache/close/batch` | POST   | Batch close multiple workflows                     |
| `/api/cache/stats`       | GET    | Get global cache statistics                        |
| `/api/cache/maintenance` | POST   | Run TTL cleanup and LRU eviction                   |

### Connections

| Endpoint                     | Method | Description                           |
| ---------------------------- | ------ | ------------------------------------- |
| `/api/connections/status`    | GET    | Get connection store status           |
| `/api/connections/`          | GET    | List all server connections           |
| `/api/connections/{id}`      | GET    | Get specific connection               |
| `/api/connections/`          | POST   | Create new connection                 |
| `/api/connections/{id}`      | PUT    | Update connection                     |
| `/api/connections/{id}`      | DELETE | Delete connection                     |
| `/api/connections/{id}/test` | POST   | Test connection by attempting connect |

### Archives

| Endpoint                     | Method | Description                          |
| ---------------------------- | ------ | ------------------------------------ |
| `/api/archive/list`          | GET    | List archived workflow executions    |
| `/api/archive/detail/{path}` | GET    | Get full archive details             |
| `/api/archive/cleanup`       | POST   | Delete archives older than retention |
| `/api/archive/status`        | GET    | Get archive configuration status     |

### Data Sources

| Endpoint                    | Method | Description                 |
| --------------------------- | ------ | --------------------------- |
| `/api/datasource/inspect`   | POST   | Inspect data source schema  |
| `/api/datasource/preview`   | POST   | Preview data from source    |
| `/api/datasource/supported` | GET    | List supported source types |

### File Browser

| Endpoint           | Method | Description                     |
| ------------------ | ------ | ------------------------------- |
| `/api/files/roots` | GET    | List browsable root directories |
| `/api/files/list`  | GET    | List directory contents         |
| `/api/files/stat`  | GET    | Get file/directory info         |

### Utilities

| Endpoint                        | Method | Description                           |
| ------------------------------- | ------ | ------------------------------------- |
| `/api/health/`                  | GET    | Health check with version info        |
| `/api/polars/functions`         | GET    | Get Polars functions for autocomplete |
| `/api/polars/functions/refresh` | POST   | Refresh cached Polars functions       |

## Configuration Reference

Server is configured via environment variables (case-insensitive). All settings are defined in `app/config.py`.

### Core Settings

| Variable     | Default   | Description                                             |
| ------------ | --------- | ------------------------------------------------------- |
| `HOST`       | `0.0.0.0` | Server bind address                                     |
| `PORT`       | `25811`   | HTTP server port                                        |
| `RELOAD`     | `false`   | Enable hot reload (development)                         |
| `LOG_LEVEL`  | `info`    | Logging verbosity (`debug`, `info`, `warning`, `error`) |
| `LOG_FORMAT` | `text`    | Log format (`text` or `json`)                           |

### CORS Settings

| Variable       | Default                      | Description                                                   |
| -------------- | ---------------------------- | ------------------------------------------------------------- |
| `CORS_ORIGINS` | `["http://localhost:25810"]` | Allowed origins for CORS                                      |
| `CORS_MODE`    | `development`                | CORS mode (`development` = permissive, `production` = strict) |

### Execution Limits

| Variable                     | Default | Description                       |
| ---------------------------- | ------- | --------------------------------- |
| `MAX_EXECUTION_TIME_SECONDS` | `300`   | Maximum workflow execution time   |
| `MAX_MEMORY_MB`              | `4096`  | Maximum memory usage              |
| `MAX_PREVIEW_ROWS`           | `10000` | Maximum rows in preview responses |

### Authentication

| Variable              | Default    | Description                                         |
| --------------------- | ---------- | --------------------------------------------------- |
| `AUTH_MODE`           | `disabled` | Auth mode: `disabled`, `ephemeral`, `static`, `hub` |
| `SESSION_TOKEN`       | `""`       | Token for `ephemeral`/`static` modes                |
| `AUTH_PROTECT_DOCS`   | `true`     | Require auth for `/docs` and `/redoc`               |
| `AUTH_PROTECT_HEALTH` | `true`     | Require auth for `/api/health`                      |

### Hub Integration

| Variable                  | Default | Description                           |
| ------------------------- | ------- | ------------------------------------- |
| `HUB_URL`                 | `""`    | Hub server URL (for `auth_mode=hub`)  |
| `HUB_SERVER_TOKEN`        | `""`    | This server's token registered in Hub |
| `HUB_REGISTRATION_SECRET` | `""`    | Shared secret for Hub registration    |

### File Security

| Variable               | Default | Description                      |
| ---------------------- | ------- | -------------------------------- |
| `RESTRICT_FILE_ACCESS` | `true`  | Enable file path restrictions    |
| `ALLOWED_FILE_PATHS`   | `[]`    | Whitelist of allowed directories |

### Cache Settings

| Variable               | Default                    | Description                                |
| ---------------------- | -------------------------- | ------------------------------------------ |
| `CACHE_ENABLED`        | `true`                     | Enable blocking tool cache                 |
| `CACHE_PATH`           | `../.working/server/cache` | Cache storage directory                    |
| `CACHE_RETENTION_DAYS` | `7`                        | Delete files older than this (0 = forever) |
| `CACHE_MAX_SIZE_GB`    | `20.0`                     | Maximum cache size (0 = unlimited)         |
| `CACHE_CLEAR_ON_CLOSE` | `true`                     | Clear workflow cache when closed           |

### Archive Settings

| Variable                 | Default                       | Description                                     |
| ------------------------ | ----------------------------- | ----------------------------------------------- |
| `ARCHIVE_ENABLED`        | `true`                        | Enable workflow execution archiving             |
| `ARCHIVE_PATH`           | `../.working/server/archives` | Archive storage directory                       |
| `ARCHIVE_RETENTION_DAYS` | `30`                          | Auto-cleanup after this many days (0 = forever) |

### Audit Settings

| Variable               | Default                    | Description                                |
| ---------------------- | -------------------------- | ------------------------------------------ |
| `AUDIT_ENABLED`        | `true`                     | Enable audit logging                       |
| `AUDIT_PATH`           | `../.working/server/audit` | Audit log directory                        |
| `AUDIT_RETENTION_DAYS` | `30`                       | Cleanup logs older than this (0 = forever) |

### Parallel Execution

| Variable             | Default      | Description                                        |
| -------------------- | ------------ | -------------------------------------------------- |
| `EXECUTION_MODE`     | `sequential` | Execution mode: `sequential` or `parallel`         |
| `MAX_PARALLEL_TOOLS` | `4`          | Maximum concurrent tool executions (0 = unlimited) |

### Safety Limits

These prevent tools from creating outputs that could crash the application.

| Variable                     | Default     | Description                       |
| ---------------------------- | ----------- | --------------------------------- |
| `SAFETY_MAX_PIVOT_COLUMNS`   | `1000`      | Max unique values in pivot column |
| `SAFETY_MAX_CROSS_JOIN_ROWS` | `10000000`  | Max rows from cross join          |
| `SAFETY_MAX_UNPIVOT_ROWS`    | `100000000` | Max rows after unpivot            |

### Connection Store

| Variable                    | Default                               | Description                          |
| --------------------------- | ------------------------------------- | ------------------------------------ |
| `CONNECTION_ENCRYPTION_KEY` | `""`                                  | Fernet key for credential encryption |
| `CONNECTION_STORE_PATH`     | `../.working/server/connections.json` | Connection storage file              |

Generate an encryption key with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

## Data Connections

Server can connect to external databases. Connections are stored encrypted in `connections.json`.

### Supported Database Types

- PostgreSQL
- MySQL
- SQLite
- Microsoft SQL Server

### Connection API

Use the REST API to manage connections:

```bash
# Create connection
curl -X POST http://localhost:25811/api/connections/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my_postgres",
    "type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "analytics",
    "username": "readonly",
    "password": "secret"
  }'

# List connections (credentials never exposed)
curl http://localhost:25811/api/connections/

# Test connection
curl -X POST http://localhost:25811/api/connections/{id}/test
```

Connection credentials stay on Server and are never transmitted to Hub or Studio.

## For Developers

For architecture details, development setup, and how to add new tools, see:
- [Developer Documentation](https://sigilweaver.app/loom/docs/developer/contributing/server)
- [CONTRIBUTING.md](CONTRIBUTING.md) (quick reference)

## License

AGPLv3 - See [LICENSE](LICENSE.md).
