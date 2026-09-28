"""Execution-related data models"""

from typing import Literal

from pydantic import BaseModel


class ValidationError(BaseModel):
    """Validation error details"""

    tool_id: str
    field: str | None = None
    message: str
    error_code: str


class ValidationWarning(BaseModel):
    """Validation warning details"""

    tool_id: str
    message: str
    severity: Literal["info", "warning"]


class ExecutionGraph(BaseModel):
    """Execution graph representation"""

    nodes: list[str]
    dependencies: dict[str, list[str]]


class ValidationResult(BaseModel):
    """Workflow validation result"""

    valid: bool
    errors: list[ValidationError]
    warnings: list[ValidationWarning]
    estimated_memory_mb: float | None = None
    execution_graph: ExecutionGraph | None = None
