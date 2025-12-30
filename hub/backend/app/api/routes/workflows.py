"""Workflow management routes.

Provides CRUD operations for workflow files:
- Upload .swwf files with automatic metadata extraction
- List/search workflows with filtering
- Download original files
- Update workflow file or metadata
- Delete workflows
"""

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, RequireAuditor, RequireUser
from app.db.database import get_db
from app.domain.auth.sessions import SessionInfo
from app.domain.workflows import (
    CreateWorkflowInput,
    UpdateWorkflowInput,
    WorkflowInfo,
    WorkflowNotFoundError,
    WorkflowService,
    WorkflowServiceError,
)
from app.domain.workflows.service import WorkflowParseError

router = APIRouter(prefix="/workflows")


def _to_iso_utc(dt: datetime) -> str:
    """Convert datetime to ISO format with UTC timezone suffix.

    Handles both naive and aware datetimes. Naive datetimes are assumed to be UTC.
    """
    if dt.tzinfo is None:
        # Naive datetime - assume UTC and add timezone
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat()


class WorkflowMetadata(BaseModel):
    """Workflow metadata response model."""

    id: UUID
    name: str
    description: str
    author: str
    workflow_id: str  # Original ID from file
    folder_path: str
    tags: list[str]
    checksum: str
    uploaded_by: str
    created_at: str
    updated_at: str

    @classmethod
    def from_info(cls, info: WorkflowInfo) -> "WorkflowMetadata":
        """Create from WorkflowInfo."""
        return cls(
            id=info.id,
            name=info.name,
            description=info.description,
            author=info.author,
            workflow_id=info.workflow_id,
            folder_path=info.folder_path,
            tags=info.tags,
            checksum=info.checksum,
            uploaded_by=info.uploaded_by,
            created_at=_to_iso_utc(info.created_at),
            updated_at=_to_iso_utc(info.updated_at),
        )


class WorkflowListResponse(BaseModel):
    """List of workflows response."""

    workflows: list[WorkflowMetadata]
    total: int


class WorkflowUploadResponse(BaseModel):
    """Response after uploading a workflow."""

    id: UUID
    name: str
    message: str


class WorkflowContentResponse(BaseModel):
    """Full workflow content response."""

    version: str
    meta: dict[str, Any]
    tools: list[dict[str, Any]]
    wires: list[dict[str, Any]]


class WorkflowUpdateMetadataRequest(BaseModel):
    """Request to update workflow metadata (not file content)."""

    folder_path: str | None = None
    tags: list[str] | None = None


def _get_service(db: AsyncSession) -> WorkflowService:
    """Create WorkflowService instance."""
    return WorkflowService(db)


# =============================================================================
# User's Workflows (self-service) - MUST be before other routes
# =============================================================================


@router.get("/my", response_model=WorkflowListResponse)
async def list_my_workflows(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    folder: str | None = None,
    tag: str | None = None,
    search: str | None = None,
) -> WorkflowListResponse:
    """List workflows uploaded by the current user.

    Query parameters:
    - folder: Filter by exact folder path
    - tag: Filter by tag (partial match)
    - search: Search in name and description
    """
    service = _get_service(db)
    workflows = await service.list_workflows(
        folder_path=folder,
        tag=tag,
        search=search,
        uploaded_by=user.username,
    )
    return WorkflowListResponse(
        workflows=[WorkflowMetadata.from_info(w) for w in workflows],
        total=len(workflows),
    )


# =============================================================================
# Admin/Auditor Workflows (all workflows)
# =============================================================================


@router.get("", response_model=WorkflowListResponse)
async def list_workflows(
    _auditor: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
    folder: str | None = None,
    tag: str | None = None,
    search: str | None = None,
    uploaded_by: str | None = None,
) -> WorkflowListResponse:
    """List all workflows, optionally filtered. Requires auditor role or higher.

    Query parameters:
    - folder: Filter by exact folder path
    - tag: Filter by tag (partial match)
    - search: Search in name and description
    - uploaded_by: Filter by uploader username
    """
    service = _get_service(db)
    workflows = await service.list_workflows(
        folder_path=folder,
        tag=tag,
        search=search,
        uploaded_by=uploaded_by,
    )
    return WorkflowListResponse(
        workflows=[WorkflowMetadata.from_info(w) for w in workflows],
        total=len(workflows),
    )


