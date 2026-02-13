---
sidebar_position: 1
---

# API Endpoints

REST API reference for the backend.

The backend runs on `http://127.0.0.1:25811` by default. All API routes are prefixed with `/api`.

## Health

### GET /api/health/

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.3.0",
  "message": "Sigilweaver Backend is running",
  "python_version": "3.11.5",
  "platform": "Linux 6.5.0",
  "polars_version": "1.20.0",
  "max_preview_rows": 10000
}
```

Used by the frontend to verify the backend is running and compatible.

---

## Workflow

The main execution endpoints. These power the canvas preview and final output generation.

### POST /api/workflow/execute

Execute entire workflow or up to a specific tool.

**Request:**
```json
{
  "workflow": { /* Workflow object */ },
  "target_tool_id": "tool-123",  // optional
  "preview_limit": 100           // optional
}
```

**Notes:**
- `target_tool_id`: Execute only up to this tool (partial execution for debugging)
- `preview_limit`: Rows returned per output, clamped to server's `max_preview_rows`

### POST /api/workflow/tool/execute

Execute a single tool and its dependencies.

**Request:**
```json
{
  "tool_id": "tool-123",
  "workflow": { /* Workflow object */ },
  "preview_limit": 100  // optional
}
```

This is what powers the preview panel when you click on a node. Upstream dependencies are automatically executed first.

### POST /api/workflow/tool/schema

Get output schema for a tool without full execution.

**Request:**
```json
{
  "tool_id": "tool-123",
  "workflow": { /* Workflow object */ }
}
```

**Response:**
```json
{
  "columns": [
    { "name": "id", "dtype": "Int64" },
    { "name": "name", "dtype": "Utf8" }
  ]
}
```

Used to populate column dropdowns and validate connections.

### POST /api/workflow/tool/metadata

Get metadata for autocomplete suggestions.

**Request:**
```json
{
  "tool_id": "tool-123",
  "workflow": { /* Workflow object */ },
  "socket_id": "input_0"  // optional
}
```

**Response:**
```json
{
  "columns": ["id", "name", "value"],
  "functions": {
    "table_level": ["pl.col", "pl.lit", "pl.when"],
    "column_methods": {
      "all": ["alias", "cast", "fill_null"],
      "string": ["str.contains", "str.len"],
      "numeric": ["sum", "mean", "max"]
    }
  }
}
```

Used by Monaco editor for autocomplete in Formula and Filter tools.

### POST /api/workflow/preview_all

Execute workflow and return preview data for all tools.

**Request:**
```json
{
  "workflow": { /* Workflow object */ },
  "preview_limit": 100  // optional
}
```

**Response:**
```json
{
  "tool-123": {
    "outputs": {
      "output_0": { /* preview data */ }
    }
  },
  "tool-456": {
    "outputs": {
      "output_0": { /* preview data */ }
    }
  }
}
```

More efficient than calling `/tool/execute` multiple times because upstream tools are only executed once. Used when loading a workflow or when data sources change.

### POST /api/workflow/tool/profile

Profile columns for a tool's input data. Computes statistical profiles for data quality analysis.

**Request:**
```json
{
  "tool_id": "tool-123",
  "workflow": { /* Workflow object */ },
  "socket_id": "input_0",
  "columns": ["name", "age"],  // optional, null = all
  "metrics": ["count", "null_count", "unique_count"]  // optional, null = all
}
```

**Available Metrics:**
- Basic: `count`, `null_count`, `null_percent`, `unique_count`
- Numeric: `min`, `max`, `mean`, `median`, `std`, `min_values`, `max_values`
- String quality: `empty_count`, `whitespace_leading`, `whitespace_trailing`, `contains_linebreaks`, `contains_non_ascii`
- Distribution: `top_values`

**Response:**
```json
{
  "columns": {
    "name": {
      "count": 1000,
      "null_count": 5,
      "null_percent": 0.5,
      "unique_count": 950,
      "top_values": [["John", 15], ["Jane", 12]]
    }
  }
}
```

:::note
This endpoint collects the FULL dataset (not preview limited) to compute accurate statistics. Use sparingly on large datasets.
:::

### POST /api/workflow/cache/clear

Clear cache for a specific workflow.

**Request:**
```json
{
  "workflow_id": "abc-123"
}
```

**Response:**
```json
{
  "status": "cleared",
  "workflow_id": "abc-123"
}
```

### POST /api/workflow/preview_code

Generate Python code for a workflow.

**Request:**
```json
{
  "workflow": { /* Workflow object */ }
}
```

**Response:**
```json
{
  "code": "import polars as pl\n\ndf = pl.read_csv('data.csv')\ndf = df.filter(pl.col('value') > 0)\n..."
}
```

The generated code is standalone Python using Polars. Users can copy it and run it without Sigilweaver.

---

## Data Source

Endpoints for inspecting and previewing data files before adding them as sources.

### POST /api/datasource/inspect

Inspect a file and return schema information.

**Request:**
```json
{
  "source": "/path/to/file.csv",
  "source_type": "csv",     // optional, auto-detected
  "config": {
    "delimiter": ",",
    "has_header": true
  }
}
```

**Response:**
```json
{
  "data_schema": {
    "columns": [
      { "name": "id", "dtype": "Int64" },
      { "name": "name", "dtype": "Utf8" }
    ],
    "total_rows": 10000
  },
  "validation": {
    "errors": [],
    "warnings": []
  }
}
```

### POST /api/datasource/preview

Preview data from a file.

**Request:**
```json
{
  "source": "/path/to/file.csv",
  "source_type": "csv",     // optional
  "config": { },
  "options": {
    "max_rows": 100,
    "offset": 0,
    "columns": ["id", "name"]  // optional subset
  }
}
```

**Response:**
```json
{
  "columns": ["id", "name"],
  "data": [
    [1, "Alice"],
    [2, "Bob"]
  ],
  "total_rows": 10000,
  "preview_rows": 100
}
```

### GET /api/datasource/supported

List supported file types.

**Response:**
```json
{
  "source_types": ["avro", "csv", "excel", "ipc", "json", "ods", "parquet", "yxdb", "postgresql", "mysql", "sqlite", "mssql"],
  "file_extensions": [".avro", ".csv", ".tsv", ".tab", ".txt", ".xlsx", ".xls", ".xlsb", ".ods", ".json", ".jsonl", ".ndjson", ".parquet", ".yxdb", ".arrow", ".ipc", ".feather"]
}
```

---

## Connections

Server-managed database connection endpoints. These allow administrators to configure shared database connections with encrypted credentials.

:::note Availability
Connection endpoints require `CONNECTION_ENCRYPTION_KEY` to be configured. Without it, endpoints return 503.
:::

### GET /api/connections/status

Check if server connections are enabled.

**Response:**
```json
{
  "enabled": true,
  "connectionCount": 3
}
```

### GET /api/connections/

List all server-managed connections.

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Production Database",
    "type": "postgresql",
    "owner": "server",
    "host": "db.example.com",
    "port": 5432,
    "database": "analytics",
    "createdAt": "2025-08-01T10:00:00Z",
    "updatedAt": "2025-08-01T10:00:00Z"
  }
]
```

