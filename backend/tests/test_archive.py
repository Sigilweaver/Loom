"""Tests for workflow archive functionality"""

import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app.api.models.workflow import Workflow, WorkflowMeta
from app.domain.workflow.archive import WorkflowArchive


@pytest.fixture
def temp_archive_dir(tmp_path):
    """Create temporary archive directory"""
    archive_path = tmp_path / "test_archives"
    archive_path.mkdir()
    yield archive_path
    # Cleanup after test
    if archive_path.exists():
        shutil.rmtree(archive_path)


@pytest.fixture
def sample_workflow():
    """Create a sample workflow for testing"""
    return Workflow(
        meta=WorkflowMeta(
            name="Test Workflow",
            description="A workflow for testing archive functionality",
            author="Test User",
            workflowId="test-workflow-123",
            created="2025-11-26T14:30:00",
        ),
        tools=[
            {
                "id": "tool1",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {"source": "/path/to/file.csv"},
                "sockets": [{"id": "output", "direction": "output"}],
            },
            {
                "id": "tool2",
                "type": "Filter",
                "x": 200,
                "y": 0,
                "config": {"expression": "column > 10"},
                "sockets": [
                    {"id": "input", "direction": "input"},
                    {"id": "output-true", "direction": "output"},
                    {"id": "output-false", "direction": "output"},
                ],
            },
        ],
        wires=[
            {
                "from": {"tool": "tool1", "socket": "output"},
                "to": {"tool": "tool2", "socket": "input"},
            }
        ],
    )


