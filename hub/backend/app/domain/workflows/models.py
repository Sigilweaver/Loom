"""Workflow data models for Hub workflow management.

These models define the data structures for workflow files
stored and managed by Hub.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class WorkflowMeta(BaseModel):
    """Metadata extracted from workflow .swwf file."""

    name: str
    description: str = ""
    author: str = ""
    workflow_id: str = Field(alias="workflowId")
    created: str = ""

    model_config = {"populate_by_name": True}


class ParsedWorkflow(BaseModel):
    """Fully parsed workflow content."""

    version: str
    meta: WorkflowMeta
    tools: list[dict[str, Any]]
    wires: list[dict[str, Any]]


class WorkflowInfo(BaseModel):
    """Workflow metadata from database (safe to send to clients).

    This is what the API returns - file content is separate.
    """

    id: UUID
    name: str
    description: str
    author: str
    workflow_id: str  # Original ID from file
    folder_path: str
    tags: list[str]
    checksum: str
    uploaded_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowContent(BaseModel):
    """Parsed workflow content for API responses."""

    version: str
    meta: WorkflowMeta
    tools: list[dict[str, Any]]
    wires: list[dict[str, Any]]


class CreateWorkflowInput(BaseModel):
    """Input for uploading a new workflow (metadata extracted from file)."""

    folder_path: str = Field(default="/", max_length=1024)
    tags: list[str] = Field(default_factory=list)


class UpdateWorkflowInput(BaseModel):
    """Input for updating workflow metadata (not file content)."""

    folder_path: str | None = Field(None, max_length=1024)
    tags: list[str] | None = None


class WorkflowRevisionInfo(BaseModel):
    """A single workflow revision's metadata (without the file blob)."""

    id: UUID
    workflow_id: UUID
    revision_number: int
    parent_revision_id: UUID | None
    author: str
    checksum: str
    size_bytes: int
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}

