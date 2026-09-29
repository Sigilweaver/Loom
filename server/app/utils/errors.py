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


class SafetyLimitExceededError(ExecutionError):
    """A safety budget (rows, memory, time) was exceeded."""

    pass


class ExecutionTimeoutError(SafetyLimitExceededError):
    """Workflow / tool execution exceeded its time budget."""

    pass


class FileAccessError(LoomError):
    """A file path was rejected before any I/O happened (malformed, not a file, or unusable).

    Raised by path validation in the domain layer. The API layer maps it to an
    HTTP response (400), and the subclasses below to 404 and 403.
    """

    pass


class FileNotFoundAccessError(FileAccessError):
    """The requested file does not exist."""

    pass


class FileAccessDeniedError(FileAccessError):
    """The path is outside the granted/allowed locations, or is read-only for a write."""

    pass
