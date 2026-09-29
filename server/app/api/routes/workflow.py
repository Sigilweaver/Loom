"""Workflow execution API routes"""

import logging
import uuid
from contextlib import contextmanager
from typing import Annotated, Any, Generator

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.domain.connections.resolver import ConnectionResolver, get_connection_resolver
from app.domain.execution.executor import WorkflowExecutor
from app.domain.hub import AuthorizationResult, get_hub_client
from app.domain.models.workflow import Workflow
from app.domain.workflow.code_generator import PythonCodeGenerator
from app.utils.errors import ExecutionError, FileAccessError, ToolError, ValidationError
from app.utils.security import FilePathGrant, allowed_paths_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow", tags=["workflow"])


def _raise_unexpected(exc: BaseException) -> HTTPException:
    """Map an unexpected exception to a 500 carrying a stable error id.

    The full traceback is logged at ERROR level keyed by the same id so
    operators can correlate a client-visible 500 with the server log entry.
    """
    error_id = uuid.uuid4().hex
    logger.error(
        "unexpected workflow error",
        exc_info=True,
        extra={"error_id": error_id, "error_class": type(exc).__name__},
    )
    return HTTPException(
        status_code=500,
        detail={
            "error": "Unexpected error",
            "error_id": error_id,
            "message": str(exc),
        },
    )


@contextmanager
def _map_unexpected_errors() -> Generator[None, None, None]:
    """Map unexpected workflow errors while deferring known errors to the application."""
    try:
        yield
    except (ValidationError, ToolError, ExecutionError, FileAccessError):
        raise
    except Exception as exc:
        raise _raise_unexpected(exc)


@contextmanager
def _map_preview_code_errors() -> Generator[None, None, None]:
    """Preserve the preview-code endpoint's legacy unexpected-error response."""
    try:
        yield
    except ValidationError:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")


# Hub mode authentication


def _extract_bearer_token(authorization: str | None) -> str | None:
    """Extract Bearer token from Authorization header."""
    if not authorization:
        return None

    parts = authorization.split(" ", 1)
    if len(parts) != 2:
        return None

    scheme, token = parts[0], parts[1]
    if scheme.lower() != "bearer":
        return None

    return token


@contextmanager
def _set_file_paths_context(hub_result: AuthorizationResult | None) -> Generator[None, None, None]:
    """Set the allowed file paths context from Hub authorization result.

    In hub mode, file access is restricted to paths granted via filesystem connections.
    This context manager sets those paths for the duration of the execution.

    Args:
        hub_result: Hub authorization result containing file_paths, or None if not hub mode.
    """
    if not hub_result:
        yield
        return

    # Convert Hub FilePathGrant to security FilePathGrant (same structure)
    # If Hub provided no grants, enforce a deny-all context by setting an empty list.
    grants = [
        FilePathGrant(path=fp.path, read_only=fp.read_only) for fp in (hub_result.file_paths or [])
    ]
    token = allowed_paths_context.set(grants)
    try:
        yield
    finally:
        allowed_paths_context.reset(token)


def _parse_workflow(workflow_json: dict[str, Any]) -> Workflow:
    """Parse raw workflow JSON into Pydantic model.

    This is done AFTER hub validation to ensure the hash is computed
    on the exact JSON that was sent, not a Pydantic-transformed version.

    Args:
        workflow_json: Raw workflow dict from request.

    Returns:
        Parsed Workflow model.

    Raises:
        HTTPException: If workflow JSON is invalid.
    """
    try:
        return Workflow.model_validate(workflow_json)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid workflow format: {e}",
        )


