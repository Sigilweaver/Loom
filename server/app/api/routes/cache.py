"""Cache management API routes"""

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.domain.execution.cache import (
    BlockingToolCache,
    cleanup_old_cache_files,
    enforce_cache_quota,
    get_global_cache_stats,
)

router = APIRouter(prefix="/cache", tags=["cache"])


class WorkflowCacheRequest(BaseModel):
    """Request for workflow-specific cache operations"""

    workflow_id: str = Field(description="Workflow ID to operate on")


class BatchWorkflowCacheRequest(BaseModel):
    """Request for batch workflow cache operations"""

    workflow_ids: list[str] = Field(description="List of workflow IDs to operate on")


class ClearCacheResponse(BaseModel):
    """Response from cache clear operation"""

    status: str = Field(description="Operation status")
    workflow_id: str = Field(description="Workflow ID that was cleared")


class BatchClearCacheResponse(BaseModel):
    """Response from batch cache clear operation"""

    status: str = Field(description="Operation status")
    cleared_count: int = Field(description="Number of workflow caches cleared")
    workflow_ids: list[str] = Field(description="Workflow IDs that were processed")


class CacheStatsResponse(BaseModel):
    """Response with cache statistics"""

    enabled: bool = Field(description="Whether caching is enabled")
    workflow_count: int = Field(description="Number of workflow caches")
    file_count: int = Field(description="Total number of cache files")
    total_size_bytes: int = Field(description="Total size in bytes")
    total_size_mb: float = Field(description="Total size in MB")
    total_size_gb: float = Field(description="Total size in GB")
    quota_gb: float = Field(description="Configured quota in GB (0 = unlimited)")
    retention_days: int = Field(description="Configured retention in days (0 = forever)")


class MaintenanceResponse(BaseModel):
    """Response from cache maintenance operations"""

    ttl_files_deleted: int = Field(description="Files deleted by TTL cleanup")
    lru_files_evicted: int = Field(description="Files evicted by LRU quota enforcement")
    message: str = Field(description="Summary message")


