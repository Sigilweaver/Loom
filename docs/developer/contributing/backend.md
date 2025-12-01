---
sidebar_position: 4
---

# Backend Patterns

Conventions and patterns for backend development. These emerged from real problems—follow them unless you have a good reason not to.

## Project Structure

```
backend/app/
├── api/                  # HTTP layer only
│   ├── routes/           # Endpoint handlers
│   └── models/           # Pydantic schemas
├── domain/               # Business logic
│   ├── tools/            # Tool implementations
│   ├── execution/        # Workflow execution
│   └── datasources/      # File handling
└── utils/                # Shared utilities
```

**Rule**: API routes should be thin. They validate input, call domain logic, and format output. No business logic in routes.

## Tool Implementation

### The Pattern

```python
from typing import Any
import polars as pl

from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.api.models.common import DataSchema


@register_tool("MyTool")
class MyTool(BaseTool):
    """One-line description."""
    
    async def execute(
        self,
        config: dict[str, Any],
        inputs: dict[str, pl.LazyFrame]
    ) -> dict[str, pl.LazyFrame]:
        """Execute transformation."""
        lf = inputs["input"]
        
        # Transformation logic here
        result = lf.filter(...)
        
        return {"output": result}
    
    async def get_output_schema(
        self,
        config: dict[str, Any],
        input_schemas: dict[str, DataSchema]
    ) -> dict[str, DataSchema]:
        """Return schema without execution."""
        return {"output": input_schemas["input"]}
    
    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Return list of error messages."""
        errors = []
        if not config.get("required_field"):
            errors.append("required_field is required")
        return errors
```

### Key Rules

**1. Keep it lazy.**

```python
# Bad - materializes data unnecessarily
async def execute(self, config, inputs):
    df = inputs["input"].collect()  # Don't do this
    result = df.filter(...)
    return {"output": result.lazy()}

# Good - stays lazy throughout
async def execute(self, config, inputs):
    lf = inputs["input"]
    result = lf.filter(...)  # Still a LazyFrame
    return {"output": result}
```

**2. Socket IDs are strings, not integers.**

```python
# Bad
inputs[0]
return {1: result}

# Good
inputs["input"]
return {"output": result}
```

**3. Handle missing inputs gracefully.**

```python
async def execute(self, config, inputs):
    lf = inputs.get("input")
    if lf is None:
        raise ToolError("No input connected")
    # Continue...
```

**4. Schema must work without execution.**

```python
async def get_output_schema(self, config, input_schemas):
    # Don't call execute() here
    # Don't access actual data
    # Just compute what the output schema WOULD be
    input_schema = input_schemas["input"]
    
    # For tools that add columns:
    new_columns = input_schema.columns + [
        ColumnInfo(name="new_col", dtype="Float64", nullable=True)
    ]
    return {"output": DataSchema(columns=new_columns)}
```

## Polars Patterns

### Filter

```python
lf = lf.filter(pl.col("age") > 30)
lf = lf.filter(pl.col("name").is_not_null())
lf = lf.filter((pl.col("x") > 0) & (pl.col("y") < 100))
```

### Select

```python
lf = lf.select(["name", "age"])
lf = lf.select(pl.all().exclude("password"))
```

### Add/Rename Columns

```python
lf = lf.with_columns(
    (pl.col("price") * pl.col("quantity")).alias("total")
)
lf = lf.rename({"old_name": "new_name"})
```

### Join

```python
result = left_lf.join(
    right_lf,
    left_on="id",
    right_on="user_id",
    how="left"
)
```

### Aggregation

```python
result = lf.group_by("category").agg([
    pl.col("price").sum().alias("total_price"),
    pl.col("quantity").mean().alias("avg_quantity"),
])
```

### Error Handling

```python
try:
    result = lf.filter(pl.col("nonexistent") > 0)
except pl.ColumnNotFoundError as e:
    raise ToolError(f"Column not found: {e}")
```

