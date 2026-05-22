"""Custom exception classes"""

import uuid


class LoomError(Exception):
    """Base exception for Sigilweaver Loom backend"""

    pass


class DataSourceError(LoomError):
    """Error related to data source operations"""

    pass


class ValidationError(LoomError):
    """Error during workflow validation"""

    pass


class ExecutionError(LoomError):
    """Error during workflow execution.

    Carries a stable ``error_id`` (UUID4 hex) that is logged with the full
    traceback and surfaced to clients so they can correlate a 500 response
    back to a server log entry.
    """

    def __init__(self, message: str, *, error_id: str | None = None) -> None:
        super().__init__(message)
        self.error_id = error_id or uuid.uuid4().hex


class ToolError(LoomError):
    """Error related to tool operations"""

    pass


class ToolConfigError(ToolError):
    """Tool failed configuration / argument validation."""

    pass


class ToolRuntimeError(ToolError):
    """Tool failed at runtime (Polars / IO / data-shape failure)."""

    pass


class SafetyLimitExceeded(ExecutionError):
    """A safety budget (rows, memory, time) was exceeded."""

    pass


class ConfigurationError(LoomError):
    """Error in configuration"""

    pass