@router.post(
    "",
    response_model=WorkflowUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_workflow(
    user: SessionInfo = RequireUser,
    file: Annotated[UploadFile, File(description="The .swwf workflow file")] = None,
    db: AsyncSession = Depends(get_db),
    folder_path: str = Form(default="/"),
    tags: str = Form(default=""),  # Comma-separated
) -> WorkflowUploadResponse:
    """Upload a new workflow file. Requires user role.

    The file must be a valid .swwf workflow file. Metadata (name, description,
    author) is automatically extracted from the file.

    Form data:
    - folder_path: Virtual folder path (default: "/")
    - tags: Comma-separated list of tags
    """
    if not file.filename or not file.filename.endswith(".swwf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a .swwf workflow file",
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    service = _get_service(db)

    try:
        input = CreateWorkflowInput(
            folder_path=folder_path,
            tags=[t.strip() for t in tags.split(",") if t.strip()],
        )
        info = await service.create_workflow(
            content=content,
            input=input,
            uploaded_by=user.username,
        )
    except WorkflowParseError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid workflow file: {e}",
        )
    except WorkflowServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    return WorkflowUploadResponse(
        id=info.id,
        name=info.name,
        message="Workflow uploaded successfully",
    )


@router.get("/{workflow_id}", response_model=WorkflowMetadata)
async def get_workflow(
    workflow_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> WorkflowMetadata:
    """Get workflow metadata by ID. Requires auditor role or higher."""
    service = _get_service(db)

    try:
        info = await service.get_workflow(workflow_id)
    except WorkflowNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    return WorkflowMetadata.from_info(info)


@router.get("/{workflow_id}/content", response_model=WorkflowContentResponse)
async def get_workflow_content(
    workflow_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> WorkflowContentResponse:
    """Get parsed workflow content (tools and wires). Requires auditor role or higher."""
    service = _get_service(db)

    try:
        content = await service.get_content(workflow_id)
    except WorkflowNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )
    except WorkflowParseError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stored file corrupted: {e}",
        )

    return WorkflowContentResponse(
        version=content.version,
        meta=content.meta.model_dump(by_alias=True),
        tools=content.tools,
        wires=content.wires,
    )


@router.get("/{workflow_id}/download")
async def download_workflow(
    workflow_id: UUID,
    _user: SessionInfo = RequireAuditor,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Download the original .swwf file. Requires auditor role or higher."""
    service = _get_service(db)

    # Get metadata first for filename
    try:
        info = await service.get_workflow(workflow_id)
        content = service.get_file_bytes(workflow_id)
    except WorkflowNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    # Return as downloadable file
    filename = f"{info.name}.swwf"
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.put("/{workflow_id}", response_model=WorkflowMetadata)
async def update_workflow_file(
    workflow_id: UUID,
    user: SessionInfo = RequireUser,
    file: Annotated[UploadFile, File(description="The updated .swwf workflow file")] = None,
    db: AsyncSession = Depends(get_db),
) -> WorkflowMetadata:
    """Replace a workflow file. Requires user role.

    Uploads a new file version, updating metadata from the new file.
    Users can only update their own workflows.
    """
    if not file.filename or not file.filename.endswith(".swwf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a .swwf workflow file",
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    service = _get_service(db)

    # Check ownership first
    try:
        existing = await service.get_workflow(workflow_id)
    except WorkflowNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    if existing.uploaded_by != user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update workflows uploaded by other users",
        )

    try:
        info = await service.update_workflow(
            workflow_id=workflow_id,
            content=content,
        )
    except WorkflowParseError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid workflow file: {e}",
        )
    except WorkflowServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    return WorkflowMetadata.from_info(info)


@router.patch("/{workflow_id}", response_model=WorkflowMetadata)
async def update_workflow_metadata(
    workflow_id: UUID,
    body: WorkflowUpdateMetadataRequest,
    user: SessionInfo = RequireUser,
    db: AsyncSession = Depends(get_db),
) -> WorkflowMetadata:
    """Update workflow metadata (folder, tags) without replacing the file. Requires user role."""
    service = _get_service(db)

    # Check ownership first
    try:
        existing = await service.get_workflow(workflow_id)
    except WorkflowNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    if existing.uploaded_by != user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update workflows uploaded by other users",
        )

    try:
        input = UpdateWorkflowInput(
            folder_path=body.folder_path,
            tags=body.tags,
        )
        info = await service.update_workflow(
            workflow_id=workflow_id,
            input=input,
        )
    except WorkflowNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )
    except WorkflowServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    return WorkflowMetadata.from_info(info)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a workflow and its file.

    Users can delete their own workflows.
    Admins/owners can delete any workflow.
    """
    service = _get_service(db)

    # Check if workflow exists and get info for ownership check
    try:
        info = await service.get_workflow(workflow_id)
    except WorkflowNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    # Users can only delete their own workflows
    if user.role == "user" and info.uploaded_by != user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete workflows uploaded by other users",
        )

    await service.delete_workflow(workflow_id)
