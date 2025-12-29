"""Tests for workflow file store."""

import json
import tempfile
from pathlib import Path
from uuid import uuid4

import pytest

from app.domain.workflows.store import (
    FileAlreadyExistsError,
    FileNotFoundError,
    WorkflowFileStore,
)


@pytest.fixture
def temp_storage():
    """Create a temporary storage directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def store(temp_storage):
    """Create a file store with temporary storage."""
    return WorkflowFileStore(storage_path=temp_storage)


@pytest.fixture
def sample_workflow_bytes():
    """Sample workflow content as bytes."""
    return json.dumps({
        "version": "2.0",
        "meta": {
            "name": "Test Workflow",
            "description": "Test",
            "author": "Tester",
            "workflowId": "test-123",
            "created": "2025-01-01",
        },
        "tools": [],
        "wires": [],
    }).encode("utf-8")


class TestWorkflowFileStore:
    """Tests for WorkflowFileStore."""

    def test_save_and_load(self, store, sample_workflow_bytes):
        """Save and load a workflow file."""
        workflow_id = uuid4()

        checksum = store.save(workflow_id, sample_workflow_bytes)

        assert checksum  # Non-empty checksum
        assert len(checksum) == 64  # SHA-256 hex length

        loaded = store.load(workflow_id)
        assert loaded == sample_workflow_bytes

    def test_save_creates_file(self, store, sample_workflow_bytes, temp_storage):
        """Saving creates the file on disk."""
        workflow_id = uuid4()

        store.save(workflow_id, sample_workflow_bytes)

        file_path = Path(temp_storage) / f"{workflow_id}.swwf"
        assert file_path.exists()
        assert file_path.read_bytes() == sample_workflow_bytes

    def test_save_no_overwrite_by_default(self, store, sample_workflow_bytes):
        """Cannot overwrite existing file without overwrite=True."""
        workflow_id = uuid4()

        store.save(workflow_id, sample_workflow_bytes)

        with pytest.raises(FileAlreadyExistsError):
            store.save(workflow_id, sample_workflow_bytes)

    def test_save_with_overwrite(self, store, sample_workflow_bytes):
        """Can overwrite with overwrite=True."""
        workflow_id = uuid4()

        store.save(workflow_id, sample_workflow_bytes)
        new_content = b'{"version": "3.0"}'
        checksum = store.save(workflow_id, new_content, overwrite=True)

        loaded = store.load(workflow_id)
        assert loaded == new_content
        assert checksum == store.calculate_checksum(new_content)

    def test_load_nonexistent(self, store):
        """Loading nonexistent file raises error."""
        workflow_id = uuid4()

        with pytest.raises(FileNotFoundError):
            store.load(workflow_id)

    def test_delete(self, store, sample_workflow_bytes, temp_storage):
        """Delete removes the file."""
        workflow_id = uuid4()
        store.save(workflow_id, sample_workflow_bytes)

        store.delete(workflow_id)

        file_path = Path(temp_storage) / f"{workflow_id}.swwf"
        assert not file_path.exists()

    def test_delete_nonexistent(self, store):
        """Deleting nonexistent file raises error."""
        workflow_id = uuid4()

        with pytest.raises(FileNotFoundError):
            store.delete(workflow_id)

    def test_exists(self, store, sample_workflow_bytes):
        """Check if file exists."""
        workflow_id = uuid4()

        assert not store.exists(workflow_id)

        store.save(workflow_id, sample_workflow_bytes)

        assert store.exists(workflow_id)

    def test_verify_checksum_match(self, store, sample_workflow_bytes):
        """Verify checksum returns True when matching."""
        workflow_id = uuid4()
        checksum = store.save(workflow_id, sample_workflow_bytes)

        assert store.verify_checksum(workflow_id, checksum)

    def test_verify_checksum_mismatch(self, store, sample_workflow_bytes):
        """Verify checksum returns False when not matching."""
        workflow_id = uuid4()
        store.save(workflow_id, sample_workflow_bytes)

        assert not store.verify_checksum(workflow_id, "wrong-checksum")

    def test_get_file_path(self, store, sample_workflow_bytes):
        """Get file path returns correct path."""
        workflow_id = uuid4()
        store.save(workflow_id, sample_workflow_bytes)

        path = store.get_file_path(workflow_id)

        assert path.exists()
        assert path.name == f"{workflow_id}.swwf"

    def test_get_file_path_nonexistent(self, store):
        """Get file path raises for nonexistent file."""
        workflow_id = uuid4()

        with pytest.raises(FileNotFoundError):
            store.get_file_path(workflow_id)

    def test_calculate_checksum_deterministic(self, store):
        """Same content always produces same checksum."""
        content = b"test content"

        checksum1 = store.calculate_checksum(content)
        checksum2 = store.calculate_checksum(content)

        assert checksum1 == checksum2

    def test_calculate_checksum_different_content(self, store):
        """Different content produces different checksums."""
        checksum1 = store.calculate_checksum(b"content 1")
        checksum2 = store.calculate_checksum(b"content 2")

        assert checksum1 != checksum2

    def test_storage_dir_created(self, temp_storage):
        """Storage directory is created if it doesn't exist."""
        nested_path = Path(temp_storage) / "nested" / "path"

        _store = WorkflowFileStore(storage_path=str(nested_path))

        assert nested_path.exists()
        assert nested_path.is_dir()
