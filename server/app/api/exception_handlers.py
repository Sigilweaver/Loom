"""Application-level exception handlers for workflow errors."""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.utils.errors import (
    ExecutionError,
    ExecutionTimeoutError,
    FileAccessDeniedError,
    FileAccessError,
    FileNotFoundAccessError,
    ToolConfigError,
    ToolError,
    ValidationError,
)


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": f"Validation error: {exc}"})


async def tool_config_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": f"Tool config error: {exc}"})


async def tool_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": f"Tool error: {exc}"})


async def file_access_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Map path-validation failures to the status codes clients already rely on."""
    if isinstance(exc, FileAccessDeniedError):
        status_code = 403
    elif isinstance(exc, FileNotFoundAccessError):
        status_code = 404
    else:
        status_code = 400
    return JSONResponse(status_code=status_code, content={"detail": str(exc)})


async def execution_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ExecutionError)
    is_timeout = isinstance(exc, ExecutionTimeoutError)
    return JSONResponse(
        status_code=504 if is_timeout else 500,
        content={
            "detail": {
                "error": "Execution timeout" if is_timeout else "Execution error",
                "error_id": exc.error_id,
                "message": str(exc),
            }
        },
    )


WORKFLOW_EXCEPTION_HANDLERS = {
    ValidationError: validation_error_handler,
    ToolConfigError: tool_config_error_handler,
    ToolError: tool_error_handler,
    ExecutionError: execution_error_handler,
    FileAccessError: file_access_error_handler,
}
