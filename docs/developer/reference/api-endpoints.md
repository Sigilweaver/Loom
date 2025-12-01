---
sidebar_position: 1
---

# API Endpoints

REST API reference for the backend.

The backend runs on `http://127.0.0.1:8000` by default. All API routes are prefixed with `/api`.

## Health

### GET /api/health/

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.3.0",
  "message": "SigilWeaver Backend is running",
  "python_version": "3.11.5",
  "platform": "Linux 6.5.0",
  "polars_version": "0.20.10",
  "max_preview_rows": 1000
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

The generated code is standalone Python using Polars—users can copy it and run it without Sigilweaver.

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
  "source_types": ["csv", "tsv"],
  "file_extensions": [".csv", ".tsv"]
}
```

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

- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

These are useful for exploring the API interactively during development.

---

Next: [Tool Registry](./tool-registry) for tool type definitions.
