# Sigilweaver Server

The execution engine that powers Sigilweaver workflows.

## What is Server?

Server is the component that actually runs your data pipelines. When you click "Execute" in Studio, your workflow is sent to Server, which processes your data and returns results.

Server is built on:
- **[FastAPI](https://fastapi.tiangolo.com/)** - A modern Python web framework
- **[Polars](https://pola.rs/)** - A blazing-fast DataFrame library with lazy evaluation

## Key Features

### Lazy Evaluation

Server doesn't process data row-by-row. Instead, it builds an optimized query plan and executes it all at once. This means you can work with datasets larger than your RAM - Server only loads what it needs.

### Tool-Based Architecture

Every operation in Sigilweaver (filter, join, aggregate, etc.) is a "tool". Server has a registry of tools that it uses to execute workflows. This makes it easy to add new capabilities.

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
uv run uvicorn app.main:app --port 8000
```

### With the Dev Script

```bash
./scripts/dev.py --server
```

Server runs on port **8000** by default.

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/workflow/execute` | Execute a workflow and return results |
| `POST /api/workflow/tool/schema` | Get output schema without running the workflow |
| `POST /api/workflow/tool/metadata` | Get column metadata for a tool |
| `GET /api/health/` | Health check endpoint |
| `GET /api/connections/status` | List configured data connections |

## Configuration

Server is configured via environment variables (case-insensitive):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 58000 | HTTP server port (dev script uses 8000) |
| `HOST` | 0.0.0.0 | Server bind address |
| `LOG_LEVEL` | info | Logging verbosity |
| `AUTH_MODE` | disabled | Authentication mode: `disabled`, `ephemeral`, `static`, `hub` |
| `CACHE_ENABLED` | true | Enable execution caching |
| `CACHE_PATH` | ./cache | Cache storage directory |

## Data Connections

Server can connect to external data sources. Connections are configured in `connections.json`:

```json
{
  "my_postgres": {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "analytics",
    "user": "readonly"
  }
}
```

Connection credentials stay on Server and are never transmitted to Hub or Studio.

## For Developers

For architecture details, development setup, and how to add new tools, see:
- [Developer Documentation](https://docs.sigilweaver.app/developer/contributing/backend)
- [CONTRIBUTING.md](CONTRIBUTING.md) (quick reference)

## License

AGPLv3 - See [LICENSE](LICENSE).
