# Backend Contributor Guide

Quick reference for Python/FastAPI backend development.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

## Run & Test

```bash
# Development server (auto-reload)
uvicorn app.main:app --reload  # http://localhost:8000

# Tests
pytest                    # All tests
pytest -v                 # Verbose
pytest tests/test_select.py  # Single file
pytest -k "filter"        # Pattern match

# Linting
ruff check app/
ruff check --fix app/     # Auto-fix
mypy app/                 # Type checking
```

## Project Structure

```
backend/
  app/
    main.py              # FastAPI entrypoint
    config.py            # Settings
    api/
      routes/            # REST endpoints
      models/            # Pydantic schemas
    domain/
      tools/             # Tool implementations (the core!)
        base.py          # BaseTool ABC
        registry.py      # @register_tool decorator
        register.py      # Import all tools here
        implementations/ # One file per tool
      datasources/       # CSV, Parquet handlers
      workflow/          # Execution engine
  tests/                 # Mirror app/ structure
```

## Adding a New Tool

### 1. Create implementation

`app/domain/tools/implementations/my_tool.py`:

```python
from typing import Any
import polars as pl
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.api.models.common import DataSchema

@register_tool("MyTool")  # Must match frontend type string exactly
class MyTool(BaseTool):
    async def execute(
        self,
        config: dict[str, Any],
        inputs: dict[int, pl.LazyFrame]
    ) -> dict[int, pl.LazyFrame]:
        """
        Execute the tool logic.
        
        Args:
            config: Tool config from workflow JSON
            inputs: socket_id -> LazyFrame mapping
        
        Returns:
            socket_id -> LazyFrame for outputs
        """
        lf = inputs[0]  # Input from socket 0
        
        # Your transformation (keep it lazy!)
        result = lf.filter(pl.col("age") > config.get("min_age", 0))
        
        return {1: result}  # Output to socket 1

    async def get_output_schema(
        self,
        config: dict[str, Any],
        input_schemas: dict[int, DataSchema]
    ) -> dict[int, DataSchema]:
        """Return schema without execution (for UI dropdowns)."""
        # Usually pass through unchanged
        return {1: input_schemas[0]}
```

### 2. Register it

`app/domain/tools/register.py`:

```python
# Add import
from app.domain.tools.implementations.my_tool import MyTool  # noqa: F401
```

### 3. Write tests

`tests/test_my_tool.py`:

```python
import pytest
import polars as pl
from app.domain.tools.implementations.my_tool import MyTool

@pytest.fixture
def sample_df():
    return pl.LazyFrame({"name": ["Alice", "Bob"], "age": [25, 30]})

@pytest.mark.asyncio
async def test_my_tool_basic(sample_df):
    tool = MyTool()
    config = {"min_age": 26}
    result = await tool.execute(config, {0: sample_df})
    
    df = result[1].collect()
    assert len(df) == 1
    assert df["name"][0] == "Bob"
```

## Key Rules

1. **Keep it lazy** - Never call `.collect()` in tools. Only preview/output should materialize data.

2. **Socket IDs matter** - Must match frontend tool definition exactly.

3. **Schema propagation** - `get_output_schema()` enables dynamic UI without running queries.

4. **Type hints** - Use them. `mypy` runs in CI.

## API Endpoints

Key routes in `app/api/routes/`:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/workflow/tool/schema` | Get columns without execution |
| `POST /api/workflow/tool/execute` | Preview single tool |
| `POST /api/workflow/execute` | Run complete workflow |
| `GET /api/health/` | Health check |

Test with Swagger UI: http://localhost:8000/docs

## Debugging

```bash
# Quick syntax check
python -c "from app.main import app; print('OK')"

# Interactive testing
python
>>> from app.domain.tools.implementations.filter import FilterTool
>>> import asyncio
>>> asyncio.run(FilterTool().execute(...))
```

## Common Issues

**Import not found**: Did you add to `register.py`?

**Socket mismatch**: Frontend and backend socket IDs must match.

**Tests failing on LazyFrame**: Remember to `.collect()` in tests to compare data.

**Type errors**: Run `mypy app/` before committing.
