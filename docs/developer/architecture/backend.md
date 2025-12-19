---
sidebar_position: 3
---

# Backend Architecture

The backend is a Python service that handles all data processing. It loads files, executes tool transformations, and returns results to the frontend. The frontend never touches actual data—it works with schemas and previews.

## Technology Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Framework | FastAPI | Async, fast, great DX, OpenAPI docs |
| Data | Polars | Lazy evaluation, blazing performance |
| Validation | Pydantic | Type-safe request/response models |
| Packaging | PyInstaller | Single-file executable distribution |

## Directory Structure

```
backend/app/
├── main.py              # FastAPI entrypoint
├── config.py            # Settings and configuration
│
├── api/                 # HTTP layer
│   ├── router.py        # Route aggregation
│   ├── routes/          # Endpoint handlers
│   │   ├── health.py    # Health check
│   │   ├── schema.py    # Schema inference
│   │   ├── preview.py   # Data preview
│   │   ├── execute.py   # Workflow execution
│   │   └── connections.py  # Connection CRUD
│   └── models/          # Pydantic schemas
│       ├── workflow.py  # Workflow, Tool, Wire
│       ├── common.py    # DataSchema, DataPreview
│       └── connections.py  # Connection request/response
│
├── domain/              # Business logic
│   ├── tools/           # Tool implementations
│   │   ├── base.py      # BaseTool ABC
│   │   ├── registry.py  # Tool registry + decorator
│   │   ├── register.py  # Imports all tools
│   │   └── implementations/
│   │       ├── input.py
│   │       ├── filter.py
│   │       ├── select.py
│   │       └── ...
│   ├── execution/       # Workflow execution
│   │   ├── executor.py  # Main executor
│   │   ├── graph.py     # Dependency resolution
│   │   └── cache.py     # Blocking tool cache
│   ├── workflow/        # Workflow utilities
│   │   └── archive.py   # Audit archiving
│   ├── datasources/     # File type handlers
│   │   ├── factory.py   # Datasource factory
│   │   ├── csv.py       # CSV loader
│   │   ├── database.py  # Database query loader
│   │   └── parquet.py   # Parquet loader
│   └── connections/     # Credential management
│       ├── models.py    # Connection data models
│       └── store.py     # Encrypted credential store
│
├── middleware/          # Request middleware
│   └── audit.py         # Audit logging
│
└── utils/               # Shared utilities
    ├── errors.py        # Custom exceptions
    └── type_mapping.py  # Polars ↔ JSON type conversion
```

## Tool System

The heart of the backend. Every transformation (Filter, Select, Join, etc.) is a Tool.

### BaseTool Interface

All tools inherit from `BaseTool`:

```python
class BaseTool(ABC):
    @abstractmethod
    async def execute(
        self, 
        config: dict[str, Any], 
        inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """Execute tool logic. Returns LazyFrames."""
        pass
    
    @abstractmethod
    async def get_output_schema(
        self, 
        config: dict[str, Any], 
        input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """Return schema without execution (for UI dropdowns)."""
        pass
    
    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate configuration. Return error messages."""
        return []
```

Key design decisions:

1. **Async by default**: All methods are async, even if they don't need it. Consistency matters.
2. **LazyFrame in, LazyFrame out**: Keep execution lazy. Never call `.collect()` unless you must.
3. **Socket-based I/O**: Tools can have multiple inputs/outputs. The dict key is the socket ID.
4. **Schema without execution**: `get_output_schema` lets the UI know what columns will exist without running the pipeline.

### Tool Registry

Tools self-register using a decorator:

```python
# backend/app/domain/tools/implementations/filter.py
from app.domain.tools.registry import register_tool

@register_tool("Filter")  # This string must match frontend tool type
class FilterTool(BaseTool):
    async def execute(self, config, inputs):
        lf = inputs["input"]
        expression = config.get("expression", "")
        # ... filter logic
        return {"output-true": true_result, "output-false": false_result}
```

The registry is a simple class-level dict:

```python
class ToolRegistry:
    _tools: dict[str, Type[BaseTool]] = {}
    
    @classmethod
    def register(cls, tool_type: str, tool_class: Type[BaseTool]):
        cls._tools[tool_type] = tool_class
    
    @classmethod
    def get(cls, tool_type: str) -> BaseTool:
        return cls._tools[tool_type]()
```

All tool implementations are imported in `register.py`, which triggers the decorators:

```python
# backend/app/domain/tools/register.py
from app.domain.tools.implementations import (
    input,
    output,
    filter,
    select,
    sort,
    formula,
    join,
    union,
    summarize,
)
```

And `register.py` is imported in `main.py`:

```python
# backend/app/main.py
import app.domain.tools.register  # noqa: F401
```

This ensures all tools are registered before any API request.

## Execution Engine

The `WorkflowExecutor` orchestrates tool execution:

### Execution Graph

Before executing, we build a dependency graph:

```python
class ExecutionGraph:
    def __init__(self, workflow: Workflow):
        self.workflow = workflow
        self.dependencies = self._build_dependencies()
    
    def get_execution_order(self, target_tool_id: str = None) -> list[str]:
        """Topological sort of dependencies."""
        # Returns tool IDs in order they should execute
```

This handles:
- Determining which tools need to run for a given target
- Detecting cycles (which should be caught by frontend, but we verify)
- Computing dependency depth for parallel execution (future)

### Execution Flow

