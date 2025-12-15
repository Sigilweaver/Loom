"""Workflow execution API routes"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.models.workflow import Workflow
from app.config import settings
from app.domain.connections.resolver import ConnectionResolver, get_connection_resolver
from app.domain.execution.executor import WorkflowExecutor
from app.domain.workflow.code_generator import PythonCodeGenerator
from app.utils.errors import ExecutionError, ToolError, ValidationError

router = APIRouter(prefix="/workflow", tags=["workflow"])


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

    workflow: Workflow
    target_tool_id: str | None = Field(
        None, description="Optional: Execute up to this tool (null = execute all)"
    )
    preview_limit: int | None = Field(
        None, description="Optional: Limit rows returned in preview"
    )


class ExecuteToolRequest(BaseModel):
    """Request to execute a single tool"""

    tool_id: str = Field(description="Tool ID to execute")
    workflow: Workflow = Field(description="Full workflow for context")
    socket_id: str = Field(description="Output socket ID to return data for")
    preview_limit: int | None = Field(
        None, description="Optional: Limit rows returned in preview"
    )


class ToolSchemaRequest(BaseModel):
    """Request to get tool output schema"""

    tool_id: str = Field(description="Tool ID to get schema for")
    workflow: Workflow = Field(description="Full workflow for context")
    socket_id: str = Field(description="Output socket ID to get schema for")


class ToolMetadataRequest(BaseModel):
    """Request to get tool metadata for autocomplete"""

    tool_id: str = Field(description="Tool ID to get metadata for")
    workflow: Workflow = Field(description="Full workflow for context")
    socket_id: str | None = Field(
        None, description="Optional: Specific input socket ID to get columns for"
    )


@router.post("/execute")
async def execute_workflow(
    request: ExecuteWorkflowRequest,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Execute entire workflow or up to a specific tool.

    This endpoint executes tools in dependency order, passing LazyFrames
    between them. Results are collected and returned.

    Use target_tool_id to execute only part of the workflow (useful for debugging).
    Use preview_limit to limit rows returned (useful for large datasets).
    The preview_limit is clamped to max_preview_rows from server config.
    
    Server connections are resolved before execution. Client connections must
    have their source URI already populated.
    """
    try:
        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(request.workflow)
        resolver.validate_client_connections(resolved_workflow)
        
        executor = WorkflowExecutor()
        result = await executor.execute_workflow(
            workflow=resolved_workflow,
            target_tool_id=request.target_tool_id,
            preview_limit=_clamp_preview_limit(request.preview_limit),
        )
        return result

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except ExecutionError as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")
    except ToolError as e:
        raise HTTPException(status_code=400, detail=f"Tool error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/tool/execute")
async def execute_tool(
    request: ExecuteToolRequest,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Execute a single tool and its dependencies.

    This is useful for previewing a tool's output in the UI without
    running the entire workflow.

    The tool and all upstream dependencies will be executed.
    Returns data for the specified socket only.
    The preview_limit is clamped to max_preview_rows from server config.
    """
    try:
        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(request.workflow)
        resolver.validate_client_connections(resolved_workflow)
        
        executor = WorkflowExecutor()
        result = await executor.execute_single_tool(
            workflow=resolved_workflow,
            tool_id=request.tool_id,
            socket_id=request.socket_id,
            preview_limit=_clamp_preview_limit(request.preview_limit),
        )
        return result

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except ExecutionError as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")
    except ToolError as e:
        raise HTTPException(status_code=400, detail=f"Tool error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/tool/schema")
async def get_tool_schema(
    request: ToolSchemaRequest,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Get output schema for a tool without executing it fully.

    This executes upstream tools to determine input schemas, then asks
    the tool for its output schema based on those inputs.

    Useful for populating dropdowns with available columns from upstream tools.
    Returns schema for the specified socket only.
    """
    try:
        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(request.workflow)
        resolver.validate_client_connections(resolved_workflow)
        
        executor = WorkflowExecutor()
        result = await executor.get_tool_schema(
            workflow=resolved_workflow,
            tool_id=request.tool_id,
            socket_id=request.socket_id,
        )
        return result

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except ExecutionError as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")
    except ToolError as e:
        raise HTTPException(status_code=400, detail=f"Tool error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/tool/metadata")
async def get_tool_metadata(
    request: ToolMetadataRequest,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Get metadata for a tool for autocomplete suggestions.

    Returns available columns from input sockets plus common Polars functions.
    Useful for Monaco editor autocomplete in Formula/Filter tools.

    This executes upstream tools to determine input columns.
    """
    try:
        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(request.workflow)
        resolver.validate_client_connections(resolved_workflow)
        
        executor = WorkflowExecutor()
        result = await executor.get_tool_metadata(
            workflow=resolved_workflow,
            tool_id=request.tool_id,
            socket_id=request.socket_id,
        )
        return result

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except ExecutionError as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")
    except ToolError as e:
        raise HTTPException(status_code=400, detail=f"Tool error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


class PreviewAllRequest(BaseModel):
    """Request to preview all tools in one request"""

    workflow: Workflow = Field(description="Full workflow to execute")
    preview_limit: int | None = Field(
        None, description="Optional: Limit rows returned in preview per tool"
    )


@router.post("/preview_all")
async def preview_all_tools(
    request: PreviewAllRequest,
    resolver: ConnectionResolver = Depends(get_connection_resolver),
) -> dict[str, Any]:
    """
    Execute workflow and return preview data for ALL tools.

    This is more efficient than calling /tool/execute multiple times
    because upstream tools are only executed once. Useful for loading
    all previews after opening a workflow or when data sources change.

    Returns a dict mapping tool_id -> outputs for every tool in the workflow.
    The preview_limit is clamped to max_preview_rows from server config.
    """
    try:
        # Resolve server connections and validate client connections
        resolved_workflow = resolver.resolve_workflow_connections(request.workflow)
        resolver.validate_client_connections(resolved_workflow)
        
        executor = WorkflowExecutor()
        result = await executor.preview_all_tools(
            workflow=resolved_workflow,
            preview_limit=_clamp_preview_limit(request.preview_limit),
        )
        return result

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except ExecutionError as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")
    except ToolError as e:
        raise HTTPException(status_code=400, detail=f"Tool error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


class PreviewCodeRequest(BaseModel):
    """Request to generate Python code preview"""

    workflow: Workflow = Field(description="Workflow to generate code for")


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
    try:
        generator = PythonCodeGenerator(request.workflow)
        code = generator.generate()
        return PreviewCodeResponse(code=code)

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
