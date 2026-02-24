"""File-based workflow storage.

This module provides file storage for workflow (.swwf) files.
Workflows are stored as binary files with SHA-256 checksums
for integrity verification.
"""

import hashlib
import logging
from pathlib import Path
from uuid import UUID

from app.config import settings

logger = logging.getLogger(__name__)


class WorkflowStoreError(Exception):
    """Base exception for workflow store errors."""

    pass


class FileNotFoundError(WorkflowStoreError):
    """Raised when a workflow file doesn't exist."""

    pass


class FileAlreadyExistsError(WorkflowStoreError):
    """Raised when trying to save without overwrite and file exists."""

    pass


class WorkflowFileStore:
    """File-based storage for workflow files.

    Stores workflow files (.swwf) on disk with SHA-256 checksums
    for integrity verification. Files are named by workflow UUID.
    """

    EXTENSION = ".swwf"

    def __init__(self, storage_path: str | None = None):
        """Initialize the workflow file store.

        Args:
            storage_path: Directory for storing workflow files.
                         Uses settings.workflow_storage_path if None.
        """
        self.storage_path = Path(
            storage_path or str(getattr(settings, "workflow_storage_path", "./workflows"))
        )
        # Create storage directory if it doesn't exist
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def _get_path(self, workflow_id: UUID) -> Path:
        """Get the file path for a workflow ID.

        Args:
            workflow_id: The workflow UUID.

        Returns:
            Path to the workflow file.
        """
        return self.storage_path / f"{workflow_id}{self.EXTENSION}"

    def calculate_checksum(self, content: bytes) -> str:
        """Calculate SHA-256 checksum for content.

        Args:
            content: Bytes to checksum.

        Returns:
            Hex-encoded SHA-256 hash (64 characters).
        """
        return hashlib.sha256(content).hexdigest()

    def save(
        self,
        workflow_id: UUID,
        content: bytes,
        overwrite: bool = False,
    ) -> str:
        """Save workflow content to file.

        Args:
            workflow_id: The workflow UUID.
            content: Workflow file content as bytes.
            overwrite: If True, overwrite existing file.

        Returns:
            SHA-256 checksum of the saved content.

        Raises:
            FileAlreadyExistsError: If file exists and overwrite is False.
        """
        file_path = self._get_path(workflow_id)

        if file_path.exists() and not overwrite:
            raise FileAlreadyExistsError(
                f"Workflow file already exists: {workflow_id}. "
                "Use overwrite=True to replace."
            )

        file_path.write_bytes(content)
        checksum = self.calculate_checksum(content)

        logger.debug(
            "Saved workflow file",
            extra={
                "workflow_id": str(workflow_id),
                "size": len(content),
                "checksum": checksum[:16] + "...",
            },
        )

        return checksum

    def load(self, workflow_id: UUID) -> bytes:
        """Load workflow content from file.

        Args:
            workflow_id: The workflow UUID.

        Returns:
            Workflow file content as bytes.

        Raises:
            FileNotFoundError: If workflow file doesn't exist.
        """
        file_path = self._get_path(workflow_id)

        if not file_path.exists():
            raise FileNotFoundError(f"Workflow file not found: {workflow_id}")

        return file_path.read_bytes()

    def delete(self, workflow_id: UUID) -> None:
        """Delete a workflow file.

        Args:
            workflow_id: The workflow UUID.

        Raises:
            FileNotFoundError: If workflow file doesn't exist.
        """
        file_path = self._get_path(workflow_id)

        if not file_path.exists():
            raise FileNotFoundError(f"Workflow file not found: {workflow_id}")

        file_path.unlink()

        logger.debug(
            "Deleted workflow file",
            extra={"workflow_id": str(workflow_id)},
        )

    def exists(self, workflow_id: UUID) -> bool:
        """Check if a workflow file exists.

        Args:
            workflow_id: The workflow UUID.

        Returns:
            True if file exists, False otherwise.
        """
        return self._get_path(workflow_id).exists()

    def verify_checksum(self, workflow_id: UUID, expected_checksum: str) -> bool:
        """Verify file integrity against expected checksum.

        Args:
            workflow_id: The workflow UUID.
            expected_checksum: Expected SHA-256 checksum.

        Returns:
            True if checksum matches, False otherwise.

        Raises:
            FileNotFoundError: If workflow file doesn't exist.
        """
        content = self.load(workflow_id)
        actual_checksum = self.calculate_checksum(content)
        return actual_checksum == expected_checksum

    def get_file_path(self, workflow_id: UUID) -> Path:
        """Get the path to a workflow file.

        Args:
            workflow_id: The workflow UUID.

        Returns:
            Path to the workflow file.

        Raises:
            FileNotFoundError: If workflow file doesn't exist.
        """
        file_path = self._get_path(workflow_id)

        if not file_path.exists():
            raise FileNotFoundError(f"Workflow file not found: {workflow_id}")

        return file_path
