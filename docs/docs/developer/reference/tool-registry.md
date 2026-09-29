---
sidebar_position: 2
---

# Tool Registry

Tool types, interfaces, and how they connect.

## Overview

Tools are the core building blocks of Sigilweaver Loom. Each tool:
- Has a **type** (e.g., "Filter", "Join")
- Has **sockets** (input/output connection points)
- Has a **config** (settings specific to that tool)
- Is implemented in both Studio (UI) and Server (execution)

## Architecture

```
Studio                                Server
-------------------------------------------------
TOOL_DEFINITIONS     -------------->  ToolRegistry
(data/tools.ts)                       (domain/tools/registry.py)
                                           |
ToolDefinition       -------------->  BaseTool
(UI/layout/sockets)                   (execute/schema/validate)
                                           |
ConfigPanel          -------------->  Implementation
(component)                           (filter.py, join.py, etc.)
```

---

## Studio: ToolDefinition

Every tool needs a Studio definition in `studio/src/data/tools.ts`:

```typescript
interface ToolDefinition {
  type: string;           // Must match Server tool type
  name: string;           // Display name in palette
  icon: LucideIcon;       // Lucide React icon component
  category: ToolCategory; // "connect" | "compute" | "reshape" | "combine"
  defaultConfig: ToolConfig;
  sockets: Socket[];
  docsUrl?: string;       // Link to documentation page
}
```

### Socket Definition

```typescript
interface Socket {
  id: string;          // Unique within tool (e.g., "input", "output-true")
  direction: "input" | "output";
  type?: string;       // Optional label (e.g., "L", "R", "T", "F")
  multiple?: boolean;  // Allow multiple connections (Union tool)
}
```

### Example: Filter Tool

```typescript
{
  type: 'Filter',
  name: 'Filter',
  icon: Filter,
  category: 'compute',
  defaultConfig: {
    expression: '',
    mode: 'Basic',
    conditions: [],
    combinator: 'and',
  },
  sockets: [
    { id: 'input', direction: 'input' },
    { id: 'output-true', direction: 'output', type: 'T' },
    { id: 'output-false', direction: 'output', type: 'F' }
  ],
  docsUrl: 'https://sigilweaver.app/loom/docs/user/tools/preparation/filter',
}
```

The Filter has:
- One input socket
- Two output sockets: rows that match (T) and rows that don't (F)
- Config for the filter expression and mode

---

## Backend: BaseTool

All tools inherit from `BaseTool`:

```python
from abc import ABC, abstractmethod
import polars as pl

from app.domain.models.workflow import DEFAULT_ENGINE

class BaseTool(ABC):
    engine: str = DEFAULT_ENGINE  # "core/polars"

    @abstractmethod
    async def execute(
        self, 
        config: dict[str, Any], 
        inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """Execute tool logic. Keep it lazy!"""
        pass

    @abstractmethod
    async def get_output_schema(
        self, 
        config: dict[str, Any], 
        input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """Get output schema without execution."""
        pass

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Return list of validation errors."""
        return []

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for this tool."""
        pass
```

### Key Principles

1. **Lazy Execution**: Use `LazyFrame` throughout. Never call `.collect()` unless absolutely necessary.
2. **Schema Inference**: `get_output_schema` must work without executing upstream tools.
3. **Validation**: Catch config errors before execution.
4. **Code Generation**: Support exporting workflows to standalone Python.

---

## Backend: Registry Pattern

Tools register themselves via decorator:

```python
from app.domain.tools.registry import register_tool
from app.domain.tools.base import BaseTool

@register_tool("Filter")
class FilterTool(BaseTool):
    async def execute(self, config, inputs):
        # Implementation
        pass
```

The registry is populated when `app.domain.tools.register` is imported (which happens at app startup).

### Getting a Tool

```python
from app.domain.tools.registry import ToolRegistry

# Simple lookup (falls back to any engine)
tool = ToolRegistry.get("Filter")

# Engine-qualified lookup
tool = ToolRegistry.get("Filter", engine="core/polars")

result = await tool.execute(config, inputs)
```

---

## Engine System

Tools declare which execution engine they belong to via the `engine` class attribute. The default engine is `"core/polars"`.

### Engine Resolution

When the executor runs a tool, it resolves the engine using this precedence chain:

```
tool.engine  >  meta.defaultEngine  >  DEFAULT_ENGINE ("core/polars")
```

- `tool.engine`: Per-tool override in the workflow JSON (optional)
- `meta.defaultEngine`: Workflow-level default (optional, defaults to `"core/polars"`)
- `DEFAULT_ENGINE`: Hardcoded fallback constant

### Engine IDs

Engine identifiers use a namespaced format:

| Engine | ID |
|--------|----|
| Polars (built-in) | `core/polars` |
| Future engines | `core/pandas`, `contrib/dbt`, etc. |

### Workflow Schema Fields

The `.swwf` workflow format includes these engine-related fields:

```json
{
  "version": "1.0",
  "meta": {
    "name": "My Workflow",
    "defaultEngine": "core/polars"
  },
  "tools": [
    {
      "id": "abc",
      "type": "Filter",
      "engine": "core/polars",
      "config": { ... },
      "sockets": [ ... ]
    }
  ],
  "wires": [ ... ],
  "engines": {
    "core/polars": {},
    "contrib/dbt": { "project": "analytics", "profile": "dev" }
  }
}
```

