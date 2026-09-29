---
sidebar_position: 2
---

# Server Testing

Patterns and practices for testing the Python Server.

## Framework

- **pytest** for test execution
- **pytest-asyncio** for async test support
- **pytest-cov** for coverage reporting

## Running Tests

```bash
cd server

# All tests
uv run pytest

# Verbose output
uv run pytest -v

# Specific file
uv run pytest tests/test_filter.py

# Specific test
uv run pytest tests/test_filter.py::test_filter_basic -v

# With coverage
uv run pytest --cov=app --cov-report=html

# Stop on first failure
uv run pytest -x

# Show print output
uv run pytest -s
```

## Test Organization

```
server/tests/
|-- conftest.py              # Shared fixtures
|-- fixtures/
|   `-- sample.csv           # Test data files
|-- test_execution.py        # Execution engine tests
|-- test_planner.py          # ExecutionPlanner tests
|-- test_cache_manager.py    # CacheManager tests
|-- test_parallel_execution.py # Parallel execution tests
|-- test_type_contracts.py   # Studio/Server contract tests
|-- test_cache.py            # BlockingToolCache tests
|-- test_formula.py          # Formula tool tests
|-- test_filter.py           # Filter tool tests
|-- test_select.py           # Select tool tests
|-- test_join.py             # Join tool tests
|-- test_output.py           # Output tool tests
|-- test_parquet.py          # Parquet datasource tests
|-- test_datasources.py      # Datasource factory tests
|-- test_database.py         # Database datasource tests
|-- test_connections.py      # Connection store tests
|-- test_integration.py      # End-to-end workflow tests
`-- test_models.py           # Pydantic model tests
```

## Fixtures

Common fixtures live in `conftest.py`:

```python
# conftest.py
import pytest
import polars as pl
from pathlib import Path


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    """Create a temporary CSV file for testing."""
    csv_path = tmp_path / "sample.csv"
    csv_path.write_text("name,age,city\nAlice,30,NYC\nBob,25,LA\n")
    return csv_path


@pytest.fixture
def sample_lazyframe() -> pl.LazyFrame:
    """Create a sample LazyFrame for testing."""
    return pl.LazyFrame({
        "name": ["Alice", "Bob", "Charlie"],
        "age": [30, 25, 35],
        "city": ["NYC", "LA", "Chicago"],
    })


@pytest.fixture
def sample_schema() -> DataSchema:
    """Create a sample schema for testing."""
    return DataSchema(columns=[
        ColumnInfo(name="name", dtype="String", nullable=True),
        ColumnInfo(name="age", dtype="Int64", nullable=False),
        ColumnInfo(name="city", dtype="String", nullable=True),
    ])
```

## Tool Testing Patterns

### Basic Execution Test

```python
import pytest
import polars as pl
from app.domain.tools.implementations.filter import FilterTool


@pytest.mark.asyncio
async def test_filter_basic(sample_lazyframe):
    """Test that filter excludes non-matching rows."""
    tool = FilterTool()
    config = {"expression": "age > 28"}
    
    result = await tool.execute(config, {"input": sample_lazyframe})
    
    df = result["output-true"].collect()
    assert len(df) == 2  # Alice (30) and Charlie (35)
    assert "Bob" not in df["name"].to_list()
```

### Schema Propagation Test

```python
@pytest.mark.asyncio
async def test_filter_schema_passthrough(sample_schema):
    """Test that filter preserves input schema."""
    tool = FilterTool()
    config = {"expression": "age > 28"}
    
    result = await tool.get_output_schema(
        config, 
        {"input": sample_schema}
    )
    
    # Filter doesn't change column structure
    assert result["output-true"] == sample_schema
    assert result["output-false"] == sample_schema
```

### Validation Test

```python
@pytest.mark.asyncio
async def test_filter_validates_empty_expression():
    """Test that empty expression is rejected."""
    tool = FilterTool()
    
    errors = await tool.validate_config({"expression": ""})
    
    assert len(errors) > 0
    assert "expression" in errors[0].lower()
```

### Edge Case Tests

