"""Tests for profile endpoint

Note: The profile API expects output socket IDs. The frontend translates
input socket requests to their upstream output socket before calling this API.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.mark.asyncio
async def test_profile_endpoint_basic(client, sample_csv):
    """Test basic profile endpoint functionality"""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-profile-1",
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

    # Profile the Input tool's output socket
    response = client.post(
        "/api/workflow/tool/profile",
        json={
            "tool_id": "input1",
            "workflow": workflow,
            "socket_id": "output",
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Check structure
    assert data["tool_id"] == "input1"
    assert data["socket_id"] == "output"
    assert data["row_count"] == 5  # sample.csv has 5 rows
    assert "columns" in data

    # Check that all columns are profiled
    columns = data["columns"]
    assert "id" in columns
    assert "name" in columns
    assert "age" in columns
    assert "city" in columns

    # Check age column profile (numeric)
    age_profile = columns["age"]
    assert age_profile["column"] == "age"
    assert age_profile["count"] == 5
    assert age_profile["null_count"] == 0
    assert age_profile["unique_count"] == 5
    assert "min" in age_profile
    assert "max" in age_profile
    assert "mean" in age_profile


@pytest.mark.asyncio
async def test_profile_endpoint_specific_columns(client, sample_csv):
    """Test profiling specific columns only"""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-profile-2",
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
        "/api/workflow/tool/profile",
        json={
            "tool_id": "input1",
            "workflow": workflow,
            "socket_id": "output",
            "columns": ["age", "name"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    columns = data["columns"]

    # Only requested columns should be profiled
    assert "age" in columns
    assert "name" in columns
    assert "id" not in columns
    assert "city" not in columns


@pytest.mark.asyncio
async def test_profile_endpoint_specific_metrics(client, sample_csv):
    """Test profiling with specific metrics only"""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-profile-3",
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

    # Request only unique_count metric
    response = client.post(
        "/api/workflow/tool/profile",
        json={
            "tool_id": "input1",
            "workflow": workflow,
            "socket_id": "output",
            "metrics": ["unique_count", "count"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    columns = data["columns"]

    # Check that only requested metrics are present
    age_profile = columns["age"]
    assert "unique_count" in age_profile
    assert "count" in age_profile
    # These should NOT be present since we only requested unique_count and count
    assert "mean" not in age_profile
    assert "median" not in age_profile
    assert "top_values" not in age_profile


@pytest.mark.asyncio
async def test_profile_endpoint_pivot_use_case(client, sample_csv):
    """Test profile for pivot safety check - unique count"""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-profile-pivot",
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

    # Minimal profile for pivot safety - just unique counts
    response = client.post(
        "/api/workflow/tool/profile",
        json={
            "tool_id": "input1",
            "workflow": workflow,
            "socket_id": "output",
            "metrics": ["unique_count"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    columns = data["columns"]

    # All columns should have unique_count
    for col_name, profile in columns.items():
        assert "unique_count" in profile
        assert profile["unique_count"] >= 1

    # city column should have fewer unique values than name
    # (useful for determining good pivot columns)
    assert columns["city"]["unique_count"] == 5
    assert columns["name"]["unique_count"] == 5


@pytest.mark.asyncio
async def test_profile_endpoint_string_quality(client, tmp_path):
    """Test string quality metrics - whitespace, linebreaks, non-ASCII"""
    # Create test CSV with string quality issues
    test_csv = tmp_path / "string_test.csv"
    test_csv.write_text(
        "id,text\n"
        "1,normal\n"
        "2, leading\n"
        "3,trailing \n"
        '4,"line\nbreak"\n'
        "5,caf\u00e9\n"  # non-ASCII e with accent
        "6,zero\u200bwidth\n"  # zero-width space
    )

    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-profile-string",
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
                    "source": str(test_csv),
                },
                "sockets": [{"id": "output", "direction": "output"}],
            },
        ],
        "wires": [],
    }

    response = client.post(
        "/api/workflow/tool/profile",
        json={
            "tool_id": "input1",
            "workflow": workflow,
            "socket_id": "output",
            "columns": ["text"],
            "metrics": [
                "whitespace_leading",
                "whitespace_trailing",
                "contains_linebreaks",
                "contains_non_ascii",
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    text_profile = data["columns"]["text"]

    # Check string quality metrics
    assert text_profile["whitespace_leading"] == 1  # " leading"
    assert text_profile["whitespace_trailing"] == 1  # "trailing "
    assert text_profile["contains_linebreaks"] == 1  # "line\nbreak"
    # Note: \n is outside printable ASCII (0x20-0x7E), so line\nbreak counts too
    assert text_profile["contains_non_ascii"] == 3  # line\nbreak, cafe, and zero-width


@pytest.mark.asyncio
async def test_profile_endpoint_top_values(client, sample_csv):
    """Test top values metric"""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-profile-top",
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
        "/api/workflow/tool/profile",
        json={
            "tool_id": "input1",
            "workflow": workflow,
            "socket_id": "output",
            "columns": ["city"],
            "metrics": ["top_values"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    city_profile = data["columns"]["city"]

    # Check top values structure
    assert "top_values" in city_profile
    top_values = city_profile["top_values"]
    assert len(top_values) <= 5  # Limited to top 5
    assert all("value" in tv and "count" in tv for tv in top_values)


@pytest.mark.asyncio
async def test_profile_endpoint_socket_not_found_error(client, sample_csv):
    """Test profile fails gracefully when socket doesn't exist"""
    workflow = {
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Test",
            "workflowId": "test-profile-error",
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
        "/api/workflow/tool/profile",
        json={
            "tool_id": "input1",
            "workflow": workflow,
            "socket_id": "nonexistent",
        },
    )

    # Should fail with execution error (socket not found)
    assert response.status_code == 500
    detail = response.json()["detail"]
    # Detail is now a structured dict with error_id for log correlation.
    if isinstance(detail, dict):
        assert "error_id" in detail
        assert "not found" in detail["message"].lower()
    else:
        assert "not found" in detail.lower()
