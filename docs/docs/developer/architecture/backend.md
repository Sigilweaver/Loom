---
sidebar_position: 4
title: Server Architecture
---

# Server Architecture

The Server is a Python service that does all of Loom's data processing. It reads files and databases, runs tools, and returns schemas, previews and results to Studio. Studio never sees a full dataset.

## Technology stack

| Layer | Technology | Why |
| ----- | ---------- | --- |
| Framework | FastAPI | Async, typed, generates OpenAPI docs |
| Data | Polars | Lazy evaluation and speed |
| Validation | Pydantic v2 | Typed request, response and tool config models |
| Database reads | connectorx via `pl.read_database_uri` | Fast reads from PostgreSQL, MySQL, SQLite and SQL Server |
| Packaging | PyInstaller | Single-binary distribution for desktop builds |

## Directory structure

```
server/app/
|-- main.py                  FastAPI app, startup checks, middleware
|-- config.py                Settings (environment variables)
|-- api/
|   |-- router.py            Aggregates the routers below under /api
|   |-- routes/              health, workflow, datasource, connections, files,
|   |                        cache, archive, polars, ai
|   |-- models/              Pydantic request and response models
|   `-- exception_handlers.py
|-- domain/
|   |-- registry.py          The single list of readable file formats and databases
|   |-- tools/
|   |   |-- base.py          BaseTool
|   |   |-- registry.py      ToolRegistry and @register_tool
|   |   |-- register.py      Imports every tool so the decorators run
|   |   |-- sockets.py       Socket ID constants (mirrored in Studio)
|   |   |-- implementations/ One file per tool (13 tools)
|   |   |-- loaders/         Execution-time readers for each format
|   |   |-- expr_builder.py  Shared Polars expression builders
|   |   `-- columns.py
|   |-- datasources/         Inspect and preview support for each format
|   |-- execution/           executor, planner, graph, cache, cache_manager, safety
|   |-- connections/         store, resolver, URI builder, read-only query policy
|   |-- hub/                 Hub client and registration heartbeat
|   |-- profiling/           Column profiling
|   `-- workflow/            Python code generator, execution archive
|-- middleware/              auth, audit, rate_limit
`-- utils/                   errors, expression parsing, security, logging, type mapping
```

## Tool system

Every transformation is a **tool**: a class registered under a type name.

### Socket constants

Sockets connect tools. Their IDs are constants on both sides:

```python
# server/app/domain/tools/sockets.py
class CommonSockets:
    INPUT = "input"
    OUTPUT = "output"

class FilterSockets:
    INPUT = "input"
    OUTPUT_TRUE = "output-true"
    OUTPUT_FALSE = "output-false"

class JoinSockets:
    INPUT_LEFT = "input-left"
    INPUT_RIGHT = "input-right"
    OUTPUT_LEFT = "output-left"
    OUTPUT_MATCH = "output-match"
    OUTPUT_RIGHT = "output-right"
```

`studio/src/domain/workflow/constants/socketIds.ts` mirrors them. Contract tests on both sides fail if they drift.

### BaseTool

```python
class BaseTool(ABC):
    engine: str = DEFAULT_ENGINE          # "core/polars"

    @abstractmethod
    async def execute(self, config, inputs) -> dict[str, pl.LazyFrame]: ...

    @abstractmethod
    async def get_output_schema(self, config, input_schemas) -> dict[str, DataSchema]: ...

    async def validate_config(self, config) -> list[str]: ...   # defaults to the config model

    @classmethod
    def config_model(cls) -> type[BaseModel] | None: ...       # typed config, if any

    def is_blocking(self, config=None) -> bool: ...            # needs all rows before output
    def should_cache(self, config) -> bool: ...                # defaults to is_blocking()
    def cache_keys(self, config) -> dict: ...                  # config fields that affect output
    def to_python_code(self, tool_id, config, input_vars): ... # code generation
```

