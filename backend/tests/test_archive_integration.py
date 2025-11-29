"""Integration tests for workflow archival during execution"""

import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.domain.workflow.archive import WorkflowArchive


@pytest.fixture
def temp_archive_for_integration(tmp_path):
    """Set up temporary archive directory and configure settings"""
    original_archive_path = settings.archive_path
    original_archive_enabled = settings.archive_enabled
    
    # Configure temporary archive
    temp_archive = tmp_path / "integration_archives"
    settings.archive_path = str(temp_archive)
    settings.archive_enabled = True
    
    yield temp_archive
    
    # Restore original settings
    settings.archive_path = original_archive_path
    settings.archive_enabled = original_archive_enabled
    
    # Cleanup
    if temp_archive.exists():
        shutil.rmtree(temp_archive)


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


def test_workflow_execution_creates_archive(client, temp_archive_for_integration, sample_csv):
    """Test that workflow execution creates an archive"""
    
    # Create a simple workflow
    workflow = {
        "meta": {
            "name": "Archive Test Workflow",
            "description": "Testing archive creation",
            "author": "Test",
            "workflowId": "archive-test-123",
            "created": "2025-11-26T10:00:00",
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
                    "csvMode": "scan",
                },
                "sockets": [{"id": "output", "direction": "output"}],
            }
        ],
        "wires": [],
    }
    
    # Execute workflow
    response = client.post(
        "/api/workflow/execute",
        json={"workflow": workflow, "preview_limit": 10},
    )
    
    # Debug: print error if failed
    if response.status_code != 200:
        print(f"Error response: {response.json()}")
    
    assert response.status_code == 200
    
    # Verify archive was created
    archive = WorkflowArchive(temp_archive_for_integration)
    archives = archive.list_archives()
    
    assert len(archives) >= 1
    latest_archive = archives[0]
    assert latest_archive["workflow_name"] == "Archive Test Workflow"
    assert latest_archive["execution_status"] in ["completed", "failed"]
    assert latest_archive["execution_time"] is not None


def test_failed_workflow_creates_archive_with_error(client, temp_archive_for_integration):
    """Test that failed workflows also create archives with error details"""
    
    # Create a workflow that will fail (invalid file path)
    workflow = {
        "meta": {
            "name": "Failing Workflow",
            "description": "This workflow should fail",
            "author": "Test",
            "workflowId": "fail-test-123",
            "created": "2025-11-26T10:00:00",
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
                    "source": "/nonexistent/path/to/file.csv",
                    "csvMode": "scan",
                },
                "sockets": [{"id": "output", "direction": "output"}],
            }
        ],
        "wires": [],
    }
    
    # Execute workflow (expect failure)
    response = client.post(
        "/api/workflow/execute",
        json={"workflow": workflow},
    )
    
    # Should return error
    assert response.status_code in [400, 500]
    
    # Verify archive was still created
    archive = WorkflowArchive(temp_archive_for_integration)
    archives = archive.list_archives()
    
    assert len(archives) >= 1
    latest_archive = archives[0]
    assert latest_archive["workflow_name"] == "Failing Workflow"
    assert latest_archive["execution_status"] == "failed"
    assert latest_archive["error"] is not None


def test_archive_api_endpoints(client, temp_archive_for_integration, sample_csv):
    """Test archive API endpoints"""
    
    # First execute a workflow to create an archive
    workflow = {
        "meta": {
            "name": "API Test Workflow",
            "description": "Testing archive API",
            "author": "Test",
            "workflowId": "api-test-123",
            "created": "2025-11-26T10:00:00",
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
                    "csvMode": "scan",
                },
                "sockets": [{"id": "output", "direction": "output"}],
            }
        ],
        "wires": [],
    }
    
    client.post("/api/workflow/execute", json={"workflow": workflow})
    
    # Test list endpoint
    response = client.get("/api/archive/list")
    assert response.status_code == 200
    data = response.json()
    assert "archives" in data
    assert "total" in data
    assert data["total"] >= 1
    
    # Test list with limit
    response = client.get("/api/archive/list?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data["archives"]) <= 5
    
    # Test get archive detail
    archive_path = data["archives"][0]["path"]
    response = client.get(f"/api/archive/detail/{archive_path}")
    assert response.status_code == 200
    detail = response.json()
    assert "workflow" in detail
    assert "execution_log" in detail
    assert detail["workflow"]["meta"]["name"] == "API Test Workflow"
    
    # Test status endpoint
    response = client.get("/api/archive/status")
    assert response.status_code == 200
    status = response.json()
    assert status["enabled"] is True


def test_archive_disabled(client, temp_archive_for_integration):
    """Test that API returns proper error when archiving is disabled"""
    
    # Disable archiving
    settings.archive_enabled = False
    
    # Try to list archives
    response = client.get("/api/archive/list")
    assert response.status_code == 503
    assert "disabled" in response.json()["detail"].lower()
    
    # Re-enable for cleanup
    settings.archive_enabled = True
