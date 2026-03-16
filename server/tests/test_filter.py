"""Test Filter tool implementation"""

import polars as pl
import pytest

from app.api.models.workflow import (
    Socket,
    Tool,
    Wire,
    WireEndpoint,
    Workflow,
    WorkflowMeta,
)
from app.domain.execution.executor import WorkflowExecutor


@pytest.fixture
def sample_data_csv(tmp_path):
    """Create sample CSV with varied data for filter testing"""
    csv_path = tmp_path / "filter_test.csv"

    df = pl.DataFrame(
        {
            "id": [1, 2, 3, 4, 5, 6, 7, 8],
            "name": ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Henry"],
            "age": [25, 30, 35, 40, 45, 28, 32, 50],
            "amount": [100.0, 250.0, 75.0, 500.0, 150.0, 300.0, 50.0, 400.0],
            "status": [
                "active",
                "inactive",
                "active",
                "active",
                "inactive",
                "active",
                "active",
                "inactive",
            ],
        }
    )

    df.write_csv(csv_path)
    return str(csv_path)


@pytest.mark.asyncio
async def test_filter_basic_numeric_condition(sample_data_csv):
    """Test Filter tool with basic numeric condition"""

    workflow = Workflow(
        meta=WorkflowMeta(
            name="Filter Test - Numeric",
            description="Test basic numeric filter",
            author="Test",
            workflowId="test-filter-numeric",
            created="2025-08-01",
        ),
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0,
                y=0,
                config={
                    "category": "file",
                    "type": "csv",
                    "source": sample_data_csv,
                    "csvMode": "scan",
                },
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="filter1",
                type="Filter",
                x=300,
                y=0,
                config={
                    "expression": "pl.col('age') > 30",
                },
                sockets=[
                    Socket(id="input", direction="input"),
                    Socket(id="output-true", direction="output"),  # T output
                    Socket(id="output-false", direction="output"),  # F output
                ],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="filter1", socket="input"),
            )
        ],
    )

    executor = WorkflowExecutor()
    result = await executor.execute_workflow(workflow)

    # Check T output (True - age > 30)
    true_output_data = result["outputs"]["output-true"]["data"]
    assert len(true_output_data) == 5  # Charlie, David, Eve, Grace, Henry (35, 40, 45, 32, 50)

    # Check F output (False - age <= 30)
    false_output_data = result["outputs"]["output-false"]["data"]
    assert len(false_output_data) == 3  # Alice, Bob, Frank (25, 30, 28)

    print(f"True output: {len(true_output_data)} rows")
    print(f"False output: {len(false_output_data)} rows")


@pytest.mark.asyncio
async def test_filter_string_condition(sample_data_csv):
    """Test Filter tool with string condition"""

    workflow = Workflow(
        meta=WorkflowMeta(
            name="Filter Test - String",
            description="Test string filter",
            author="Test",
            workflowId="test-filter-string",
            created="2025-08-01",
        ),
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0,
                y=0,
                config={
                    "category": "file",
                    "type": "csv",
                    "source": sample_data_csv,
                    "csvMode": "scan",
                },
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="filter1",
                type="Filter",
                x=300,
                y=0,
                config={
                    "expression": "pl.col('status') == 'active'",
                },
                sockets=[
                    Socket(id="input", direction="input"),
                    Socket(id="output-true", direction="output"),
                    Socket(id="output-false", direction="output"),
                ],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="filter1", socket="input"),
            )
        ],
    )

    executor = WorkflowExecutor()
    result = await executor.execute_workflow(workflow)

    # Check active status
    active_output_data = result["outputs"]["output-true"]["data"]
    assert len(active_output_data) == 5  # Alice, Charlie, David, Frank, Grace

    # Check inactive status
    inactive_output_data = result["outputs"]["output-false"]["data"]
    assert len(inactive_output_data) == 3  # Bob, Eve, Henry


@pytest.mark.asyncio
async def test_filter_compound_condition(sample_data_csv):
    """Test Filter tool with compound AND condition"""

    workflow = Workflow(
        meta=WorkflowMeta(
            name="Filter Test - Compound",
            description="Test compound filter",
            author="Test",
            workflowId="test-filter-compound",
            created="2025-08-01",
        ),
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0,
                y=0,
                config={
                    "category": "file",
                    "type": "csv",
                    "source": sample_data_csv,
                    "csvMode": "scan",
                },
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="filter1",
                type="Filter",
                x=300,
                y=0,
                config={
                    "expression": "(pl.col('age') > 30) & (pl.col('amount') > 200)",
                },
                sockets=[
                    Socket(id="input", direction="input"),
                    Socket(id="output-true", direction="output"),
                    Socket(id="output-false", direction="output"),
                ],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="filter1", socket="input"),
            )
        ],
    )

    executor = WorkflowExecutor()
    result = await executor.execute_workflow(workflow)

    # Check matched rows (age > 30 AND amount > 200)
    matched_output_data = result["outputs"]["output-true"]["data"]
    # David (40, 500), Frank (300 but age 28 - no), Grace (32 but 50 - no), Henry (50, 400)
    # Actually: David, Henry only (age > 30 AND amount > 200)
    # Wait, Frank is 28 (not > 30), Grace amount is 50 (not > 200)
    # David (40, 500), Henry (50, 400) - Eve (45, 150) amount not > 200
    # age > 30: Charlie, David, Eve, Grace, Henry
    # amount > 200: David (500), Frank (300), Henry (400)
    # BOTH: David, Henry (but Frank age 28)
    # Actually Frank is 28, so: David and Henry only
    assert len(matched_output_data) == 2  # David, Henry

    print(f"Matched output: {len(matched_output_data)} rows")
    print(matched_output_data)


