"""Integration tests demonstrating what frontend needs to continue development"""

import pytest
from pathlib import Path
import polars as pl
from app.api.models.workflow import Workflow, Tool, Wire, WireEndpoint, Socket, WorkflowMeta
from app.domain.execution.executor import WorkflowExecutor


@pytest.fixture
def sample_csv(tmp_path):
    """Create a sample CSV file for testing"""
    csv_path = tmp_path / "sample.csv"
    
    # Create sample data
    df = pl.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "age": [25, 30, 35, 40, 45],
        "salary": [50000.0, 60000.0, 70000.0, 80000.0, 90000.0],
        "department": ["Sales", "Engineering", "Sales", "Engineering", "HR"],
    })
    
    df.write_csv(csv_path)
    return str(csv_path)


@pytest.mark.asyncio
async def test_frontend_schema_workflow(sample_csv):
    """
    Test the critical workflow frontend needs:
    1. Load CSV -> get schema (column names + types)
    2. Add Filter -> schema unchanged
    3. Add Select -> schema shows only selected columns
    
    This is what frontend needs to populate dropdowns and build tool UIs.
    """
    
    # Step 1: Input tool loads CSV
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Schema Test",
            description="Test schema propagation",
            author="Test",
            workflowId="test-schema",
            created="2024-01-01",
        ),
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0, y=0,
                config={
                    "category": "file",
                    "type": "csv",
                    "source": sample_csv,
                    "csvMode": "scan",
                },
                sockets=[
                    Socket(id="output", direction="output", type="polars-lazy")
                ],
            ),
        ],
        wires=[],
    )
    
    executor = WorkflowExecutor()
    
    # Get schema for Input tool - frontend needs this to show available columns
    result = await executor.get_tool_schema(workflow, "input1")
    
    print("\n=== Step 1: Input Tool Schema ===")
    print(f"Schema result: {result}")
    
    # Frontend needs: list of columns with names and types
    assert "outputs" in result
    assert "output" in result["outputs"]  # Socket output

    schema = result["outputs"]["output"]["data_schema"]
    assert schema is not None
    
    columns = schema.columns
    assert len(columns) == 5
    
    # Verify all expected columns present
    column_names = [col.name for col in columns]
    assert set(column_names) == {"id", "name", "age", "salary", "department"}
    
    # Verify types are present
    for col in columns:
        assert col.dtype is not None
    
    print("Frontend can get column list: ", column_names)
    print("Frontend can get column types")
    
    
    # Step 2: Add Filter tool - schema should pass through unchanged
    workflow.tools.append(
        Tool(
            id="filter1",
            type="Filter",
            x=100, y=0,
            config={
                "expression": "pl.col('age') > 30",
            },
            sockets=[
                Socket(id="input", direction="input", type="polars-lazy"),
                Socket(id="output-true", direction="output", type="polars-lazy"),
                Socket(id="output-false", direction="output", type="polars-lazy"),
            ],
        )
    )
    workflow.wires.append(
        Wire(
            from_=WireEndpoint(tool="input1", socket="output"),
            to=WireEndpoint(tool="filter1", socket="input"),
        )
    )
    
    result = await executor.get_tool_schema(workflow, "filter1")
    
    print("\n=== Step 2: Filter Tool Schema ===")
    print(f"Schema result: {result}")
    
    # Filter doesn't change schema - should have same columns
    filter_schema = result["outputs"]["output-true"]["data_schema"]  # Socket output-true = True output
    filter_columns = [col.name for col in filter_schema.columns]
    
    assert set(filter_columns) == {"id", "name", "age", "salary", "department"}
    print("Filter preserves schema, frontend sees same columns")
    
    
    # Step 3: Add Select tool - schema should show only selected columns
    workflow.tools.append(
        Tool(
            id="select1",
            type="Select",
            x=200, y=0,
            config={
                "columnConfigs": [
                    {"name": "name", "selected": True},
                    {"name": "age", "selected": True},
                    {"name": "salary", "selected": True},
                    {"name": "id", "selected": False},
                    {"name": "department", "selected": False},
                ],
            },
            sockets=[
                Socket(id="input", direction="input", type="polars-lazy"),
                Socket(id="output", direction="output", type="polars-lazy"),
            ],
        )
    )
    workflow.wires.append(
        Wire(
            from_=WireEndpoint(tool="filter1", socket="output-true"),
            to=WireEndpoint(tool="select1", socket="input"),
        )
    )
    
    result = await executor.get_tool_schema(workflow, "select1")
    
    print("\n=== Step 3: Select Tool Schema ===")
    print(f"Schema result: {result}")
    
    # Select should show only the selected columns
    select_schema = result["outputs"]["output"]["data_schema"]  # Socket 1 output
    select_columns = [col.name for col in select_schema.columns]
    
    assert set(select_columns) == {"name", "age", "salary"}
    print("Select updates schema, frontend sees reduced column list")
    
    print("\n=== Summary ===")
    print("Frontend now has everything needed to:")
    print("1. Get column names from Input tool")
    print("2. See column types for validation")
    print("3. Track schema changes through workflow")
    print("4. Populate dropdowns with available columns")