async def _authorize_hub_request(
    workflow_json: dict[str, Any],
    authorization: str | None,
    request_type: str = "execute",
) -> AuthorizationResult | None:
    """Authorize a request with Hub if in hub auth mode.

    This sends the server token to Hub for authorization. Hub validates
    the token (one-time use), checks permissions, and returns credentials.

    Args:
        workflow_json: Raw workflow JSON dict.
        authorization: Authorization header value.
        request_type: Type of operation ('execute', 'preview').

    Returns:
        AuthorizationResult with hub-provided credentials, or None if not hub mode.

    Raises:
        HTTPException: If hub mode and authorization fails.
    """
    if settings.auth_mode != "hub":
        return None

    hub_client = get_hub_client()
    if not hub_client:
        raise HTTPException(
            status_code=500,
            detail="Hub mode enabled but HubClient not configured",
        )

    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authorization header with Bearer token required",
        )

    # Extract hub connection IDs from raw workflow JSON
    hub_connection_ids = _extract_hub_connections(workflow_json)

    # Authorize with Hub - token is validated and consumed (one-time use)
    result = await hub_client.authorize(
        server_token=token,
        request_type=request_type,  # type: ignore[arg-type]
        connection_ids=hub_connection_ids,
        workflow=workflow_json,
    )

    if not result.authorized:
        logger.warning(f"Hub authorization failed: {result.error}")
        raise HTTPException(
            status_code=401,
            detail=result.error or "Authorization failed",
        )

    return result


def _extract_hub_connections(workflow_json: dict[str, Any]) -> list[str]:
    """Extract hub-owned connection IDs from raw workflow JSON.

    Hub can return both database credentials and filesystem grants tied to
    connections, so include any hub-owned Input tool with a connectionId.
    """
    hub_connections: list[str] = []
    seen: set[str] = set()

    for tool in workflow_json.get("tools", []):
        if tool.get("type") != "Input":
            continue

        config = tool.get("config", {}) or {}
        if (config.get("owner") or "client") != "hub":
            continue

        connection_id = config.get("connectionId")
        if connection_id and connection_id not in seen:
            hub_connections.append(connection_id)
            seen.add(connection_id)

    return hub_connections


def _clamp_preview_limit(requested: int | None) -> int:
    """
    Clamp preview_limit to be within valid bounds.

    Uses default of 100 if not specified.
    Enforces max_preview_rows from settings as upper bound.
    """
    default_preview_rows = 100
    limit = requested if requested is not None else default_preview_rows
    return min(max(1, limit), settings.max_preview_rows)


class ExecuteWorkflowRequest(BaseModel):
    """Request to execute a workflow"""

    workflow: dict[str, Any] = Field(description="Full workflow JSON (raw dict for hash integrity)")
    target_tool_id: str | None = Field(
        None, description="Optional: Execute up to this tool (null = execute all)"
    )
    preview_limit: int | None = Field(None, description="Optional: Limit rows returned in preview")
    force_refresh: bool = Field(
        False, description="Optional: Clear cache before execution (for manual refresh)"
    )


class ExecuteToolRequest(BaseModel):
    """Request to execute a single tool"""

    tool_id: str = Field(description="Tool ID to execute")
    workflow: dict[str, Any] = Field(description="Full workflow JSON (raw dict for hash integrity)")
    socket_id: str = Field(description="Output socket ID to return data for")
    preview_limit: int | None = Field(None, description="Optional: Limit rows returned in preview")
    force_refresh: bool = Field(
        False, description="Optional: Clear cache before execution (for manual refresh)"
    )


class ToolSchemaRequest(BaseModel):
    """Request to get tool output schema"""

    tool_id: str = Field(description="Tool ID to get schema for")
    workflow: dict[str, Any] = Field(description="Full workflow JSON (raw dict for hash integrity)")
    socket_id: str = Field(description="Output socket ID to get schema for")


class ToolMetadataRequest(BaseModel):
    """Request to get tool metadata for autocomplete"""

    tool_id: str = Field(description="Tool ID to get metadata for")
    workflow: dict[str, Any] = Field(description="Full workflow JSON (raw dict for hash integrity)")
    socket_id: str | None = Field(
        None, description="Optional: Specific input socket ID to get columns for"
    )