1. Build execution graph from workflow
2. Initialize cache (if enabled) for the workflow
3. Determine execution order (topological sort)
4. For each tool in order:
   - Compute lineage hash (always, even for non-cacheable tools)
   - Check cache for blocking tools (Sort, Join, Summarize)
   - If cache hit: use cached output, skip execution
   - If cache miss: execute tool, cache output if blocking
   - Store outputs for downstream tools
5. Collect results for target tool (preview or output)

See [Caching System](./caching.md) for details on how blocking tool outputs are cached.

```python
async def execute_workflow(
    self,
    workflow: Workflow,
    target_tool_id: str | None = None,
    preview_limit: int | None = None,
) -> dict[str, Any]:
    graph = ExecutionGraph(workflow)
    execution_order = graph.get_execution_order(target_tool_id)
    
    for tool_id in execution_order:
        tool = self._get_tool(tool_id)
        inputs = self._gather_inputs(tool_id)
        outputs = await tool.execute(tool.config, inputs)
        self.results[tool_id] = outputs
    
    # Collect and return target results
    return self._collect_results(target_tool_id, preview_limit)
```

## API Endpoints

### Health Check

```
GET /api/health/
```

Returns service status. Used by frontend to verify backend is running.

### Schema

```
POST /api/workflow/tool/schema
{
  "tool_id": "abc123",
  "workflow": { ... }
}
```

Returns output schema for a tool without executing. Used to populate column dropdowns in tool configuration.

### Preview / Execute Tool

```
POST /api/workflow/tool/execute
{
  "tool_id": "abc123", 
  "workflow": { ... },
  "preview_limit": 100
}
```

Executes workflow up to target tool, returns sample rows. This is where `.collect()` happens.

### Execute Workflow

```
POST /api/workflow/execute
{
  "workflow": { ... }
}
```

Full workflow execution. Output tools write files, execution metrics returned.

## Polars Lazy Evaluation

This is why Sigilweaver can handle large datasets efficiently.

**Bad** (eager evaluation):
```python
df = pl.read_csv("huge.csv")  # Loads entire file into memory
df = df.filter(pl.col("age") > 30)  # Creates new DataFrame
df = df.select(["name", "age"])  # Creates another DataFrame
```

**Good** (lazy evaluation):
```python
lf = pl.scan_csv("huge.csv")  # Returns immediately, nothing loaded
lf = lf.filter(pl.col("age") > 30)  # Builds query plan
lf = lf.select(["name", "age"])  # Adds to query plan
result = lf.head(100).collect()  # NOW it reads file, only what's needed
```

Tools operate on LazyFrames. We only `.collect()` when:
- Returning preview data
- Writing output files
- Schema inference requires it (some cases)

## Datasources

The `datasources/` module handles file loading:

```python
class DatasourceFactory:
    @staticmethod
    def create(path: str) -> Datasource:
        ext = Path(path).suffix.lower()
        if ext == ".csv":
            return CSVDatasource(path)
        elif ext in [".parquet", ".pq"]:
            return ParquetDatasource(path)
        raise ValueError(f"Unsupported file type: {ext}")
```

Each datasource implements:
- `scan()` → LazyFrame (lazy load)
- `infer_schema()` → DataSchema (column names and types)

## Connections

The `connections/` module manages secure database credential storage.

### Connection Ownership

Connections have two ownership modes:

| Owner | Storage | Access |
|-------|---------|--------|
| `client` | Electron safeStorage (OS keychain) | Single user, single machine |
| `server` | Fernet-encrypted JSON on server | All users with server access |

The frontend handles client connections; the backend handles server connections.

### ConnectionStore

Server connections are managed by `ConnectionStore`:

```python
class ConnectionStore:
    def __init__(self, storage_path: Path, encryption_key: str):
        self._fernet = Fernet(encryption_key.encode())
        self._connections: dict[str, StoredConnection] = {}
        
    def create_connection(self, input: CreateConnectionInput) -> ConnectionInfo:
        # Encrypt credentials before storage
        encrypted = self._encrypt_credentials(input.username, input.password)
        # ... store connection
        
    def resolve_connection(self, connection_id: str) -> ResolvedConnection:
        # Decrypt credentials for execution only
        # WARNING: Returns sensitive data - internal use only
```

Key security properties:
- **Encryption at rest**: Credentials encrypted with Fernet (AES-128-CBC + HMAC)
- **Opaque to users**: API never returns credentials, only connection metadata
- **Decryption only during execution**: `resolve_connection()` is called only when building connection URIs

### Executor Integration

During workflow execution, the executor resolves server connections:

```python
async def execute_workflow(self, workflow: Workflow, ...):
    # For each database Input tool with owner="server"
    if tool.config.get("owner") == "server":
        connection_id = tool.config.get("connectionId")
        resolved = connection_store.resolve_connection(connection_id)
        uri = build_uri(resolved)
        # Pass URI to DatabaseDataSource
```

This ensures credentials never leave the server - they're resolved just-in-time during execution.

## Error Handling

Custom exceptions in `utils/errors.py`:

```python
class ToolError(Exception):
    """Error in tool execution"""

class ExecutionError(Exception):
    """Error in workflow execution"""

class ValidationError(Exception):
    """Invalid configuration or workflow"""
```

These bubble up through the API layer and get converted to appropriate HTTP responses.

## Testing

Backend tests focus on:

1. **Tool execution**: Each tool has tests verifying transformations
2. **Schema propagation**: Verify output schemas are computed correctly
3. **Execution order**: Graph building and topological sort
4. **Edge cases**: Missing inputs, invalid config, type mismatches

See [Backend Testing](../testing/backend) for details.

---

Next: [Architectural Decisions](./decisions) or [Adding Tools](../contributing/adding-tools).
