"""Tests for file path security validation in Hub mode.

This module tests the security enforcement of file path grants when the server
is operating in Hub mode. It verifies that:
1. File reads are restricted to granted paths
2. File writes are restricted to granted paths
3. Read-only paths block write operations
4. Paths outside grants are rejected
"""

import pytest
from pathlib import Path
from fastapi import HTTPException

from app.utils.security import (
    FilePathGrant,
    allowed_paths_context,
    validate_file_path,
    validate_file_path_for_write,
)


@pytest.fixture
def sample_csv_file(tmp_path: Path) -> Path:
    """Create a sample CSV file for testing."""
    csv_file = tmp_path / "data" / "test.csv"
    csv_file.parent.mkdir(parents=True, exist_ok=True)
    csv_file.write_text("a,b,c\n1,2,3\n")
    return csv_file


@pytest.fixture
def another_csv_file(tmp_path: Path) -> Path:
    """Create another CSV file in a different directory."""
    csv_file = tmp_path / "other" / "other.csv"
    csv_file.parent.mkdir(parents=True, exist_ok=True)
    csv_file.write_text("x,y,z\n4,5,6\n")
    return csv_file


class TestFilePathValidationWithoutContext:
    """Tests for file path validation when no Hub context is set (non-hub mode)."""

    def test_valid_file_passes(self, sample_csv_file: Path):
        """A valid file path should pass when no context is set."""
        result = validate_file_path(str(sample_csv_file))
        assert result == sample_csv_file.resolve()

    def test_nonexistent_file_fails(self, tmp_path: Path):
        """A nonexistent file should raise 404."""
        with pytest.raises(HTTPException) as exc_info:
            validate_file_path(str(tmp_path / "nonexistent.csv"))
        assert exc_info.value.status_code == 404

    def test_directory_fails(self, tmp_path: Path):
        """A directory path should raise 400."""
        with pytest.raises(HTTPException) as exc_info:
            validate_file_path(str(tmp_path))
        assert exc_info.value.status_code == 400


class TestFilePathValidationWithContext:
    """Tests for file path validation with Hub context (Hub mode)."""

    def test_file_in_granted_path_passes(self, sample_csv_file: Path):
        """A file within a granted path should pass."""
        grants = [FilePathGrant(path=str(sample_csv_file.parent), read_only=False)]
        token = allowed_paths_context.set(grants)
        try:
            result = validate_file_path(str(sample_csv_file))
            assert result == sample_csv_file.resolve()
        finally:
            allowed_paths_context.reset(token)

    def test_file_outside_granted_path_fails(
        self, sample_csv_file: Path, another_csv_file: Path
    ):
        """A file outside granted paths should raise 403."""
        # Grant only the 'data' directory, but try to access 'other' directory
        grants = [FilePathGrant(path=str(sample_csv_file.parent), read_only=False)]
        token = allowed_paths_context.set(grants)
        try:
            with pytest.raises(HTTPException) as exc_info:
                validate_file_path(str(another_csv_file))
            assert exc_info.value.status_code == 403
            assert "not allowed" in str(exc_info.value.detail).lower()
        finally:
            allowed_paths_context.reset(token)

    def test_empty_grants_fails(self, sample_csv_file: Path):
        """Empty grants list should reject all file access."""
        grants: list[FilePathGrant] = []
        token = allowed_paths_context.set(grants)
        try:
            with pytest.raises(HTTPException) as exc_info:
                validate_file_path(str(sample_csv_file))
            assert exc_info.value.status_code == 403
            assert "no file paths granted" in str(exc_info.value.detail).lower()
        finally:
            allowed_paths_context.reset(token)

    def test_multiple_grants_allows_any(
        self, sample_csv_file: Path, another_csv_file: Path
    ):
        """File in any of multiple granted paths should pass."""
        grants = [
            FilePathGrant(path=str(sample_csv_file.parent), read_only=False),
            FilePathGrant(path=str(another_csv_file.parent), read_only=False),
        ]
        token = allowed_paths_context.set(grants)
        try:
            # Both should pass
            result1 = validate_file_path(str(sample_csv_file))
            result2 = validate_file_path(str(another_csv_file))
            assert result1 == sample_csv_file.resolve()
            assert result2 == another_csv_file.resolve()
        finally:
            allowed_paths_context.reset(token)

    def test_nested_file_in_granted_parent_passes(self, tmp_path: Path):
        """A file in a subdirectory of a granted path should pass."""
        # Create nested structure
        nested_file = tmp_path / "granted" / "subdir" / "deep" / "file.csv"
        nested_file.parent.mkdir(parents=True, exist_ok=True)
        nested_file.write_text("a,b\n1,2\n")

        # Grant the parent directory
        grants = [FilePathGrant(path=str(tmp_path / "granted"), read_only=False)]
        token = allowed_paths_context.set(grants)
        try:
            result = validate_file_path(str(nested_file))
            assert result == nested_file.resolve()
        finally:
            allowed_paths_context.reset(token)


