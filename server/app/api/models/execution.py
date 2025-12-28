"""Execution-related data models"""

from typing import Any, Literal

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


class ExecutionMetrics(BaseModel):
    """Execution metrics and statistics"""

    rows_processed: int
    rows_output: int
    memory_peak_mb: float
    tool_timings: dict[str, float] | None = None  # tool_id -> milliseconds


class ExecutionError(BaseModel):
    """Execution error details"""

    tool_id: str
    error_type: str
    message: str
    stack_trace: str | None = None


class ExecutionResult(BaseModel):
    """Workflow execution result"""

    execution_id: str
    status: Literal["completed", "failed", "partial"]
    results: dict[str, Any]  # tool_id -> DataPreview or output
    execution_time_ms: float
    metrics: ExecutionMetrics
    errors: list[ExecutionError] | None = None