Design rules:

1. **Async everywhere.** Consistency beats saving a few keystrokes.
2. **LazyFrame in, LazyFrame out.** Do not call `.collect()` in a tool unless you must. The executor materializes results.
3. **Sockets carry data.** The dict key is the socket ID. Inputs may be a list when the socket accepts many wires.
4. **Schema without execution.** `get_output_schema` lets Studio fill dropdowns without running the workflow.
5. **Typed configs.** Tools declare a Pydantic model through `config_model()`. `GET /api/workflow/tool/{type}/schema` returns its JSON schema.

### The registry

```python
# server/app/domain/tools/implementations/filter.py
@register_tool("Filter")            # must match the type name in Studio
class FilterTool(BaseTool):
    ...
```

`ToolRegistry` maps a type name to a class. `register` also stores an engine-qualified key such as `core/polars::Filter`. `ToolRegistry.get(type, engine=...)` tries the qualified key first.

`register.py` imports every tool class, which runs the decorators. `main.py` imports `register.py` for that side effect, so every tool is registered before the first request:

```python
import app.domain.tools.register as _register  # noqa: F401
```

### Expression handling

Filter and Calculate accept Polars expression strings. `utils/expression.py` is an allowlist sandbox. It parses the string with `ast` and rejects anything outside a list of allowed node types, any name other than `pl`, `True`, `False` and `None`, dunder access, and format specifiers in f-strings. Only names in `PL_ALLOWED_NAMES` are reachable as `pl.<name>`, and methods must come from an allowed set, so file and network I/O, `pl.selectors`, `pl.Series` and `pl.sql_expr` are rejected. The expression is then evaluated against a restricted `pl` namespace, not the real module. Attribute access on non-Polars values is blocked at run time, and literal repeat, power and `%` formatting are bounded. This is defense in depth, not a substitute for trust in the workflow author. Treat workflow files as code. See the [Security Model](../../admin/security.md).

## Execution engine

| Component | File | Responsibility |
| --------- | ---- | -------------- |
| `ExecutionPlanner` | `execution/planner.py` | Validates the graph and builds an immutable `ExecutionPlan` (dependency order, levels for parallel runs) |
| `CacheManager` | `execution/cache_manager.py` | Lineage hashes and cache decisions |
| `BlockingToolCache` | `execution/cache.py` | Parquet files on disk |
| `WorkflowExecutor` | `execution/executor.py` | Runs the plan, tool by tool or level by level |
| Safety checks | `execution/safety.py` | Limits on pivot width, cross joins and unpivot size |

### Executor entry points

| Method | Used by |
| ------ | ------- |
| `execute_workflow(workflow, target_tool_id, preview_limit, force_refresh)` | `POST /api/workflow/execute` |
| `execute_single_tool(workflow, tool_id, socket_id, preview_limit, force_refresh)` | `POST /api/workflow/tool/execute` |
| `preview_all_tools(workflow, preview_limit, force_refresh)` | `POST /api/workflow/preview_all` |
| `get_tool_schema`, `get_tool_metadata`, `profile_columns` | schema, metadata and profile endpoints |

`execute_workflow` runs every tool in the plan, including Output tools, for **Run**. Preview All, single-tool previews, schema inspection and profiling evaluate the necessary plan with Output writers disabled. Preview and inspection cannot create or overwrite output files.

### Execution flow

1. Build the plan and validate the graph and each tool's config.
2. Create a `CacheManager` for the workflow. With `force_refresh` it clears the cache first.
3. Run the plan under `MAX_EXECUTION_TIME_SECONDS`, sequentially or in parallel (`EXECUTION_MODE`, default `parallel`, up to `MAX_PARALLEL_TOOLS` at once). Parallel mode runs tools of the same level together.
4. For each tool: resolve its engine, compute its lineage hash, return the cached result if the tool should be cached and a hit exists, otherwise execute it, store it in the cache if needed and record the hash.
5. Collect the target tool's outputs, limited to the preview size, and write an archive entry if archiving is on.