- `meta.defaultEngine`: Optional. Defaults to `"core/polars"` if omitted.
- `tool.engine`: Optional. Omitted when it matches the workflow default (to reduce noise).
- `engines`: Optional block for engine-specific configuration (connection details, project paths, etc.).

---

## Available Tools

### Connect

| Type       | Description         | Sockets  |
| ---------- | ------------------- | -------- |
| **Input** (Read) | Load data from files or databases | `output` |
| **Output** (Write) | Export data to files | `input`  |

### Compute

| Type        | Description                   | Sockets                                    |
| ----------- | ----------------------------- | ------------------------------------------ |
| **Filter**  | Filter rows by expression     | `input` -> `output-true`, `output-false`    |
| **Select**  | Select/rename/reorder columns | `input` -> `output`                         |
| **Sort**    | Sort rows by columns          | `input` -> `output`                         |
| **Formula** | Add calculated column         | `input` -> `output`                         |
| **Sample**  | Sample subset of rows         | `input` -> `output`                         |
| **Unique**  | Deduplicate rows              | `input` -> `output-unique`, `output-duplicate` |

### Join

| Type      | Description                        | Sockets                                                                     |
| --------- | ---------------------------------- | --------------------------------------------------------------------------- |
| **Union** | Combine multiple tables vertically | `input` (multiple) -> `output`                                               |
| **Join**  | Join two tables on keys            | `input-left`, `input-right` -> `output-left`, `output-match`, `output-right` |

### Aggregate

| Type          | Description                       | Sockets            |
| ------------- | --------------------------------- | ------------------ |
| **Summarize** | Group by and aggregate            | `input` -> `output` |
| **Pivot**     | Reshape data (rows to columns)    | `input` -> `output` |
| **Unpivot**   | Reshape data (columns to rows)    | `input` -> `output` |

---

## Config Schemas

Each tool has its own config shape. Here are the key ones:

### Input

```json
{
  "category": "file",
  "type": "csv",
  "source": "/path/to/file.csv",
  "csvMode": "scan"
}
```

### Filter

```json
{
  "expression": "pl.col('value') > 100",
  "mode": "Basic",
  "conditions": [],
  "combinator": "and"
}
```

The `mode` can be `"Basic"` (UI-driven conditions) or `"Custom"` (raw Polars expression). In Basic mode, `conditions` and `combinator` drive the filter. In Custom mode, `expression` is raw Polars syntax evaluated on the backend.

### Select

```json
{
  "columnConfigs": [
    { "name": "id", "selected": true },
    { "name": "value", "selected": true, "rename": "amount", "targetType": "Float64" }
  ]
}
```

### Sort

```json
{
  "sortColumns": [
    { "column": "created_at", "direction": "desc", "nullsFirst": false },
    { "column": "id", "direction": "asc" }
  ]
}
```

### Formula

```json
{
  "column_name": "total",
  "expression": "pl.col('price') * pl.col('quantity')"
}
```

### Union

```json
{
  "mode": "ByName"
}
```

Modes: `ByName` (match by column name), `ByPosition` (match by column order).

### Join

```json
{
  "joinType": "inner",
  "leftKeys": ["id"],
  "rightKeys": ["user_id"]
}
```

Join types: `inner`, `left`, `right`, `outer`. A Join with no keys is a cross join, limited by `SAFETY_MAX_CROSS_JOIN_ROWS`.

### Summarize

```json
{
  "groupByColumns": ["category"],
  "aggregations": [
    { "column": "value", "operation": "Sum", "outputName": "total_value" },
    { "column": "id", "operation": "Count", "outputName": "count" }
  ],
  "includeNulls": false
}
```

Operations: `Sum`, `Mean`, `Median`, `Min`, `Max`, `Std`, `Var`, `Count`, `CountDistinct`, `First`, `Last`, `Concat`.

### Pivot

```json
{
  "on": "category",
  "index": ["date"],
  "values": "amount",
  "aggregateFunction": "first"
}
```

Aggregate functions: `first`, `last`, `sum`, `mean`, `median`, `min`, `max`, `len`.

### Unpivot

```json
{
  "on": ["col_a", "col_b"],
  "index": ["id"],
  "variableName": "variable",
  "valueName": "value"
}
```

Reshapes wide data to long format: selected columns become rows.

### Sample

```json
{
  "mode": "FirstN",
  "n": 100,
  "percent": 10.0,
  "offset": 0,
  "seed": null
}
```

Modes: `FirstN`, `LastN`, `EveryN`, `Random`, `RandomPercent` and `FirstPercent`.

### Unique

```json
{
  "columns": ["id", "name"],
  "mode": "First"
}
```

Modes: `First` (the first occurrence is unique) and `Strict` (only values that appear exactly once are unique). Duplicates go to the `output-duplicate` socket.

---

## Adding a New Tool

See [Adding Tools](../contributing/adding-tools) for a complete guide. The key steps:

1. Add `ToolDefinition` to `studio/src/data/tools.ts`
2. Create config panel component in `studio/src/components/config/`
3. Create implementation in `server/app/domain/tools/implementations/`
4. Register with `@register_tool("YourTool")` decorator
5. Export it from `implementations/__init__.py` and import it in `server/app/domain/tools/register.py`
6. Add tests

---

## Type Matching

Socket types must match when connecting:
- Standard output -> Standard input: Always allowed
- Typed socket -> Same type: Allowed (e.g., "L" -> "L")
- Typed socket -> Different type: Prevented by UI

The Studio enforces type compatibility during drag-and-drop connections.

---

Next: [Roadmap](/roadmap) for project direction and priorities.