class TestFilePathValidationForWrite:
    """Tests for file path write validation."""

    def test_write_to_granted_path_passes(self, tmp_path: Path):
        """Writing to a granted non-read-only path should pass."""
        write_dest = tmp_path / "output" / "result.csv"
        grants = [FilePathGrant(path=str(tmp_path / "output"), read_only=False)]
        token = allowed_paths_context.set(grants)
        try:
            result = validate_file_path_for_write(str(write_dest))
            assert result == write_dest.resolve()
        finally:
            allowed_paths_context.reset(token)

    def test_write_to_read_only_path_fails(self, tmp_path: Path):
        """Writing to a read-only path should raise 403."""
        write_dest = tmp_path / "readonly" / "result.csv"
        grants = [FilePathGrant(path=str(tmp_path / "readonly"), read_only=True)]
        token = allowed_paths_context.set(grants)
        try:
            with pytest.raises(HTTPException) as exc_info:
                validate_file_path_for_write(str(write_dest))
            assert exc_info.value.status_code == 403
            assert "read-only" in str(exc_info.value.detail).lower()
        finally:
            allowed_paths_context.reset(token)

    def test_write_outside_granted_path_fails(self, tmp_path: Path):
        """Writing outside granted paths should raise 403."""
        write_dest = tmp_path / "unauthorized" / "result.csv"
        grants = [FilePathGrant(path=str(tmp_path / "authorized"), read_only=False)]
        token = allowed_paths_context.set(grants)
        try:
            with pytest.raises(HTTPException) as exc_info:
                validate_file_path_for_write(str(write_dest))
            assert exc_info.value.status_code == 403
            assert "not allowed" in str(exc_info.value.detail).lower()
        finally:
            allowed_paths_context.reset(token)

    def test_write_with_empty_grants_fails(self, tmp_path: Path):
        """Writing with empty grants should raise 403."""
        write_dest = tmp_path / "output" / "result.csv"
        grants: list[FilePathGrant] = []
        token = allowed_paths_context.set(grants)
        try:
            with pytest.raises(HTTPException) as exc_info:
                validate_file_path_for_write(str(write_dest))
            assert exc_info.value.status_code == 403
        finally:
            allowed_paths_context.reset(token)

    def test_write_without_context_passes(self, tmp_path: Path):
        """Writing without Hub context should pass (non-hub mode)."""
        write_dest = tmp_path / "output" / "result.csv"
        result = validate_file_path_for_write(str(write_dest))
        assert result == write_dest.resolve()


class TestPathTraversalPrevention:
    """Tests for path traversal attack prevention."""

    def test_path_traversal_with_dotdot_fails(self, tmp_path: Path):
        """Path traversal using .. should be caught."""
        # Create a file outside the granted directory
        outside_file = tmp_path / "outside" / "secret.csv"
        outside_file.parent.mkdir(parents=True, exist_ok=True)
        outside_file.write_text("secret,data\n1,2\n")

        # Create granted directory
        granted_dir = tmp_path / "granted"
        granted_dir.mkdir(parents=True, exist_ok=True)

        # Try to access outside file using path traversal
        traversal_path = str(granted_dir / ".." / "outside" / "secret.csv")

        grants = [FilePathGrant(path=str(granted_dir), read_only=False)]
        token = allowed_paths_context.set(grants)
        try:
            with pytest.raises(HTTPException) as exc_info:
                validate_file_path(traversal_path)
            assert exc_info.value.status_code == 403
        finally:
            allowed_paths_context.reset(token)

    def test_resolved_path_in_granted_with_dotdot_passes(self, tmp_path: Path):
        """Path with .. that resolves to within granted path should pass."""
        # Create structure: granted/subdir/file.csv
        granted_dir = tmp_path / "granted"
        subdir = granted_dir / "subdir"
        file_path = subdir / "file.csv"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text("a,b\n1,2\n")

        # Access using .. that stays within granted path
        traversal_path = str(granted_dir / "subdir" / ".." / "subdir" / "file.csv")

        grants = [FilePathGrant(path=str(granted_dir), read_only=False)]
        token = allowed_paths_context.set(grants)
        try:
            result = validate_file_path(traversal_path)
            assert result == file_path.resolve()
        finally:
            allowed_paths_context.reset(token)