Recording the hash for every tool, even non-cached ones, matters. Downstream hashes include upstream hashes. See [Backend Caching](./caching.md).

### Errors

`utils/errors.py` defines a small hierarchy under `LoomError`: `ValidationError`, `DataSourceError`, `ToolError` (with `ToolConfigError` and `ToolRuntimeError`), and `ExecutionError` (with `SafetyLimitExceededError` and `ExecutionTimeoutError`). Exception handlers in `api/exception_handlers.py` map them to HTTP responses. Unexpected errors get an error ID that is logged and returned, so a user report can be matched to a log line.

## Formats and data sources

`domain/registry.py` is the single source of truth for what Loom can read. A `FormatDescriptor` has the type name, its extensions, a data source class and a flag for a custom loader. Two factories derive everything from it:

- `DataSourceFactory` (`datasources/`): inspection and preview.
- `LoaderFactory` (`tools/loaders/`): execution. Most formats use `GenericLoader` with a `LoaderSpec`. JSON, QVD and YXDB use custom loaders. Databases use `DatabaseLoader`.

`tests/test_reader_parity.py` fails if the two disagree. See [Adding Data Formats](../contributing/adding-formats.md).

Readable formats: Avro, CSV (`.csv`, `.tsv`, `.tab`, `.txt`), Excel (`.xlsx`, `.xls`, `.xlsb`), Arrow IPC, JSON and NDJSON, ODS, Parquet, QVD and YXDB. Databases: PostgreSQL, MySQL, SQLite and SQL Server.

## Connections and credentials

There are three owners of connection credentials (see [Component Relationships](./component-relationships.md#connection-ownership)). On the Server:

- **Client** connections arrive inside the request as resolved URIs.
- **Hub** connections are resolved at request time through `domain/hub/client.py`, which calls Hub's `/internal/authorize`.
- **Server** connections live in `ConnectionStore`, an encrypted JSON file (Fernet, key from `CONNECTION_ENCRYPTION_KEY`). This path is deprecated.

`ConnectionResolver` fills in the URIs before a workflow runs. `query_policy.py` rejects SQL that contains write or DDL keywords after stripping comments. It is defense in depth, not a SQL parser, so credentials should still be read-only.

## Middleware

Requests pass through, outermost first: rate limiting, audit logging, CORS, authentication.

- `AuthMiddleware` checks a bearer token for `ephemeral` and `static` modes. In `hub` mode, workflow and file routes authorize each request with Hub.
- `AuditMiddleware` writes one log line per request to a daily file.
- Rate limiting applies to workflow routes when `RATE_LIMIT_ENABLED` is on.

## Startup checks

`main.py` refuses to start when the configuration is unsafe or inconsistent: `AUTH_MODE=static` without a token, `hub` without `HUB_URL`, or contradictory file-access settings. `AUTH_MODE=disabled` and `FILE_ACCESS_MODE=open` log warnings. In `hub` mode with a `HUB_SERVER_TOKEN`, a heartbeat task registers the Server with Hub and repeats every 30 seconds. See [Server Configuration](../../admin/server-configuration.md).

## Polars laziness

```python
lf = pl.scan_csv("huge.csv")           # returns immediately
lf = lf.filter(pl.col("age") > 30)     # builds a plan
lf = lf.select(["name", "age"])
rows = lf.head(100).collect()          # reads only what it needs
```

The Server collects only when it returns preview rows, writes output, profiles data or needs an eager result for a blocking step such as a cached Sort.

## Testing

Server tests cover tool execution, schema propagation, plan ordering and caching, config validation, format readers, the API, and security controls. See [Server Testing](../testing/backend.md).

---

Next: [Hub Architecture](./hub.md) or [Adding Tools](../contributing/adding-tools.md).