## API Routes

### The Pattern

```python
from fastapi import APIRouter, HTTPException
from app.api.models.workflow import WorkflowRequest
from app.domain.execution.executor import WorkflowExecutor

router = APIRouter()


@router.post("/execute")
async def execute_workflow(request: WorkflowRequest):
    """Execute a workflow."""
    try:
        executor = WorkflowExecutor()
        result = await executor.execute_workflow(request.workflow)
        return {"status": "success", "result": result}
    except ToolError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ExecutionError as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Pydantic Models

```python
from pydantic import BaseModel, Field


class ToolConfig(BaseModel):
    expression: str = Field(..., description="Filter expression")
    case_sensitive: bool = Field(default=True)


class WorkflowRequest(BaseModel):
    workflow: Workflow
    target_tool_id: str | None = None
    preview_limit: int = Field(default=100, ge=1, le=10000)
```

## Error Handling

### Custom Exceptions

```python
# app/utils/errors.py

class ToolError(Exception):
    """Error in tool execution or configuration."""
    pass


class ExecutionError(Exception):
    """Error in workflow execution."""
    pass


class ValidationError(Exception):
    """Invalid input or configuration."""
    pass
```

### Using Exceptions

```python
from app.utils.errors import ToolError

async def execute(self, config, inputs):
    expression = config.get("expression")
    if not expression:
        raise ToolError("Expression is required")
    
    try:
        # Potentially failing operation
        result = lf.filter(eval_expression(expression))
    except Exception as e:
        raise ToolError(f"Invalid expression: {e}")
    
    return {"output": result}
```

## Testing

### Tool Tests

```python
import pytest
import polars as pl

from app.domain.tools.implementations.filter import FilterTool


@pytest.fixture
def sample_data():
    return pl.LazyFrame({
        "name": ["Alice", "Bob", "Charlie"],
        "age": [25, 35, 45],
    })


@pytest.mark.asyncio
async def test_filter_basic(sample_data):
    tool = FilterTool()
    config = {"expression": "age > 30"}
    
    result = await tool.execute(config, {"input": sample_data})
    df = result["output"].collect()
    
    assert len(df) == 2
    assert "Alice" not in df["name"].to_list()


@pytest.mark.asyncio
async def test_filter_schema_passthrough():
    tool = FilterTool()
    input_schema = DataSchema(columns=[
        ColumnInfo(name="age", dtype="Int64", nullable=False),
    ])
    
    result = await tool.get_output_schema(
        {"expression": "age > 30"},
        {"input": input_schema}
    )
    
    # Filter doesn't change schema
    assert result["output"] == input_schema


@pytest.mark.asyncio
async def test_filter_validation():
    tool = FilterTool()
    errors = await tool.validate_config({"expression": ""})
    assert len(errors) > 0
```

### API Tests

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_execute_workflow():
    workflow = {
        "version": "2.0",
        "meta": {...},
        "tools": [...],
        "wires": [...],
    }
    
    response = client.post("/api/execute/", json={"workflow": workflow})
    assert response.status_code == 200
```

## Type Hints

Use them everywhere:

```python
# Good
async def execute(
    self,
    config: dict[str, Any],
    inputs: dict[str, pl.LazyFrame]
) -> dict[str, pl.LazyFrame]:

# Bad
async def execute(self, config, inputs):
```

Run `mypy app/` to catch type errors before committing.

## Logging

```python
import logging

logger = logging.getLogger(__name__)


async def execute(self, config, inputs):
    logger.debug(f"Executing with config: {config}")
    
    try:
        result = do_thing()
        logger.info(f"Execution successful: {result.count()} rows")
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        raise
```

Log levels:
- `DEBUG`: Detailed internal state
- `INFO`: Normal operations
- `WARNING`: Unexpected but handled
- `ERROR`: Failures

---

Next: [Code Style](./code-style) or [Testing Philosophy](../testing/philosophy).