class ToolProfileRequest(BaseModel):
    """Request to profile columns for a tool's input data"""

    tool_id: str = Field(description="Tool ID to profile input for")
    workflow: dict[str, Any] = Field(description="Full workflow JSON (raw dict for hash integrity)")
    socket_id: str = Field(description="Input socket ID to profile")
    columns: list[str] | None = Field(
        None,
        description="Specific columns to profile. If null, profiles all columns.",
    )
    metrics: list[str] | None = Field(
        None,
        description=(
            "Specific metrics to compute. If null, computes all metrics. "
            "Available: count, null_count, null_percent, unique_count, min, max, "
            "mean, median, std, whitespace_leading, whitespace_trailing, "
            "contains_linebreaks, contains_non_ascii, top_values"
        ),
    )


@router.post("/execute")
async def execute_workflow(
    request: ExecuteWorkflowRequest,
    authorization: Annotated[str | None, Header()] = None,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Execute entire workflow or up to a specific tool.

    This endpoint executes tools in dependency order, passing LazyFrames
    between them. Results are collected and returned.

    Use target_tool_id to execute only part of the workflow (useful for debugging).
    Use preview_limit to limit rows returned (useful for large datasets).
    The preview_limit is clamped to max_preview_rows from server config.
    Use force_refresh to clear cache and re-execute (useful for DB refresh).

    Server connections are resolved before execution. Client connections must
    have their source URI already populated. In hub mode, Bearer token is
    required and hub connections are resolved from Hub.
    """
    with _map_unexpected_errors():
        # Validate Hub token if in hub mode (uses raw JSON for hash integrity)
        hub_result = await _authorize_hub_request(request.workflow, authorization)

        # Parse workflow AFTER hub validation to avoid Pydantic transformation issues
        workflow = _parse_workflow(request.workflow)

        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(
            workflow,
            hub_connections=hub_result.connections if hub_result else None,
        )
        resolver.validate_client_connections(resolved_workflow)

        # Set file paths context for Hub mode (restricts file access during execution)
        with _set_file_paths_context(hub_result):
            executor = WorkflowExecutor()
            result = await executor.execute_workflow(
                workflow=resolved_workflow,
                target_tool_id=request.target_tool_id,
                preview_limit=_clamp_preview_limit(request.preview_limit),
                force_refresh=request.force_refresh,
            )
        return result


@router.post("/tool/execute")
async def execute_tool(
    request: ExecuteToolRequest,
    authorization: Annotated[str | None, Header()] = None,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Execute a single tool and its dependencies.

    This is useful for previewing a tool's output in the UI without
    running the entire workflow.

    The tool and all upstream dependencies will be executed.
    Returns data for the specified socket only.
    The preview_limit is clamped to max_preview_rows from server config.
    Use force_refresh to clear cache and re-execute (useful for DB refresh).
    In hub mode, Bearer token is required.
    """
    with _map_unexpected_errors():
        # Validate Hub token if in hub mode (uses raw JSON for hash integrity)
        hub_result = await _authorize_hub_request(request.workflow, authorization)

        # Parse workflow AFTER hub validation to avoid Pydantic transformation issues
        workflow = _parse_workflow(request.workflow)

        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(
            workflow,
            hub_connections=hub_result.connections if hub_result else None,
        )
        resolver.validate_client_connections(resolved_workflow)

        # Set file paths context for Hub mode (restricts file access during execution)
        with _set_file_paths_context(hub_result):
            executor = WorkflowExecutor()
            result = await executor.execute_single_tool(
                workflow=resolved_workflow,
                tool_id=request.tool_id,
                socket_id=request.socket_id,
                preview_limit=_clamp_preview_limit(request.preview_limit),
                force_refresh=request.force_refresh,
            )
        return result


@router.get("/tool/{tool_type}/schema")
async def get_tool_config_schema(tool_type: str) -> dict[str, Any]:
    """
    Return the JSON Schema for a tool's *config*.

    Returns a JSON Schema document derived from the tool's
    `config_model()`. Tools that have not yet been migrated to typed
    configs return an empty schema with `"x-typed": False` so callers
    can detect the legacy case. Unknown tool types -> 404.
    """
    from app.domain.tools.registry import ToolRegistry

    try:
        tool_impl = ToolRegistry.get(tool_type)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Unknown tool type: {tool_type}")

    model = tool_impl.config_model()
    if model is None:
        return {
            "title": tool_type,
            "type": "object",
            "properties": {},
            "x-typed": False,
        }

    schema = dict(model.model_json_schema())
    schema["x-typed"] = True
    return schema


@router.post("/tool/schema")
async def get_tool_schema(
    request: ToolSchemaRequest,
    authorization: Annotated[str | None, Header()] = None,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Get output schema for a tool without executing it fully.

    This executes upstream tools to determine input schemas, then asks
    the tool for its output schema based on those inputs.

    Useful for populating dropdowns with available columns from upstream tools.
    Returns schema for the specified socket only.
    In hub mode, Bearer token is required.
    """
    with _map_unexpected_errors():
        # Validate Hub token if in hub mode (uses raw JSON for hash integrity)
        hub_result = await _authorize_hub_request(request.workflow, authorization)

        # Parse workflow AFTER hub validation to avoid Pydantic transformation issues
        workflow = _parse_workflow(request.workflow)

        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(
            workflow,
            hub_connections=hub_result.connections if hub_result else None,
        )
        resolver.validate_client_connections(resolved_workflow)

        # Set file paths context for Hub mode (restricts file access during execution)
        with _set_file_paths_context(hub_result):
            executor = WorkflowExecutor()
            result = await executor.get_tool_schema(
                workflow=resolved_workflow,
                tool_id=request.tool_id,
                socket_id=request.socket_id,
            )
        return result


@router.post("/tool/metadata")
async def get_tool_metadata(
    request: ToolMetadataRequest,
    authorization: Annotated[str | None, Header()] = None,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Get metadata for a tool for autocomplete suggestions.

    Returns available columns from input sockets plus common Polars functions.
    Useful for Monaco editor autocomplete in Formula/Filter tools.

    This executes upstream tools to determine input columns.
    In hub mode, Bearer token is required.
    """
    with _map_unexpected_errors():
        # Validate Hub token if in hub mode (uses raw JSON for hash integrity)
        hub_result = await _authorize_hub_request(request.workflow, authorization)

        # Parse workflow AFTER hub validation to avoid Pydantic transformation issues
        workflow = _parse_workflow(request.workflow)

        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(
            workflow,
            hub_connections=hub_result.connections if hub_result else None,
        )
        resolver.validate_client_connections(resolved_workflow)

        # Set file paths context for Hub mode (restricts file access during execution)
        with _set_file_paths_context(hub_result):
            executor = WorkflowExecutor()
            result = await executor.get_tool_metadata(
                workflow=resolved_workflow,
                tool_id=request.tool_id,
                socket_id=request.socket_id,
            )
        return result


@router.post("/tool/profile")
async def profile_tool_input(
    request: ToolProfileRequest,
    authorization: Annotated[str | None, Header()] = None,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Profile columns for a tool's input data.

    Computes statistical profiles for columns in the data flowing into
    the specified tool socket. This is useful for:
    - Understanding data quality (nulls, whitespace issues, non-ASCII)
    - Determining pivot safety (unique value counts)
    - Exploring data distribution (top values, min/max)

    This endpoint collects the FULL dataset (not preview limited) to
    compute accurate statistics. It executes all upstream tools.

    The metrics parameter allows requesting specific statistics:
    - Basic: count, null_count, null_percent, unique_count
    - Numeric: min, max, mean, median, std
    - String quality: whitespace_leading, whitespace_trailing,
                     contains_linebreaks, contains_non_ascii
    - Distribution: top_values

    The columns parameter allows profiling a subset of columns for
    faster response times when only specific columns are of interest.
    In hub mode, Bearer token is required.
    """
    with _map_unexpected_errors():
        # Validate Hub token if in hub mode (uses raw JSON for hash integrity)
        hub_result = await _authorize_hub_request(request.workflow, authorization)

        # Parse workflow AFTER hub validation to avoid Pydantic transformation issues
        workflow = _parse_workflow(request.workflow)

        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(
            workflow,
            hub_connections=hub_result.connections if hub_result else None,
        )
        resolver.validate_client_connections(resolved_workflow)

        # Set file paths context for Hub mode (restricts file access during execution)
        with _set_file_paths_context(hub_result):
            executor = WorkflowExecutor()
            result = await executor.profile_columns(
                workflow=resolved_workflow,
                tool_id=request.tool_id,
                socket_id=request.socket_id,
                columns=request.columns,
                metrics=request.metrics,
            )
        return result


class PreviewAllRequest(BaseModel):
    """Request to preview all tools in one request"""

    workflow: dict[str, Any] = Field(description="Full workflow JSON (raw dict for hash integrity)")
    preview_limit: int | None = Field(
        None, description="Optional: Limit rows returned in preview per tool"
    )
    force_refresh: bool = Field(
        False, description="Optional: Clear cache before execution (for manual refresh)"
    )


@router.post("/preview_all")
async def preview_all_tools(
    request: PreviewAllRequest,
    authorization: Annotated[str | None, Header()] = None,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Execute workflow and return preview data for ALL tools.

    This is more efficient than calling /tool/execute multiple times
    because upstream tools are only executed once. Useful for loading
    all previews after opening a workflow or when data sources change.

    Returns a dict mapping tool_id -> outputs for every tool in the workflow.
    The preview_limit is clamped to max_preview_rows from server config.
    Use force_refresh to clear cache and re-execute (useful for DB refresh).
    In hub mode, Bearer token is required.
    """
    with _map_unexpected_errors():
        # Validate Hub token if in hub mode (uses raw JSON for hash integrity)
        hub_result = await _authorize_hub_request(request.workflow, authorization)

        # Parse workflow AFTER hub validation to avoid Pydantic transformation issues
        workflow = _parse_workflow(request.workflow)

        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(
            workflow,
            hub_connections=hub_result.connections if hub_result else None,
        )
        resolver.validate_client_connections(resolved_workflow)

        # Set file paths context for Hub mode (restricts file access during execution)
        with _set_file_paths_context(hub_result):
            executor = WorkflowExecutor()
            result = await executor.preview_all_tools(
                workflow=resolved_workflow,
                preview_limit=_clamp_preview_limit(request.preview_limit),
                force_refresh=request.force_refresh,
            )
        return result


class PreviewCodeRequest(BaseModel):
    """Request to generate Python code preview"""

    workflow: dict[str, Any] = Field(description="Workflow JSON to generate code for")


class PreviewCodeResponse(BaseModel):
    """Response with generated Python code"""

    code: str = Field(description="Generated Python code")


@router.post("/preview_code", response_model=PreviewCodeResponse)
async def preview_code(request: PreviewCodeRequest) -> PreviewCodeResponse:
    """
    Generate Python code preview for a workflow.

    This creates executable Python code that represents the workflow,
    allowing users to see what their visual workflow translates to.

    The generated code uses Polars and can be run independently.
    """
    with _map_preview_code_errors():
        workflow = _parse_workflow(request.workflow)
        generator = PythonCodeGenerator(workflow)
        code = generator.generate()
        return PreviewCodeResponse(code=code)


class ClearCacheRequest(BaseModel):
    """Request to clear workflow cache"""

    workflow_id: str = Field(description="Workflow ID to clear cache for")


class ClearCacheResponse(BaseModel):
    """Response from cache clear operation"""

    status: str = Field(description="Operation status")
    workflow_id: str = Field(description="Workflow ID that was cleared")


@router.post("/cache/clear", response_model=ClearCacheResponse)
async def clear_workflow_cache(request: ClearCacheRequest) -> ClearCacheResponse:
    """
    Clear cache for a specific workflow.

    This removes all cached blocking tool outputs for the workflow.
    Useful when you want to force re-execution of all tools.
    """
    from pathlib import Path

    from app.domain.execution.cache import BlockingToolCache

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
