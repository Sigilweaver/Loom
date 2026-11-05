"""Workflow service for workflow file management.

Orchestrates workflow file storage, metadata extraction,
and database record management.
"""

import difflib
import json
import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Execution, Schedule, Workflow, WorkflowRevision
from app.domain.workflows.models import (
    CreateWorkflowInput,
    UpdateWorkflowInput,
    WorkflowContent,
    WorkflowInfo,
    WorkflowRevisionInfo,
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


class WorkflowInUseError(WorkflowServiceError):
    """Raised when deleting a workflow that schedules or executions reference."""

    pass


class RevisionNotFoundError(WorkflowServiceError):
    """Raised when a workflow revision doesn't exist."""

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

    @staticmethod
    def _revision_to_info(revision: WorkflowRevision) -> WorkflowRevisionInfo:
        """Convert a revision model to its info schema (omits the blob)."""
        return WorkflowRevisionInfo(
            id=revision.id,
            workflow_id=revision.workflow_id,
            revision_number=revision.revision_number,
            parent_revision_id=revision.parent_revision_id,
            author=revision.author,
            checksum=revision.checksum,
            size_bytes=len(revision.blob),
            message=revision.message,
            created_at=revision.created_at,
        )

    async def _create_revision(
        self,
        workflow: Workflow,
        content: bytes,
        author: str,
        message: str,
    ) -> WorkflowRevision:
        """Append a new immutable revision for a content-changing save.

        The new revision points at the workflow's current latest revision as
        its parent and takes the next monotonic revision number. The caller is
        responsible for committing the surrounding transaction.
        """
        result = await self.db.execute(
            select(WorkflowRevision)
            .where(WorkflowRevision.workflow_id == workflow.id)
            .order_by(WorkflowRevision.revision_number.desc())
            .limit(1)
        )
        latest = result.scalar_one_or_none()
        parent_id = latest.id if latest else None
        next_number = (latest.revision_number + 1) if latest else 1

        revision = WorkflowRevision(
            workflow_id=workflow.id,
            revision_number=next_number,
            parent_revision_id=parent_id,
            author=author,
            checksum=workflow.checksum,
            blob=content,
            message=message,
        )
        self.db.add(revision)
        await self.db.flush()
        return revision

    async def create_workflow(
        self,
        content: bytes,
        input: CreateWorkflowInput,
        uploaded_by: str,
        message: str | None = None,
    ) -> WorkflowInfo:
        """Create a new workflow from uploaded file.

        Args:
            content: Raw workflow file content.
            input: Additional metadata (folder, tags).
            uploaded_by: Username of uploader.
            message: Optional revision message for the initial version.

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

        # Record the initial revision (append-only history).
        await self._create_revision(
            workflow,
            content,
            author=uploaded_by,
            message=message or "Initial upload",
        )

        try:
            await self.db.commit()
        except Exception:
            self._restore_file(workflow.id, None)
            raise
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
        author: str | None = None,
        message: str | None = None,
    ) -> WorkflowInfo:
        """Update workflow metadata and/or file content.

        Args:
            workflow_id: The workflow UUID.
            input: Fields to update (folder_path, tags).
            content: New file content (if updating the file).
            author: Username recorded on the revision when content changes.
            message: Optional revision message when content changes.

        Returns:
            Updated WorkflowInfo.

        Raises:
            WorkflowNotFoundError: If workflow doesn't exist.
            WorkflowParseError: If new content is invalid.
        """
        # Lock the row: concurrent saves of one workflow are serialized, so
        # they cannot pick the same revision number or interleave file writes.
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id).with_for_update()
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise WorkflowNotFoundError(f"Workflow not found: {workflow_id}")

        if content is not None:
            try:
                parsed = self.parser.parse(content)
            except ParseError as e:
                raise WorkflowParseError(str(e))

            workflow.name = parsed.meta.name
            workflow.description = parsed.meta.description
            workflow.author = parsed.meta.author
            workflow.workflow_id = parsed.meta.workflow_id
            workflow.checksum = self.file_store.calculate_checksum(content)

            # Record a new revision for the content change.
            await self._create_revision(
                workflow,
                content,
                author=author or workflow.uploaded_by,
                message=message or "Updated workflow",
            )

        if input is not None:
            if input.folder_path is not None:
                workflow.folder_path = input.folder_path

            if input.tags is not None:
                workflow.tags = ",".join(input.tags)

        # Surface database errors before the file on disk changes.
        await self.db.flush()

        previous: bytes | None = None
        if content is not None:
            if self.file_store.exists(workflow_id):
                previous = self.file_store.load(workflow_id)
            try:
                self.file_store.save(workflow_id, content, overwrite=True)
            except Exception as e:
                await self.db.rollback()
                raise WorkflowServiceError(f"Failed to save workflow file: {e}")

        try:
            await self.db.commit()
        except Exception:
            if content is not None:
                self._restore_file(workflow_id, previous)
            raise
        await self.db.refresh(workflow)

        return self._model_to_info(workflow)

    def _restore_file(self, workflow_id: UUID, previous: bytes | None) -> None:
        """Put back the file content that matches the (rolled back) database."""
        try:
            if previous is None:
                if self.file_store.exists(workflow_id):
                    self.file_store.delete(workflow_id)
            else:
                self.file_store.save(workflow_id, previous, overwrite=True)
        except Exception:
            logger.exception(
                "Failed to restore workflow file %s after a failed save; its "
                "content no longer matches the stored checksum",
                workflow_id,
            )

    # =========================================================================
    # Revision history
    # =========================================================================

    async def _require_workflow(self, workflow_id: UUID) -> Workflow:
        """Fetch a workflow or raise WorkflowNotFoundError."""
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        if not workflow:
            raise WorkflowNotFoundError(f"Workflow not found: {workflow_id}")
        return workflow

    async def list_revisions(self, workflow_id: UUID) -> list[WorkflowRevisionInfo]:
        """List a workflow's revisions, newest first.

        Raises:
            WorkflowNotFoundError: If the workflow doesn't exist.
        """
        await self._require_workflow(workflow_id)

        result = await self.db.execute(
            select(WorkflowRevision)
            .where(WorkflowRevision.workflow_id == workflow_id)
            .order_by(WorkflowRevision.revision_number.desc())
        )
        revisions = result.scalars().all()
        return [self._revision_to_info(r) for r in revisions]

    async def _get_revision(
        self, workflow_id: UUID, revision_id: UUID
    ) -> WorkflowRevision:
        """Fetch a single revision scoped to its workflow, or raise."""
        result = await self.db.execute(
            select(WorkflowRevision).where(
                WorkflowRevision.id == revision_id,
                WorkflowRevision.workflow_id == workflow_id,
            )
        )
        revision = result.scalar_one_or_none()
        if not revision:
            raise RevisionNotFoundError(f"Revision not found: {revision_id}")
        return revision

    async def get_revision_content(
        self, workflow_id: UUID, revision_id: UUID
    ) -> tuple[WorkflowRevisionInfo, bytes]:
        """Return a revision's metadata and its raw file blob.

        Raises:
            WorkflowNotFoundError: If the workflow doesn't exist.
            RevisionNotFoundError: If the revision doesn't exist.
        """
        await self._require_workflow(workflow_id)
        revision = await self._get_revision(workflow_id, revision_id)
        return self._revision_to_info(revision), revision.blob

    @staticmethod
    def _pretty_lines(content: bytes, label: str) -> list[str]:
        """Render content as stable, line-split text for diffing.

        Workflow files are JSON; pretty-print with sorted keys so structural
        diffs are meaningful and independent of key ordering. Fall back to the
        raw decoded text if the content isn't valid JSON.
        """
        text = content.decode("utf-8", errors="replace")
        try:
            parsed = json.loads(text)
            text = json.dumps(parsed, indent=2, sort_keys=True, ensure_ascii=False)
        except (json.JSONDecodeError, ValueError):
            pass
        return text.splitlines(keepends=True)

    async def diff_revisions(
        self,
        workflow_id: UUID,
        from_revision_id: UUID,
        to_revision_id: UUID,
    ) -> str:
        """Produce a unified diff between two revisions of a workflow.

        Raises:
            WorkflowNotFoundError: If the workflow doesn't exist.
            RevisionNotFoundError: If either revision doesn't exist.
        """
        await self._require_workflow(workflow_id)
        from_rev = await self._get_revision(workflow_id, from_revision_id)
        to_rev = await self._get_revision(workflow_id, to_revision_id)

        from_label = f"revision {from_rev.revision_number}"
        to_label = f"revision {to_rev.revision_number}"
        diff = difflib.unified_diff(
            self._pretty_lines(from_rev.blob, from_label),
            self._pretty_lines(to_rev.blob, to_label),
            fromfile=from_label,
            tofile=to_label,
        )
        return "".join(diff)

    async def rollback_to_revision(
        self,
        workflow_id: UUID,
        revision_id: UUID,
        author: str,
        message: str | None = None,
    ) -> WorkflowInfo:
        """Roll a workflow back to a prior revision's content.

        Rollback is non-destructive: it restores the target revision's blob as
        the current file and appends a new revision recording the rollback, so
        history is never rewritten.

        Raises:
            WorkflowNotFoundError: If the workflow doesn't exist.
            RevisionNotFoundError: If the revision doesn't exist.
            WorkflowParseError: If the stored revision blob is invalid.
        """
        await self._require_workflow(workflow_id)
        target = await self._get_revision(workflow_id, revision_id)
        blob = target.blob

        return await self.update_workflow(
            workflow_id=workflow_id,
            content=blob,
            author=author,
            message=message or f"Rollback to revision {target.revision_number}",
        )

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

        executions = (
            await self.db.execute(
                select(func.count()).select_from(Execution).where(
                    Execution.workflow_id == workflow_id
                )
            )
        ).scalar_one()
        schedules = (
            await self.db.execute(
                select(func.count()).select_from(Schedule).where(
                    Schedule.workflow_id == workflow_id
                )
            )
        ).scalar_one()
        if executions or schedules:
            raise WorkflowInUseError(
                f"Workflow has {schedules} schedule(s) and {executions} "
                "execution(s); delete its schedules first. Workflows with "
                "execution history are kept."
            )

        # Delete the database record first, so a failure leaves the workflow
        # intact rather than a row without its file.
        await self.db.delete(workflow)
        await self.db.commit()

        try:
            if self.file_store.exists(workflow_id):
                self.file_store.delete(workflow_id)
        except Exception:
            logger.exception("Failed to delete file of deleted workflow %s", workflow_id)

        logger.info(
            "Deleted workflow",
            extra={"workflow_id": str(workflow_id)},
        )
