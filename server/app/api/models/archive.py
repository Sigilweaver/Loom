"""Pydantic models for workflow archive API"""

from typing import Any

from pydantic import BaseModel, Field


class ArchiveListItem(BaseModel):
    """Summary information for an archived workflow"""

    path: str = Field(description="Relative path to archive directory")
    created: str = Field(description="Archive creation timestamp (ISO format)")
    workflow_name: str | None = Field(None, description="Name of the workflow")
    workflow_description: str | None = Field(None, description="Workflow description")
    tool_count: int | None = Field(None, description="Number of tools in workflow")
    execution_status: str | None = Field(
        None, description="Execution status (started, completed, failed)"
    )
    execution_time: float | None = Field(None, description="Execution time in milliseconds")
    execution_timestamp: str | None = Field(None, description="When execution occurred")
    target_tool_id: str | None = Field(None, description="Target tool ID if partial execution")
    error: str | None = Field(None, description="Error message if execution failed")


class ArchiveListResponse(BaseModel):
    """Response for list archives endpoint"""

    archives: list[ArchiveListItem] = Field(description="List of archived workflows")
    total: int = Field(description="Total number of archives returned")


class ArchiveDetailResponse(BaseModel):
    """Response for get archive detail endpoint"""

    path: str = Field(description="Relative path to archive directory")
    workflow: dict[str, Any] | None = Field(None, description="Complete workflow definition")
    execution_log: dict[str, Any] | None = Field(
        None, description="Execution log with timing and results"
    )


class CleanupArchivesRequest(BaseModel):
    """Request to cleanup old archives"""

    retention_days: int = Field(description="Delete archives older than this many days", gt=0)


class CleanupArchivesResponse(BaseModel):
    """Response for cleanup archives endpoint"""

    deleted_count: int = Field(description="Number of archives deleted")
    message: str = Field(description="Status message")