```python
@pytest.mark.asyncio
async def test_filter_empty_input():
    """Test filter with no matching rows."""
    tool = FilterTool()
    lf = pl.LazyFrame({"age": [10, 15, 20]})
    config = {"expression": "age > 100"}
    
    result = await tool.execute(config, {"input": lf})
    
    df = result["output-true"].collect()
    assert len(df) == 0


@pytest.mark.asyncio
async def test_filter_all_matching():
    """Test filter where all rows match."""
    tool = FilterTool()
    lf = pl.LazyFrame({"age": [30, 40, 50]})
    config = {"expression": "age > 20"}
    
    result = await tool.execute(config, {"input": lf})
    
    df = result["output-true"].collect()
    assert len(df) == 3
```

### Error Handling Test

```python
@pytest.mark.asyncio
async def test_filter_invalid_column():
    """Test filter with non-existent column."""
    tool = FilterTool()
    lf = pl.LazyFrame({"age": [30]})
    config = {"expression": "nonexistent > 0"}
    
    with pytest.raises(ToolError, match="column"):
        await tool.execute(config, {"input": lf})
```

## Execution Engine Testing

The execution engine has been decomposed into several components, each with dedicated tests:

### ExecutionPlanner Tests

```python
import pytest
from app.domain.execution.planner import ExecutionPlanner, ExecutionPlan
from app.api.models.workflow import Workflow


def test_execution_plan_immutable():
    """Test that ExecutionPlan is immutable."""
    workflow = create_workflow([...])
    planner = ExecutionPlanner(workflow)
    plan = planner.create_plan()
    
    # execution_order is a tuple, not a list
    assert isinstance(plan.execution_order, tuple)


def test_partial_plan():
    """Test creating plan for subset of workflow."""
    workflow = create_workflow([
        tool("A", "Input"),
        tool("B", "Filter"),
        tool("C", "Output"),
    ], wires=[...])
    
    planner = ExecutionPlanner(workflow)
    plan = planner.create_plan(target_tool_id="B")
    
    # Only includes A and B, not C
    assert "A" in plan.execution_order
    assert "B" in plan.execution_order
    assert "C" not in plan.execution_order


def test_execution_levels():
    """Test parallel execution level computation."""
    # A -> B -> D
    # A -> C -> D
    workflow = create_workflow([
        tool("A", "Input"),
        tool("B", "Filter"),
        tool("C", "Select"),
        tool("D", "Output"),
    ], wires=[
        wire("A", "output", "B", "input"),
        wire("A", "output", "C", "input"),
        wire("B", "output", "D", "input"),
        wire("C", "output", "D", "input"),
    ])
    
    planner = ExecutionPlanner(workflow)
    plan = planner.create_plan()
    levels = plan.get_execution_levels()
    
    assert levels[0] == ["A"]       # Level 0
    assert set(levels[1]) == {"B", "C"}  # Level 1 (parallel)
    assert levels[2] == ["D"]       # Level 2
```

### CacheManager Tests

```python
import pytest
from app.domain.execution.cache_manager import CacheManager


def test_lineage_hash_deterministic():
    """Test that same inputs produce same hash."""
    cache1 = CacheManager("workflow-1")
    cache2 = CacheManager("workflow-1")
    
    # Same tool, same plan -> same hash
    hash1 = cache1.compute_lineage_hash(tool, plan)
    hash2 = cache2.compute_lineage_hash(tool, plan)
    
    assert hash1 == hash2


def test_lineage_hash_chain():
    """Test that upstream changes propagate to downstream hashes."""
    cache = CacheManager("workflow-1")
    
    # Execute upstream tool, record hash
    upstream_hash = cache.compute_lineage_hash(upstream_tool, plan)
    cache.record_lineage_hash(upstream_tool.id, upstream_hash)
    
    # Downstream hash includes upstream
    downstream_hash = cache.compute_lineage_hash(downstream_tool, plan)
    
    # Change upstream config
    upstream_tool.config["expression"] = "different"
    new_upstream_hash = cache.compute_lineage_hash(upstream_tool, plan)
    cache.record_lineage_hash(upstream_tool.id, new_upstream_hash)
    
    # Downstream hash should change
    new_downstream_hash = cache.compute_lineage_hash(downstream_tool, plan)
    assert new_downstream_hash != downstream_hash
```

### Parallel Execution Tests