@router.post("/clear", response_model=ClearCacheResponse)
async def clear_workflow_cache(request: WorkflowCacheRequest) -> ClearCacheResponse:
    """
    Clear cache for a specific workflow.

    This removes all cached blocking tool outputs for the workflow.
    Use this when closing a workflow (if cache_clear_on_close is enabled)
    or to force re-execution of all tools.
    """
    try:
        if not settings.cache_enabled:
            return ClearCacheResponse(
                status="cache_disabled",
                workflow_id=request.workflow_id,
            )

        cache = BlockingToolCache(
            Path(settings.cache_path),
            request.workflow_id,
        )
        cache.clear()
        return ClearCacheResponse(
            status="cleared",
            workflow_id=request.workflow_id,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")


@router.post("/close", response_model=ClearCacheResponse)
async def close_workflow_cache(request: WorkflowCacheRequest) -> ClearCacheResponse:
    """
    Notify the backend that a workflow has been closed.

    If cache_clear_on_close is enabled (default), this will clear the
    workflow's cache. Otherwise, it's a no-op that acknowledges the close.

    Frontend should call this when:
    - User closes a workflow tab
    - User opens a different workflow
    - Application is shutting down (for each open workflow)
    """
    try:
        if not settings.cache_enabled:
            return ClearCacheResponse(
                status="cache_disabled",
                workflow_id=request.workflow_id,
            )

        if not settings.cache_clear_on_close:
            return ClearCacheResponse(
                status="close_acknowledged",
                workflow_id=request.workflow_id,
            )

        cache = BlockingToolCache(
            Path(settings.cache_path),
            request.workflow_id,
        )
        cache.clear()
        return ClearCacheResponse(
            status="cleared_on_close",
            workflow_id=request.workflow_id,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to clear cache on close: {str(e)}"
        )


@router.post("/close/batch", response_model=BatchClearCacheResponse)
async def close_workflow_caches_batch(
    request: BatchWorkflowCacheRequest,
) -> BatchClearCacheResponse:
    """
    Notify the backend that multiple workflows have been closed.

    This is more efficient than calling /close for each workflow individually.
    Use this when closing the application to clear all open workflow caches
    in a single request.

    If cache_clear_on_close is enabled (default), this will clear the cache
    for each workflow. Otherwise, it's a no-op that acknowledges the close.
    """
    try:
        if not settings.cache_enabled:
            return BatchClearCacheResponse(
                status="cache_disabled",
                cleared_count=0,
                workflow_ids=request.workflow_ids,
            )

        if not settings.cache_clear_on_close:
            return BatchClearCacheResponse(
                status="close_acknowledged",
                cleared_count=0,
                workflow_ids=request.workflow_ids,
            )

        cleared_count = 0
        for workflow_id in request.workflow_ids:
            cache = BlockingToolCache(
                Path(settings.cache_path),
                workflow_id,
            )
            cache.clear()
            cleared_count += 1

        return BatchClearCacheResponse(
            status="cleared_on_close",
            cleared_count=cleared_count,
            workflow_ids=request.workflow_ids,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to clear caches on close: {str(e)}"
        )


@router.get("/stats", response_model=CacheStatsResponse)
async def get_cache_stats() -> CacheStatsResponse:
    """
    Get global cache statistics.

    Returns information about total cache usage across all workflows,
    including file counts, sizes, and configured limits.
    """
    if not settings.cache_enabled:
        return CacheStatsResponse(
            enabled=False,
            workflow_count=0,
            file_count=0,
            total_size_bytes=0,
            total_size_mb=0.0,
            total_size_gb=0.0,
            quota_gb=settings.cache_max_size_gb,
            retention_days=settings.cache_retention_days,
        )

    stats = get_global_cache_stats(Path(settings.cache_path))

    return CacheStatsResponse(
        enabled=True,
        workflow_count=stats["workflow_count"],
        file_count=stats["file_count"],
        total_size_bytes=stats["total_size_bytes"],
        total_size_mb=stats["total_size_mb"],
        total_size_gb=stats["total_size_gb"],
        quota_gb=settings.cache_max_size_gb,
        retention_days=settings.cache_retention_days,
    )


@router.post("/maintenance", response_model=MaintenanceResponse)
async def run_cache_maintenance() -> MaintenanceResponse:
    """
    Run cache maintenance tasks.

    This performs:
    1. TTL cleanup: Remove files older than cache_retention_days
    2. LRU eviction: Remove oldest files to enforce cache_max_size_gb quota

    Normally these run automatically on server startup, but this endpoint
    allows manual triggering for testing or immediate cleanup needs.
    """
    if not settings.cache_enabled:
        return MaintenanceResponse(
            ttl_files_deleted=0,
            lru_files_evicted=0,
            message="Cache is disabled",
        )

    cache_root = Path(settings.cache_path)

    # TTL cleanup
    ttl_deleted = cleanup_old_cache_files(cache_root, settings.cache_retention_days)

    # LRU eviction
    quota_bytes = int(settings.cache_max_size_gb * 1024**3)
    lru_evicted = enforce_cache_quota(cache_root, quota_bytes)

    return MaintenanceResponse(
        ttl_files_deleted=ttl_deleted,
        lru_files_evicted=lru_evicted,
        message=f"Maintenance complete: {ttl_deleted} TTL deletions, {lru_evicted} LRU evictions",
    )


def run_startup_maintenance() -> dict[str, Any]:
    """
    Run cache maintenance on application startup.

    This function should be called during app initialization to:
    1. Clean up expired cache files (TTL)
    2. Enforce storage quota (LRU)

    Returns:
        Dict with cleanup statistics
    """
    if not settings.cache_enabled:
        return {"enabled": False, "ttl_deleted": 0, "lru_evicted": 0}

    cache_root = Path(settings.cache_path)

    # Ensure cache directory exists
    cache_root.mkdir(parents=True, exist_ok=True)

    # TTL cleanup
    ttl_deleted = cleanup_old_cache_files(cache_root, settings.cache_retention_days)

    # LRU eviction
    quota_bytes = int(settings.cache_max_size_gb * 1024**3)
    lru_evicted = enforce_cache_quota(cache_root, quota_bytes)

    return {
        "enabled": True,
        "ttl_deleted": ttl_deleted,
        "lru_evicted": lru_evicted,
    }