@pytest.mark.asyncio
async def test_frontend_preview_workflow(sample_csv):
    """
    Test preview functionality - frontend needs to see sample data
    """
    
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Preview Test",
            description="Test data preview",
            author="Test",
            workflowId="test-preview",
            created="2024-01-01",
        ),
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0, y=0,
                config={
                    "category": "file",
                    "type": "csv",
                    "source": sample_csv,
                    "csvMode": "read",  # Use read mode for preview
                },
                sockets=[
                    Socket(id="output", direction="output", type="polars-lazy")
                ],
            ),
            Tool(
                id="filter1",
                type="Filter",
                x=100, y=0,
                config={
                    "expression": "pl.col('age') > 30",
                },
                sockets=[
                    Socket(id="input", direction="input", type="polars-lazy"),
                    Socket(id="output-true", direction="output", type="polars-lazy"),
                    Socket(id="output-false", direction="output", type="polars-lazy"),
                ],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="filter1", socket="input"),
            ),
        ],
    )
    
    executor = WorkflowExecutor()
    
    # Execute single tool to get preview data
    result = await executor.execute_single_tool(workflow, "filter1", preview_limit=10)
    
    print("\n=== Preview Result ===")
    print(f"Result keys: {result.keys()}")
    
    # Frontend needs the actual data rows
    assert "outputs" in result
    assert "output-true" in result["outputs"]  # Socket output-true = True output
    
    preview_data = result["outputs"]["output-true"]
    print(f"Preview data keys: {preview_data.keys()}")
    
    # Should have data with columns and rows
    assert "data" in preview_data
    assert "data_schema" in preview_data
    
    # Verify filtered correctly (age > 30)
    rows = preview_data["data"]
    assert len(rows) == 3  # Charlie(35), David(40), Eve(45) - Bob(30) and Alice(25) filtered out
    
    print("Frontend can get preview data with actual rows")
    print(f"Preview shows {len(rows)} rows")


@pytest.mark.asyncio
async def test_preview_all_tools(sample_csv):
    """
    Test preview_all_tools - returns preview data for ALL tools in one request.
    
    This is more efficient than calling execute_single_tool multiple times
    because upstream tools are only executed once.
    """
    
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Preview All Test",
            description="Test preview all tools",
            author="Test",
            workflowId="test-preview-all",
            created="2024-01-01",
        ),
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0, y=0,
                config={
                    "category": "file",
                    "type": "csv",
                    "source": sample_csv,
                    "csvMode": "scan",
                },
                sockets=[
                    Socket(id="output", direction="output", type="polars-lazy")
                ],
            ),
            Tool(
                id="filter1",
                type="Filter",
                x=100, y=0,
                config={
                    "expression": "pl.col('age') > 30",
                },
                sockets=[
                    Socket(id="input", direction="input", type="polars-lazy"),
                    Socket(id="output-true", direction="output", type="polars-lazy"),
                    Socket(id="output-false", direction="output", type="polars-lazy"),
                ],
            ),
            Tool(
                id="select1",
                type="Select",
                x=200, y=0,
                config={
                    "columnConfigs": [
                        {"name": "name", "selected": True},
                        {"name": "age", "selected": True},
                    ],
                },
                sockets=[
                    Socket(id="input", direction="input", type="polars-lazy"),
                    Socket(id="output", direction="output", type="polars-lazy"),
                ],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="filter1", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="filter1", socket="output-true"),
                to=WireEndpoint(tool="select1", socket="input"),
            ),
        ],
    )
    
    executor = WorkflowExecutor()
    
    # Get preview for ALL tools in one request
    result = await executor.preview_all_tools(workflow, preview_limit=100)
    
    print("\n=== Preview All Result ===")
    print(f"Result keys: {result.keys()}")
    
    # Should have 'tools' key with all tool results
    assert "tools" in result
    tools = result["tools"]
    
    # Should have results for all 3 tools
    assert "input1" in tools
    assert "filter1" in tools
    assert "select1" in tools
    
    # Check input1 output
    input_output = tools["input1"]["outputs"]["output"]
    assert "data" in input_output
    assert "data_schema" in input_output
    assert len(input_output["data"]) == 5  # All 5 rows
    
    # Check filter1 output (socket output-true = True output)
    filter_output = tools["filter1"]["outputs"]["output-true"]
    assert len(filter_output["data"]) == 3  # 3 rows with age > 30
    
    # Check select1 output
    select_output = tools["select1"]["outputs"]["output"]
    assert len(select_output["data"]) == 3  # Same 3 rows
    # Only 2 columns selected
    assert len(select_output["data_schema"].columns) == 2
    
    print("Preview all returns data for all tools in single request")
    print(f"Input: {len(input_output['data'])} rows")
    print(f"Filter: {len(filter_output['data'])} rows")
    print(f"Select: {len(select_output['data'])} rows")