```python
@pytest.mark.asyncio
async def test_parallel_execution_respects_dependencies():
    """Test that parallel execution never runs tool before its deps."""
    workflow = create_parallel_workflow()
    executor = WorkflowExecutor()
    
    # Track execution order
    execution_log = []
    
    result = await executor.execute_workflow(
        workflow,
        execution_mode="parallel"
    )
    
    # Verify dependencies ran first
    for tool_id, deps in get_dependencies(workflow).items():
        tool_index = execution_log.index(tool_id)
        for dep in deps:
            dep_index = execution_log.index(dep)
            assert dep_index < tool_index
```

### Execution Graph Tests

```python
import pytest
from app.domain.execution.executor import WorkflowExecutor
from app.domain.execution.graph import ExecutionGraph
from app.api.models.workflow import Workflow


def test_execution_order():
    """Test that tools execute in dependency order."""
    workflow = create_workflow([
        tool("A", "Input"),
        tool("B", "Filter"),  # depends on A
        tool("C", "Output"),  # depends on B
    ], wires=[
        wire("A", "output", "B", "input"),
        wire("B", "output", "C", "input"),
    ])
    
    graph = ExecutionGraph(workflow)
    order = graph.get_execution_order()
    
    assert order.index("A") < order.index("B")
    assert order.index("B") < order.index("C")


def test_cycle_detection():
    """Test that cycles are detected."""
    workflow = create_workflow([
        tool("A", "Filter"),
        tool("B", "Filter"),
        tool("C", "Filter"),
    ], wires=[
        wire("A", "output", "B", "input"),
        wire("B", "output", "C", "input"),
        wire("C", "output", "A", "input"),  # Creates cycle
    ])
    
    graph = ExecutionGraph(workflow)
    errors = graph.validate()
    
    assert any("cycle" in e.lower() for e in errors)
```

## Integration Testing

```python
@pytest.mark.asyncio
async def test_full_workflow_execution(tmp_path):
    """Test complete workflow from input to output."""
    # Create input file
    input_path = tmp_path / "input.csv"
    input_path.write_text("name,age\nAlice,30\nBob,25\n")
    
    output_path = tmp_path / "output.csv"
    
    workflow = create_workflow([
        tool("input", "Input", config={"path": str(input_path)}),
        tool("filter", "Filter", config={"expression": "age > 28"}),
        tool("output", "Output", config={"path": str(output_path)}),
    ], wires=[
        wire("input", "output", "filter", "input"),
        wire("filter", "output-true", "output", "input"),
    ])
    
    executor = WorkflowExecutor()
    result = await executor.execute_workflow(workflow)
    
    assert result["status"] == "success"
    assert output_path.exists()
    
    output_df = pl.read_csv(output_path)
    assert len(output_df) == 1
    assert output_df["name"][0] == "Alice"
```

## Test Data Helpers

Keep test data creation DRY:

```python
# tests/helpers.py

def create_tool(
    id: str,
    type: str,
    config: dict = None,
    x: float = 0,
    y: float = 0,
) -> dict:
    return {
        "id": id,
        "type": type,
        "config": config or {},
        "x": x,
        "y": y,
        "sockets": get_default_sockets(type),
    }


def create_wire(
    from_tool: str,
    from_socket: str,
    to_tool: str,
    to_socket: str,
) -> dict:
    return {
        "from": {"tool": from_tool, "socket": from_socket},
        "to": {"tool": to_tool, "socket": to_socket},
    }


def create_workflow(tools: list, wires: list) -> Workflow:
    return Workflow(
        version="2.0",
        meta={"name": "Test", "author": "Test", ...},
        tools=tools,
        wires=wires,
    )
```

## Async Testing Notes

All tool methods are async. Use `@pytest.mark.asyncio`:

```python
# Correct
@pytest.mark.asyncio
async def test_something():
    result = await tool.execute(...)

# Wrong - won't await properly
def test_something():
    result = tool.execute(...)  # Returns coroutine, not result
```

## Polars Testing Tips

### Comparing DataFrames

```python
# Check equality
assert df1.equals(df2)

# Check specific columns
assert df["name"].to_list() == ["Alice", "Bob"]

# Check schema
assert df.schema == {"name": pl.String, "age": pl.Int64}

# Check row count
assert len(df) == 5
```

### Working with LazyFrames

```python
# Must collect before comparing
lf = tool.execute(...)["output"]
df = lf.collect()
assert len(df) == 5

# Don't compare LazyFrames directly
assert lf1 == lf2  # Wrong - compares object identity
```

---

Next: [Frontend Testing](./frontend) for TypeScript/React testing patterns.
