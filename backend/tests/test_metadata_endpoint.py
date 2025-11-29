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
    assert "columns" in data

    # Check columns from CSV
    columns = data["columns"]
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
    assert len(data["columns"]) > 0

    # Verify we get columns from Input tool
    column_names = [col["name"] for col in data["columns"]]
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

    # Input tool has no inputs, so columns should be empty
    assert data["tool_id"] == "input1"
    assert data["columns"] == []
