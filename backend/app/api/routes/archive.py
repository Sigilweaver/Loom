"""Archive API routes for accessing workflow execution history"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.api.models.archive import (
    ArchiveDetailResponse,
    ArchiveListItem,
    ArchiveListResponse,
    CleanupArchivesRequest,
    CleanupArchivesResponse,
)
from app.config import settings
from app.domain.workflow.archive import WorkflowArchive

router = APIRouter(prefix="/archive", tags=["archive"])


def _get_archive() -> WorkflowArchive:
    """Get archive instance"""
    if not settings.archive_enabled:
        raise HTTPException(
            status_code=503,
            detail="Workflow archiving is disabled in configuration"
        )
    return WorkflowArchive(settings.archive_path)


@router.get("/list", response_model=ArchiveListResponse)
async def list_archives(
    limit: Optional[int] = Query(None, description="Max archives to return"),
    start_date: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter until date (YYYY-MM-DD)"),
):
    """
    List archived workflow executions.

    Returns a list of archived workflows with summary information including
    execution status, timing, and workflow metadata.

    Use date filters to narrow results to a specific time range.
    """
    try:
        archive = _get_archive()

        # Parse date filters
        start_dt = None
        end_dt = None
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid start_date format. Use YYYY-MM-DD"
                )

        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid end_date format. Use YYYY-MM-DD"
                )

        # Get archives
        archives_data = archive.list_archives(
            start_date=start_dt,
            end_date=end_dt,
            limit=limit,
        )

        # Convert to response model
        archive_items = [ArchiveListItem(**item) for item in archives_data]

        return ArchiveListResponse(
            archives=archive_items,
            total=len(archive_items),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list archives: {str(e)}"
        )


@router.get("/detail/{archive_path:path}", response_model=ArchiveDetailResponse)
async def get_archive_detail(archive_path: str):
    """
    Get complete details for a specific archived workflow.

    Returns the full workflow definition and execution log including:
    - Original workflow JSON
    - Execution timing and status
    - Tool execution sequence
    - Error details (if execution failed)
    - Result summaries

    Use the path from the list endpoint (e.g., "2025-11-26/14-30-00_MyWorkflow")
    """
    try:
        archive = _get_archive()
        archive_data = archive.get_archive(archive_path)

        return ArchiveDetailResponse(**archive_data)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve archive: {str(e)}"
        )


@router.post("/cleanup", response_model=CleanupArchivesResponse)
async def cleanup_archives(request: CleanupArchivesRequest):
    """
    Delete archived workflows older than specified retention period.

    This permanently removes archive directories and all contained files
    for archives older than the specified number of days.

    Use with caution - deleted archives cannot be recovered.
    """
    try:
        archive = _get_archive()
        deleted_count = archive.cleanup_old_archives(request.retention_days)

        return CleanupArchivesResponse(
            deleted_count=deleted_count,
            message=f"Deleted {deleted_count} archives older than {request.retention_days} days"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cleanup archives: {str(e)}"
        )


@router.get("/status")
async def get_archive_status():
    """
    Get archive system status and configuration.

    Returns information about archiving settings and storage location.
    """
    return {
        "enabled": settings.archive_enabled,
        "archive_path": settings.archive_path,
        "retention_days": settings.archive_retention_days,
    }