Note: Credentials (username/password) are never returned. The `owner` field is always `"server"` for server-managed connections.

### GET /api/connections/\{connection_id\}

Get a specific connection by ID.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Production Database",
  "type": "postgresql",
  "owner": "server",
  "host": "db.example.com",
  "port": 5432,
  "database": "analytics",
  "createdAt": "2025-08-01T10:00:00Z",
  "updatedAt": "2025-08-01T10:00:00Z"
}
```

### POST /api/connections/

Create a new server-managed connection.

**Request:**
```json
{
  "name": "Production Database",
  "type": "postgresql",
  "host": "db.example.com",
  "port": 5432,
  "database": "analytics",
  "username": "readonly_user",
  "password": "secret123"
}
```

**Response:** Same as GET, with status 201.

Credentials are encrypted with Fernet before storage. Duplicate names return 409.

### PUT /api/connections/\{connection_id\}

Update an existing connection. All fields are optional.

**Request:**
```json
{
  "name": "Updated Name",
  "host": "new-host.example.com"
}
```

Leave `username`/`password` blank to keep existing credentials.

**Response:** Same as GET.

### DELETE /api/connections/\{connection_id\}

Delete a connection.

**Response:** 204 No Content

### POST /api/connections/\{connection_id\}/test

Test a connection by attempting to connect to the database.

**Response:**
```json
{
  "success": true,
  "message": "Successfully connected to Production Database",
  "latencyMs": 42
}
```

Or on failure:
```json
{
  "success": false,
  "message": "Connection failed: could not connect to server"
}
```

Error messages are sanitized to remove any leaked credentials.

---

## Archive

Workflow execution history (audit trail).

### GET /api/archive/list

List archived executions.

**Query Parameters:**
- `limit`: Maximum archives to return
- `start_date`: Filter from date (YYYY-MM-DD)
- `end_date`: Filter until date (YYYY-MM-DD)

**Response:**
```json
{
  "archives": [
    {
      "path": "2025-01-15/14-30-00_MyWorkflow",
      "workflow_name": "MyWorkflow",
      "executed_at": "2025-01-15T14:30:00Z",
      "status": "success",
      "tool_count": 5
    }
  ],
  "total": 1
}
```

### GET /api/archive/detail/\{archive_path\}

Get full archive details.

**Response:**
```json
{
  "workflow": { /* original workflow JSON */ },
  "execution_log": {
    "started_at": "2025-01-15T14:30:00Z",
    "completed_at": "2025-01-15T14:30:02Z",
    "tools": [
      {
        "tool_id": "tool-123",
        "status": "success",
        "duration_ms": 150
      }
    ]
  }
}
```

### POST /api/archive/cleanup

Delete old archives.

**Request:**
```json
{
  "retention_days": 30
}
```

**Response:**
```json
{
  "deleted_count": 15,
  "message": "Deleted 15 archives older than 30 days"
}
```

### GET /api/archive/status

Get archive configuration.

**Response:**
```json
{
  "enabled": true,
  "archive_path": "/path/to/archives",
  "retention_days": 90
}
```

---

## Cache

Manage the blocking tool cache (outputs of sort, summarize, join, database queries).

### POST /api/cache/clear

Clear cache for a specific workflow.

**Request:**
```json
{
  "workflow_id": "abc-123"
}
```

**Response:**
```json
{
  "status": "cleared",
  "workflow_id": "abc-123"
}
```

### POST /api/cache/close

Notify that a workflow has been closed. Clears cache if `CACHE_CLEAR_ON_CLOSE=true`.

**Request:**
```json
{
  "workflow_id": "abc-123"
}
```

### POST /api/cache/close/batch

Close multiple workflows efficiently (used on app shutdown).

**Request:**
```json
{
  "workflow_ids": ["abc-123", "def-456"]
}
```

**Response:**
```json
{
  "status": "cleared_on_close",
  "cleared_count": 2,
  "workflow_ids": ["abc-123", "def-456"]
}
```

### GET /api/cache/stats

Get global cache statistics.

**Response:**
```json
{
  "enabled": true,
  "workflow_count": 5,
  "file_count": 23,
  "total_size_bytes": 104857600,
  "total_size_mb": 100.0,
  "total_size_gb": 0.1,
  "quota_gb": 20.0,
  "retention_days": 7
}
```

### POST /api/cache/maintenance

Trigger TTL cleanup and LRU eviction manually.

**Response:**
```json
{
  "ttl_files_deleted": 5,
  "lru_files_evicted": 3,
  "message": "Maintenance complete: 5 TTL deletions, 3 LRU evictions"
}
```

---

## Files

Browse files within allowed paths. In Hub mode, requires a browse token.

:::note Availability
File browsing is controlled by `RESTRICT_FILE_ACCESS` and `ALLOWED_FILE_PATHS` settings. In Hub mode, access is determined by filesystem connection grants.
:::

### GET /api/files/roots

List browsable root directories.

**Response:**
```json
[
  { "path": "/data/shared", "read_only": false },
  { "path": "/data/exports", "read_only": true }
]
```

### GET /api/files/list

List directory contents.

**Query Parameters:**
- `path`: Directory path to list

**Response:**
```json
{
  "path": "/data/shared",
  "entries": [
    {
      "name": "report.csv",
      "path": "/data/shared/report.csv",
      "is_dir": false,
      "size": 1024,
      "modified": "2025-01-15T10:30:00Z",
      "extension": "csv"
    },
    {
      "name": "archive",
      "path": "/data/shared/archive",
      "is_dir": true,
      "size": null,
      "modified": "2025-01-10T08:00:00Z",
      "extension": null
    }
  ],
  "read_only": false
}
```

### GET /api/files/stat

Get file or directory information.

**Query Parameters:**
- `path`: File or directory path

**Response:**
```json
{
  "path": "/data/shared/report.csv",
  "exists": true,
  "is_file": true,
  "is_dir": false,
  "size": 1024,
  "modified": "2025-01-15T10:30:00Z",
  "extension": "csv",
  "read_only": false
}
```

---

## Polars

Endpoints for Polars introspection (autocomplete support).

### GET /api/polars/functions

Get available Polars functions for autocomplete.

**Response:**
```json
{
  "polars_version": "0.20.10",
  "table_level": ["pl.col", "pl.lit", "pl.when", "pl.concat"],
  "column_methods": {
    "all": ["alias", "cast", "fill_null", "is_null"],
    "string": ["str.contains", "str.replace", "str.len"],
    "numeric": ["sum", "mean", "max", "min"],
    "datetime": ["dt.year", "dt.month", "dt.day"]
  }
}
```

This introspects the installed Polars library, so it automatically supports new functions when Polars is upgraded.

### POST /api/polars/functions/refresh

Clear cached function list.

**Response:**
```json
{
  "status": "ok",
  "message": "Cache cleared, next request will re-introspect"
}
```

---

## Error Responses

All endpoints return consistent error responses:

**400 Bad Request** - Validation or tool configuration error:
```json
{
  "detail": "Validation error: Column 'foo' not found"
}
```

**500 Internal Server Error** - Execution or unexpected error:
```json
{
  "detail": "Execution error: Failed to read file"
}
```

**503 Service Unavailable** - Feature disabled:
```json
{
  "detail": "Workflow archiving is disabled in configuration"
}
```

---

## OpenAPI Docs

The backend includes auto-generated API documentation:

- **Swagger UI**: `http://127.0.0.1:25811/docs`
- **ReDoc**: `http://127.0.0.1:25811/redoc`

These are useful for exploring the API interactively during development.

---

Next: [Tool Registry](./tool-registry) for tool type definitions.
