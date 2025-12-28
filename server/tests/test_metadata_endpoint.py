"""Tests for metadata endpoint"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.mark.asyncio
async def test_metadata_endpoint_filter_tool(client, sample_csv):
    """Test metadata endpoint for Filter tool"""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-1",
            "created": "2025-01-01T00:00:00",
        },
        "tools": [
            {
                "id": "input1",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {
                    "category": "file",
                    "type": "csv",
                    "source": str(sample_csv),
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
            {
                "id": "filter1",
                "type": "Filter",
                "x": 200,
                "y": 0,
                "config": {"expression": "pl.col('age') > 30"},
                "sockets": [
                    {"id": "input", "direction": "input"},
                    {"id": "output-true", "direction": "output", "type": "T"},
                    {"id": "output-false", "direction": "output", "type": "F"},
                ],
            },
        ],
        "wires": [
            {
                "from": {"tool": "input1", "socket": "output"},
                "to": {"tool": "filter1", "socket": "input"},
            }
        ],
    }

    response = client.post(
        "/api/workflow/tool/metadata",
        json={"tool_id": "filter1", "workflow": workflow},
    )

    assert response.status_code == 200
    data = response.json()

    # Check structure
    assert data["tool_id"] == "filter1"
    assert "inputs" in data

    # Check columns from CSV via "input" socket
    assert "input" in data["inputs"]
    columns = data["inputs"]["input"]
    assert len(columns) > 0
    column_names = [col["name"] for col in columns]
    assert "age" in column_names
    assert "name" in column_names

    # Check each column has required fields
    for col in columns:
        assert "name" in col
        assert "dtype" in col
        assert "nullable" in col


@pytest.mark.asyncio
async def test_metadata_endpoint_formula_tool(client, sample_csv):
    """Test metadata endpoint for Formula tool"""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-1",
            "created": "2025-01-01T00:00:00",
        },
        "tools": [
            {
                "id": "input1",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {
                    "category": "file",
                    "type": "csv",
                    "source": str(sample_csv),
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
            {
                "id": "formula1",
                "type": "Formula",
                "x": 200,
                "y": 0,
                "config": {
                    "column_name": "result",
                    "expression": "pl.col('age') * 2",
                },
                "sockets": [
                    {"id": "input", "direction": "input"},
                    {"id": "output-true", "direction": "output"},
                ],
            },
        ],
        "wires": [
            {
                "from": {"tool": "input1", "socket": "output"},
                "to": {"tool": "formula1", "socket": "input"},
            }
        ],
    }

    response = client.post(
        "/api/workflow/tool/metadata",
        json={"tool_id": "formula1", "workflow": workflow},
    )

    assert response.status_code == 200
    data = response.json()

    # Check structure
    assert data["tool_id"] == "formula1"
    assert "inputs" in data
    assert "input" in data["inputs"]
    assert len(data["inputs"]["input"]) > 0

    # Verify we get columns from Input tool
    column_names = [col["name"] for col in data["inputs"]["input"]]
    assert "age" in column_names


@pytest.mark.asyncio
async def test_metadata_endpoint_no_upstream(client, sample_csv):
    """Test metadata endpoint for tool with no upstream connections"""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-1",
            "created": "2025-01-01T00:00:00",
        },
        "tools": [
            {
                "id": "input1",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {
                    "category": "file",
                    "type": "csv",
                    "source": str(sample_csv),
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
        ],
        "wires": [],
    }

    response = client.post(
        "/api/workflow/tool/metadata",
        json={"tool_id": "input1", "workflow": workflow},
    )

    assert response.status_code == 200
    data = response.json()

    # Input tool has no inputs, so inputs should be empty dict
    assert data["tool_id"] == "input1"
    assert data["inputs"] == {}


@pytest.mark.asyncio
async def test_metadata_endpoint_multiple_input_sockets(client, sample_csv, tmp_path):
    """Test metadata endpoint returns columns grouped by socket ID for tools with multiple inputs.

    This is critical for the Join tool which has separate input-left and input-right sockets,
    each needing their own column list for key selection dropdowns.
    """
    # Create a second CSV with different columns
    second_csv = tmp_path / "employees.csv"
    second_csv.write_text("id,salary,department\n1,50000,Engineering\n2,60000,Sales\n")

    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-1",
            "created": "2025-01-01T00:00:00",
        },
        "tools": [
            {
                "id": "input-people",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {
                    "category": "file",
                    "type": "csv",
                    "source": str(sample_csv),  # Has: name, age, city
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
            {
                "id": "input-employees",
                "type": "Input",
                "x": 0,
                "y": 200,
                "config": {
                    "category": "file",
                    "type": "csv",
                    "source": str(second_csv),  # Has: id, salary, department
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
            {
                "id": "join1",
                "type": "Join",
                "x": 300,
                "y": 100,
                "config": {
                    "joinType": "inner",
                    "leftKeys": [],
                    "rightKeys": [],
                },
                "sockets": [
                    {"id": "input-left", "direction": "input", "type": "L"},
                    {"id": "input-right", "direction": "input", "type": "R"},
                    {"id": "output-left", "direction": "output", "type": "L"},
                    {"id": "output-match", "direction": "output", "type": "J"},
                    {"id": "output-right", "direction": "output", "type": "R"},
                ],
            },
        ],
        "wires": [
            {
                "from": {"tool": "input-people", "socket": "output"},
                "to": {"tool": "join1", "socket": "input-left"},
            },
            {
                "from": {"tool": "input-employees", "socket": "output"},
                "to": {"tool": "join1", "socket": "input-right"},
            },
        ],
    }

    response = client.post(
        "/api/workflow/tool/metadata",
        json={"tool_id": "join1", "workflow": workflow},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify response structure
    assert data["tool_id"] == "join1"
    assert "inputs" in data

    # Verify both input sockets are present
    assert "input-left" in data["inputs"], "Missing input-left socket in metadata"
    assert "input-right" in data["inputs"], "Missing input-right socket in metadata"

    # Verify left input has columns from sample_csv (people data)
    left_columns = data["inputs"]["input-left"]
    left_col_names = [col["name"] for col in left_columns]
    assert "name" in left_col_names, "Left input should have 'name' column from sample.csv"
    assert "age" in left_col_names, "Left input should have 'age' column from sample.csv"

    # Verify right input has columns from second_csv (employee data)
    right_columns = data["inputs"]["input-right"]
    right_col_names = [col["name"] for col in right_columns]
    assert "id" in right_col_names, "Right input should have 'id' column from employees.csv"
    assert "salary" in right_col_names, "Right input should have 'salary' column from employees.csv"
    assert "department" in right_col_names, (
        "Right input should have 'department' column from employees.csv"
    )

    # Verify columns are NOT mixed between sockets
    assert "salary" not in left_col_names, "Left input should NOT have columns from right input"
    assert "name" not in right_col_names, "Right input should NOT have columns from left input"


@pytest.mark.asyncio
async def test_metadata_endpoint_partial_connections(client, sample_csv):
    """Test metadata for tool with only some input sockets connected.

    For Join tool, if only left is connected, we should get columns for left
    but not for the unconnected right socket.
    """
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-1",
            "created": "2025-01-01T00:00:00",
        },
        "tools": [
            {
                "id": "input1",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {
                    "category": "file",
                    "type": "csv",
                    "source": str(sample_csv),
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
            {
                "id": "join1",
                "type": "Join",
                "x": 300,
                "y": 100,
                "config": {
                    "joinType": "inner",
                    "leftKeys": [],
                    "rightKeys": [],
                },
                "sockets": [
                    {"id": "input-left", "direction": "input", "type": "L"},
                    {"id": "input-right", "direction": "input", "type": "R"},
                    {"id": "output-left", "direction": "output", "type": "L"},
                    {"id": "output-match", "direction": "output", "type": "J"},
                    {"id": "output-right", "direction": "output", "type": "R"},
                ],
            },
        ],
        "wires": [
            # Only left is connected, right is NOT connected
            {
                "from": {"tool": "input1", "socket": "output"},
                "to": {"tool": "join1", "socket": "input-left"},
            },
        ],
    }

    response = client.post(
        "/api/workflow/tool/metadata",
        json={"tool_id": "join1", "workflow": workflow},
    )

    assert response.status_code == 200
    data = response.json()

    # Left socket should have columns
    assert "input-left" in data["inputs"]
    left_columns = data["inputs"]["input-left"]
    assert len(left_columns) > 0

    # Right socket should NOT be in inputs (or be empty) since it's not connected
    # The API omits sockets with no upstream data
    assert "input-right" not in data["inputs"] or len(data["inputs"].get("input-right", [])) == 0


@pytest.mark.asyncio
async def test_metadata_endpoint_socket_specific_request(client, sample_csv, tmp_path):
    """Test metadata endpoint with socket_id parameter for targeted queries.

    When socket_id is provided, only that socket's columns should be returned
    in the 'columns' field, and 'inputs' should only contain that socket.
    """
    # Create a second CSV with different columns
    second_csv = tmp_path / "employees.csv"
    second_csv.write_text("id,salary,department\n1,50000,Engineering\n2,60000,Sales\n")

    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-1",
            "created": "2025-01-01T00:00:00",
        },
        "tools": [
            {
                "id": "input-people",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {
                    "category": "file",
                    "type": "csv",
                    "source": str(sample_csv),
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
            {
                "id": "input-employees",
                "type": "Input",
                "x": 0,
                "y": 200,
                "config": {
                    "category": "file",
                    "type": "csv",
                    "source": str(second_csv),
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
            {
                "id": "join1",
                "type": "Join",
                "x": 300,
                "y": 100,
                "config": {
                    "joinType": "inner",
                    "leftKeys": [],
                    "rightKeys": [],
                },
                "sockets": [
                    {"id": "input-left", "direction": "input", "type": "L"},
                    {"id": "input-right", "direction": "input", "type": "R"},
                    {"id": "output-left", "direction": "output", "type": "L"},
                    {"id": "output-match", "direction": "output", "type": "J"},
                    {"id": "output-right", "direction": "output", "type": "R"},
                ],
            },
        ],
        "wires": [
            {
                "from": {"tool": "input-people", "socket": "output"},
                "to": {"tool": "join1", "socket": "input-left"},
            },
            {
                "from": {"tool": "input-employees", "socket": "output"},
                "to": {"tool": "join1", "socket": "input-right"},
            },
        ],
    }

    # Request only left socket
    response = client.post(
        "/api/workflow/tool/metadata",
        json={"tool_id": "join1", "socket_id": "input-left", "workflow": workflow},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify socket_id is echoed back
    assert data["socket_id"] == "input-left"

    # Verify 'columns' contains just the left socket's columns
    assert data["columns"] is not None
    column_names = [col["name"] for col in data["columns"]]
    assert "name" in column_names
    assert "age" in column_names
    # Should NOT contain right socket columns
    assert "salary" not in column_names
    assert "department" not in column_names

    # Verify 'inputs' only contains the requested socket
    assert list(data["inputs"].keys()) == ["input-left"]


@pytest.mark.asyncio
async def test_metadata_endpoint_socket_null_when_not_specified(client, sample_csv):
    """Test that socket_id and columns are null when not specified in request."""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-1",
            "created": "2025-01-01T00:00:00",
        },
        "tools": [
            {
                "id": "input1",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {
                    "category": "file",
                    "type": "csv",
                    "source": str(sample_csv),
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
            {
                "id": "filter1",
                "type": "Filter",
                "x": 200,
                "y": 0,
                "config": {"expression": "pl.col('age') > 30"},
                "sockets": [
                    {"id": "input", "direction": "input"},
                    {"id": "output-true", "direction": "output", "type": "T"},
                    {"id": "output-false", "direction": "output", "type": "F"},
                ],
            },
        ],
        "wires": [
            {
                "from": {"tool": "input1", "socket": "output"},
                "to": {"tool": "filter1", "socket": "input"},
            }
        ],
    }

    # Request without socket_id
    response = client.post(
        "/api/workflow/tool/metadata",
        json={"tool_id": "filter1", "workflow": workflow},
    )

    assert response.status_code == 200
    data = response.json()

    # socket_id should be null
    assert data["socket_id"] is None

    # columns should be null (use inputs for all sockets)
    assert data["columns"] is None

    # inputs should have all sockets
    assert "input" in data["inputs"]
    assert len(data["inputs"]["input"]) > 0
