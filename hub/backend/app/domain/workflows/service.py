"""Workflow service for workflow file management.

Orchestrates workflow file storage, metadata extraction,
and database record management.
"""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Workflow
from app.domain.workflows.models import (
    CreateWorkflowInput,
    ParsedWorkflow,
    UpdateWorkflowInput,
    WorkflowContent,
    WorkflowInfo,
)
from app.domain.workflows.parser import ParseError, WorkflowParser
from app.domain.workflows.store import WorkflowFileStore

logger = logging.getLogger(__name__)


class WorkflowServiceError(Exception):
    """Base exception for workflow service errors."""

    pass


class WorkflowNotFoundError(WorkflowServiceError):
    """Raised when a workflow doesn't exist."""

    pass


class WorkflowParseError(WorkflowServiceError):
    """Raised when workflow file parsing fails."""

    pass


class WorkflowService:
    """Service for managing workflow files.

    Handles file storage, metadata extraction, and database records.
    """

    def __init__(
        self,
        db: AsyncSession,
        file_store: WorkflowFileStore | None = None,
        parser: WorkflowParser | None = None,
    ):
        """Initialize the workflow service.

        Args:
            db: Async database session.
            file_store: File store for workflow files.
            parser: Workflow file parser.
        """
        self.db = db
        self.file_store = file_store or WorkflowFileStore()
        self.parser = parser or WorkflowParser()

    def _model_to_info(self, workflow: Workflow) -> WorkflowInfo:
        """Convert database model to WorkflowInfo."""
        # Parse tags from comma-separated string
        tags = [t.strip() for t in workflow.tags.split(",") if t.strip()]

        return WorkflowInfo(
            id=workflow.id,
            name=workflow.name,
            description=workflow.description,
            author=workflow.author,
            workflow_id=workflow.workflow_id,
            folder_path=workflow.folder_path,
            tags=tags,
            checksum=workflow.checksum,
            uploaded_by=workflow.uploaded_by,
            created_at=workflow.created_at,
            updated_at=workflow.updated_at,
        )

    async def create_workflow(
        self,
        content: bytes,
        input: CreateWorkflowInput,
        uploaded_by: str,
    ) -> WorkflowInfo:
        """Create a new workflow from uploaded file.

        Args:
            content: Raw workflow file content.
            input: Additional metadata (folder, tags).
            uploaded_by: Username of uploader.

        Returns:
            WorkflowInfo for the created workflow.

        Raises:
            WorkflowParseError: If file content is invalid.
            WorkflowServiceError: If storage fails.
        """
        # Parse and validate content
        try:
            parsed = self.parser.parse(content)
        except ParseError as e:
            raise WorkflowParseError(str(e))

        # Create database record first to get ID
        workflow = Workflow(
            name=parsed.meta.name,
            description=parsed.meta.description,
            author=parsed.meta.author,
            workflow_id=parsed.meta.workflow_id,
            folder_path=input.folder_path,
            tags=",".join(input.tags),
            file_path="",  # Will update after saving
            checksum="",  # Will update after saving
            uploaded_by=uploaded_by,
        )

        self.db.add(workflow)
        await self.db.flush()  # Get the ID

        # Save file to storage
        try:
            checksum = self.file_store.save(workflow.id, content)
        except Exception as e:
            await self.db.rollback()
            raise WorkflowServiceError(f"Failed to save workflow file: {e}")

        # Update record with file info
        workflow.file_path = str(workflow.id)
        workflow.checksum = checksum

        await self.db.commit()
        await self.db.refresh(workflow)

        logger.info(
            "Created workflow",
            extra={
                "workflow_id": str(workflow.id),
                "workflow_name": workflow.name,
                "uploaded_by": uploaded_by,
            },
        )

        return self._model_to_info(workflow)

    async def get_workflow(self, workflow_id: UUID) -> WorkflowInfo:
        """Get workflow metadata by ID.

        Args:
            workflow_id: The workflow UUID.

        Returns:
            WorkflowInfo for the workflow.

        Raises:
            WorkflowNotFoundError: If workflow doesn't exist.
        """
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowNotFoundError(f"Workflow not found: {workflow_id}")

        return self._model_to_info(workflow)

    async def get_content(self, workflow_id: UUID) -> WorkflowContent:
        """Get parsed workflow content.

        Args:
            workflow_id: The workflow UUID.

        Returns:
            Parsed workflow content.

        Raises:
            WorkflowNotFoundError: If workflow doesn't exist.
            WorkflowParseError: If stored file is corrupted.
        """
        # Verify workflow exists
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowNotFoundError(f"Workflow not found: {workflow_id}")

        # Load and parse file
        try:
            content = self.file_store.load(workflow_id)
            parsed = self.parser.parse(content)
        except ParseError as e:
            raise WorkflowParseError(f"Stored file corrupted: {e}")
        except Exception as e:
            raise WorkflowServiceError(f"Failed to load workflow file: {e}")

        return WorkflowContent(
            version=parsed.version,
            meta=parsed.meta,
            tools=parsed.tools,
            wires=parsed.wires,
        )

    async def get_file(self, workflow_id: UUID) -> bytes:
        """Get raw workflow file content.

        Args:
            workflow_id: The workflow UUID.

        Returns:
            Raw file content.

        Raises:
            WorkflowNotFoundError: If workflow doesn't exist.
        """
        # Verify workflow exists
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowNotFoundError(f"Workflow not found: {workflow_id}")

        try:
            return self.file_store.load(workflow_id)
        except Exception as e:
            raise WorkflowServiceError(f"Failed to load workflow file: {e}")

    def get_file_bytes(self, workflow_id: UUID) -> bytes:
        """Get raw workflow file content synchronously.

        This is a sync method for direct file access without async overhead.

        Args:
            workflow_id: The workflow UUID.

        Returns:
            Raw file content.

        Raises:
            WorkflowServiceError: If file cannot be loaded.
        """
        try:
            return self.file_store.load(workflow_id)
        except Exception as e:
            raise WorkflowServiceError(f"Failed to load workflow file: {e}")

    async def list_workflows(
        self,
        folder_path: str | None = None,
        tag: str | None = None,
        search: str | None = None,
        uploaded_by: str | None = None,
    ) -> list[WorkflowInfo]:
        """List workflows with optional filtering.

        Args:
            folder_path: Filter by exact folder path.
            tag: Filter by tag (partial match).
            search: Search in name and description.
            uploaded_by: Filter by uploader username.

        Returns:
            List of matching WorkflowInfo objects.
        """
        query = select(Workflow)

        if folder_path is not None:
            query = query.where(Workflow.folder_path == folder_path)

        if tag is not None:
            # Tags are comma-separated, do LIKE search
            query = query.where(Workflow.tags.contains(tag))

        if search is not None:
            search_pattern = f"%{search}%"
            query = query.where(
                (Workflow.name.ilike(search_pattern))
                | (Workflow.description.ilike(search_pattern))
            )

        if uploaded_by is not None:
            query = query.where(Workflow.uploaded_by == uploaded_by)

        query = query.order_by(Workflow.updated_at.desc())

        result = await self.db.execute(query)
        workflows = result.scalars().all()

        return [self._model_to_info(w) for w in workflows]

    async def update_workflow(
        self,
        workflow_id: UUID,
        input: UpdateWorkflowInput | None = None,
        content: bytes | None = None,
    ) -> WorkflowInfo:
        """Update workflow metadata and/or file content.

        Args:
            workflow_id: The workflow UUID.
            input: Fields to update (folder_path, tags).
            content: New file content (if updating the file).

        Returns:
            Updated WorkflowInfo.

        Raises:
            WorkflowNotFoundError: If workflow doesn't exist.
            WorkflowParseError: If new content is invalid.
        """
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowNotFoundError(f"Workflow not found: {workflow_id}")

        # Update file content if provided
        if content is not None:
            try:
                parsed = self.parser.parse(content)
            except ParseError as e:
                raise WorkflowParseError(str(e))

            try:
                checksum = self.file_store.save(workflow_id, content, overwrite=True)
            except Exception as e:
                raise WorkflowServiceError(f"Failed to save workflow file: {e}")

            # Update metadata from new file
            workflow.name = parsed.meta.name
            workflow.description = parsed.meta.description
            workflow.author = parsed.meta.author
            workflow.workflow_id = parsed.meta.workflow_id
            workflow.checksum = checksum

        # Update metadata fields if provided
        if input is not None:
            if input.folder_path is not None:
                workflow.folder_path = input.folder_path

            if input.tags is not None:
                workflow.tags = ",".join(input.tags)

        await self.db.commit()
        await self.db.refresh(workflow)

        return self._model_to_info(workflow)

    async def update_file(
        self,
        workflow_id: UUID,
        content: bytes,
    ) -> WorkflowInfo:
        """Update workflow file content.

        Args:
            workflow_id: The workflow UUID.
            content: New file content.

        Returns:
            Updated WorkflowInfo.

        Raises:
            WorkflowNotFoundError: If workflow doesn't exist.
            WorkflowParseError: If new content is invalid.
        """
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowNotFoundError(f"Workflow not found: {workflow_id}")

        # Parse and validate new content
        try:
            parsed = self.parser.parse(content)
        except ParseError as e:
            raise WorkflowParseError(str(e))

        # Save new file
        try:
            checksum = self.file_store.save(workflow_id, content, overwrite=True)
        except Exception as e:
            raise WorkflowServiceError(f"Failed to save workflow file: {e}")

        # Update metadata from new file
        workflow.name = parsed.meta.name
        workflow.description = parsed.meta.description
        workflow.author = parsed.meta.author
        workflow.workflow_id = parsed.meta.workflow_id
        workflow.checksum = checksum

        await self.db.commit()
        await self.db.refresh(workflow)

        return self._model_to_info(workflow)

    async def delete_workflow(self, workflow_id: UUID) -> None:
        """Delete a workflow.

        Args:
            workflow_id: The workflow UUID.

        Raises:
            WorkflowNotFoundError: If workflow doesn't exist.
        """
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowNotFoundError(f"Workflow not found: {workflow_id}")

        # Delete file
        try:
            if self.file_store.exists(workflow_id):
                self.file_store.delete(workflow_id)
        except Exception as e:
            logger.warning(
                "Failed to delete workflow file",
                extra={"workflow_id": str(workflow_id), "error": str(e)},
            )

        # Delete database record
        await self.db.delete(workflow)
        await self.db.commit()

        logger.info(
            "Deleted workflow",
            extra={"workflow_id": str(workflow_id)},
        )