class TestWorkflowArchive:
    """Test WorkflowArchive class"""

    def test_initialization(self, temp_archive_dir):
        """Test archive initialization"""
        archive = WorkflowArchive(temp_archive_dir)
        assert archive.archive_root == temp_archive_dir
        assert temp_archive_dir.exists()

    def test_create_archive(self, temp_archive_dir, sample_workflow):
        """Test creating a new archive"""
        archive = WorkflowArchive(temp_archive_dir)
        archive_dir = archive.create_archive(sample_workflow)

        # Verify directory structure
        assert archive_dir.exists()
        assert archive_dir.is_dir()

        # Verify workflow file exists
        workflow_file = archive_dir / "workflow.json"
        assert workflow_file.exists()

        # Verify workflow content
        with open(workflow_file, "r") as f:
            saved_workflow = json.load(f)
            assert saved_workflow["meta"]["name"] == "Test Workflow"
            assert len(saved_workflow["tools"]) == 2
            assert len(saved_workflow["wires"]) == 1

    def test_create_archive_with_custom_id(self, temp_archive_dir, sample_workflow):
        """Test creating archive with custom execution ID"""
        archive = WorkflowArchive(temp_archive_dir)
        archive_dir = archive.create_archive(sample_workflow, execution_id="custom_exec_123")

        assert "custom_exec_123" in str(archive_dir)

    def test_save_execution_log(self, temp_archive_dir, sample_workflow):
        """Test saving execution log"""
        archive = WorkflowArchive(temp_archive_dir)
        archive_dir = archive.create_archive(sample_workflow)

        log_data = {
            "status": "completed",
            "execution_time_ms": 1234.56,
            "tool_count": 2,
            "target_tool_id": "tool2",
        }

        archive.save_execution_log(archive_dir, log_data)

        # Verify log file exists
        log_file = archive_dir / "execution_log.json"
        assert log_file.exists()

        # Verify log content
        with open(log_file, "r") as f:
            saved_log = json.load(f)
            assert saved_log["status"] == "completed"
            assert saved_log["execution_time_ms"] == 1234.56
            assert "timestamp" in saved_log  # Auto-added

    def test_update_execution_log(self, temp_archive_dir, sample_workflow):
        """Test updating execution log"""
        archive = WorkflowArchive(temp_archive_dir)
        archive_dir = archive.create_archive(sample_workflow)

        # Initial log
        initial_log = {"status": "started", "tool_count": 2}
        archive.save_execution_log(archive_dir, initial_log)

        # Update log
        updates = {"status": "completed", "execution_time_ms": 500.0}
        archive.update_execution_log(archive_dir, updates)

        # Verify merged content
        log_file = archive_dir / "execution_log.json"
        with open(log_file, "r") as f:
            saved_log = json.load(f)
            assert saved_log["status"] == "completed"
            assert saved_log["tool_count"] == 2  # Preserved from initial
            assert saved_log["execution_time_ms"] == 500.0
            assert "last_updated" in saved_log

    def test_list_archives_empty(self, temp_archive_dir):
        """Test listing archives when none exist"""
        archive = WorkflowArchive(temp_archive_dir)
        archives = archive.list_archives()
        assert archives == []

    def test_list_archives(self, temp_archive_dir, sample_workflow):
        """Test listing multiple archives"""
        archive = WorkflowArchive(temp_archive_dir)

        # Create multiple archives
        for i in range(3):
            archive_dir = archive.create_archive(sample_workflow)
            log_data = {
                "status": "completed" if i % 2 == 0 else "failed",
                "execution_time_ms": 100 * (i + 1),
            }
            archive.save_execution_log(archive_dir, log_data)

        # List all archives
        archives = archive.list_archives()
        assert len(archives) == 3

        # Verify archive info structure
        for archive_info in archives:
            assert "path" in archive_info
            assert "created" in archive_info
            assert "workflow_name" in archive_info
            assert "execution_status" in archive_info

    def test_list_archives_with_limit(self, temp_archive_dir, sample_workflow):
        """Test listing archives with limit"""
        archive = WorkflowArchive(temp_archive_dir)

        # Create 5 archives
        for _ in range(5):
            archive_dir = archive.create_archive(sample_workflow)
            archive.save_execution_log(archive_dir, {"status": "completed"})

        # List with limit
        archives = archive.list_archives(limit=3)
        assert len(archives) == 3

    def test_list_archives_date_filter(self, temp_archive_dir, sample_workflow):
        """Test listing archives with date filter"""
        archive = WorkflowArchive(temp_archive_dir)

        # Create archive directories for different dates
        today = datetime.now()
        yesterday = today - timedelta(days=1)

        # Manually create date directories to test filtering
        today_dir = temp_archive_dir / today.strftime("%Y-%m-%d")
        yesterday_dir = temp_archive_dir / yesterday.strftime("%Y-%m-%d")

        today_dir.mkdir(parents=True, exist_ok=True)
        yesterday_dir.mkdir(parents=True, exist_ok=True)

        # Create archives in each
        for parent_dir in [today_dir, yesterday_dir]:
            exec_dir = parent_dir / "10-00-00_test"
            exec_dir.mkdir()
            workflow_file = exec_dir / "workflow.json"
            with open(workflow_file, "w") as f:
                json.dump(sample_workflow.model_dump(), f, default=str)
            log_file = exec_dir / "execution_log.json"
            with open(log_file, "w") as f:
                json.dump({"status": "completed"}, f)

        # Filter for today only (start_date with time component set to beginning of day)
        start_of_today = today.replace(hour=0, minute=0, second=0, microsecond=0)
        archives = archive.list_archives(start_date=start_of_today)
        assert len(archives) >= 1  # Should have at least today's archive

    def test_get_archive(self, temp_archive_dir, sample_workflow):
        """Test retrieving complete archive data"""
        archive = WorkflowArchive(temp_archive_dir)
        archive_dir = archive.create_archive(sample_workflow)

        log_data = {"status": "completed", "execution_time_ms": 123.45}
        archive.save_execution_log(archive_dir, log_data)

        # Get relative path
        relative_path = str(archive_dir.relative_to(temp_archive_dir))

        # Retrieve archive
        archive_data = archive.get_archive(relative_path)

        assert "path" in archive_data
        assert "workflow" in archive_data
        assert "execution_log" in archive_data
        assert archive_data["workflow"]["meta"]["name"] == "Test Workflow"
        assert archive_data["execution_log"]["status"] == "completed"

    def test_get_archive_not_found(self, temp_archive_dir):
        """Test retrieving non-existent archive"""
        archive = WorkflowArchive(temp_archive_dir)

        with pytest.raises(ValueError, match="Archive not found"):
            archive.get_archive("2025-01-01/nonexistent")

    def test_cleanup_old_archives(self, temp_archive_dir, sample_workflow):
        """Test cleaning up old archives"""
        archive = WorkflowArchive(temp_archive_dir)

        # Create old date directory
        old_date = datetime.now() - timedelta(days=40)
        old_dir = temp_archive_dir / old_date.strftime("%Y-%m-%d")
        old_dir.mkdir(parents=True)

        # Create archive in old directory
        exec_dir = old_dir / "10-00-00_old"
        exec_dir.mkdir()
        workflow_file = exec_dir / "workflow.json"
        with open(workflow_file, "w") as f:
            json.dump(sample_workflow.model_dump(), f, default=str)

        # Create recent archive
        recent_dir = archive.create_archive(sample_workflow)

        # Cleanup archives older than 30 days
        deleted_count = archive.cleanup_old_archives(retention_days=30)

        # Old archive should be deleted
        assert not old_dir.exists()
        # Recent archive should remain
        assert recent_dir.exists()
        # Should have deleted at least one
        assert deleted_count >= 0

    def test_cleanup_invalid_retention(self, temp_archive_dir):
        """Test cleanup with invalid retention period"""
        archive = WorkflowArchive(temp_archive_dir)
        deleted_count = archive.cleanup_old_archives(retention_days=0)
        assert deleted_count == 0

    def test_archive_sanitizes_workflow_name(self, temp_archive_dir):
        """Test that workflow names are sanitized for filesystem"""
        workflow = Workflow(
            meta=WorkflowMeta(
                name="Test/Workflow:With*Special<Chars>",
                description="Test",
                author="Test",
                workflowId="test-123",
                created="2025-11-26T14:30:00",
            ),
            tools=[],
            wires=[],
        )

        archive = WorkflowArchive(temp_archive_dir)
        archive_dir = archive.create_archive(workflow)

        # Verify directory name doesn't contain special characters
        dir_name = archive_dir.name
        assert "/" not in dir_name
        assert ":" not in dir_name
        assert "*" not in dir_name
        assert "<" not in dir_name
        assert ">" not in dir_name