@pytest.mark.asyncio
async def test_filter_empty_expression(sample_data_csv):
    """Test Filter tool with empty expression (should pass all rows to T)"""

    workflow = Workflow(
        meta=WorkflowMeta(
            name="Filter Test - Empty",
            description="Test empty filter",
            author="Test",
            workflowId="test-filter-empty",
            created="2025-08-01",
        ),
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0,
                y=0,
                config={
                    "category": "file",
                    "type": "csv",
                    "source": sample_data_csv,
                    "csvMode": "scan",
                },
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="filter1",
                type="Filter",
                x=300,
                y=0,
                config={
                    "expression": "",
                },
                sockets=[
                    Socket(id="input", direction="input"),
                    Socket(id="output-true", direction="output"),
                    Socket(id="output-false", direction="output"),
                ],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="filter1", socket="input"),
            )
        ],
    )

    executor = WorkflowExecutor()
    result = await executor.execute_workflow(workflow)

    # All rows should go to T output
    true_output_data = result["outputs"]["output-true"]["data"]
    assert len(true_output_data) == 8  # All rows

    # F output should be empty
    false_output_data = result["outputs"]["output-false"]["data"]
    assert len(false_output_data) == 0


@pytest.mark.asyncio
async def test_filter_schema_propagation(sample_data_csv):
    """Test that Filter tool preserves schema"""

    workflow = Workflow(
        meta=WorkflowMeta(
            name="Filter Schema Test",
            description="Test filter schema propagation",
            author="Test",
            workflowId="test-filter-schema",
            created="2025-08-01",
        ),
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0,
                y=0,
                config={
                    "category": "file",
                    "type": "csv",
                    "source": sample_data_csv,
                    "csvMode": "scan",
                },
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="filter1",
                type="Filter",
                x=300,
                y=0,
                config={
                    "expression": "pl.col('age') > 30",
                },
                sockets=[
                    Socket(id="input", direction="input"),
                    Socket(id="output-true", direction="output"),
                    Socket(id="output-false", direction="output"),
                ],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="filter1", socket="input"),
            )
        ],
    )

    executor = WorkflowExecutor()

    # Get data for both tools
    input_result = await executor.execute_single_tool(workflow, "input1", socket_id="output")

    executor2 = WorkflowExecutor()
    filter_result_t = await executor2.execute_single_tool(
        workflow, "filter1", socket_id="output-true"
    )

    executor3 = WorkflowExecutor()
    filter_result_f = await executor3.execute_single_tool(
        workflow, "filter1", socket_id="output-false"
    )

    # Both outputs should have same schema as input
    input_columns = input_result["data_schema"].columns
    filter_t_columns = filter_result_t["data_schema"].columns
    filter_f_columns = filter_result_f["data_schema"].columns

    assert filter_t_columns == input_columns
    assert filter_f_columns == input_columns

    print("Schema preserved correctly for both outputs")


# Tests for code generation
class TestFilterCodeGeneration:
    """Test Filter tool Python code generation"""

    def test_code_gen_basic_filter(self):
        """Test code generation with basic filter expression"""
        from app.domain.tools.implementations.filter import FilterTool

        tool = FilterTool()
        config = {"expression": "pl.col('amount') > 100"}
        input_vars = {"input": "df_input"}

        lines, output_vars = tool.to_python_code("filter1", config, input_vars)

        assert len(lines) == 2
        # Expression is wrapped in parentheses with closing paren on new line
        assert "df_filter1_t = df_input.filter((pl.col('amount') > 100" in lines[0]
        assert "df_filter1_f = df_input.filter(~((pl.col('amount') > 100" in lines[1]
        assert output_vars == {"output-true": "df_filter1_t", "output-false": "df_filter1_f"}

    def test_code_gen_empty_expression(self):
        """Test code generation with empty expression (pass-through)"""
        from app.domain.tools.implementations.filter import FilterTool

        tool = FilterTool()
        config = {"expression": ""}
        input_vars = {"input": "df_source"}

        lines, output_vars = tool.to_python_code("myfilter", config, input_vars)

        assert len(lines) == 2
        assert "df_myfilter_t = df_source" in lines[0]
        assert "df_myfilter_f = df_source.clear()" in lines[1]

    def test_code_gen_complex_expression(self):
        """Test code generation with complex compound expression"""
        from app.domain.tools.implementations.filter import FilterTool

        tool = FilterTool()
        config = {"expression": "(pl.col('a') > 10) & (pl.col('b') < 20)"}
        input_vars = {"input": "df_data"}

        lines, output_vars = tool.to_python_code("flt", config, input_vars)

        # Expression is wrapped in parentheses
        assert "((pl.col('a') > 10) & (pl.col('b') < 20)" in lines[0]
        assert "~(((pl.col('a') > 10) & (pl.col('b') < 20)" in lines[1]
