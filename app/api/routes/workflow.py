"""Workflow execution API routes"""

from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.models.workflow import Workflow
from app.domain.execution.executor import WorkflowExecutor
from app.domain.workflow.code_generator import PythonCodeGenerator
from app.utils.errors import ExecutionError, ValidationError, ToolError

router = APIRouter(prefix="/workflow", tags=["workflow"])


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
    preview_limit: int | None = Field(
        None, description="Optional: Limit rows returned in preview"
    )


class ToolSchemaRequest(BaseModel):
    """Request to get tool output schema"""

    tool_id: str = Field(description="Tool ID to get schema for")
    workflow: Workflow = Field(description="Full workflow for context")


@router.post("/execute")
async def execute_workflow(request: ExecuteWorkflowRequest):
    """
    Execute entire workflow or up to a specific tool.

    This endpoint executes tools in dependency order, passing LazyFrames
    between them. Results are collected and returned.

    Use target_tool_id to execute only part of the workflow (useful for debugging).
    Use preview_limit to limit rows returned (useful for large datasets).
    """
    try:
        executor = WorkflowExecutor()
        result = await executor.execute_workflow(
            workflow=request.workflow,
            target_tool_id=request.target_tool_id,
            preview_limit=request.preview_limit or 100,  # Default to 100 rows
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
async def execute_tool(request: ExecuteToolRequest):
    """
    Execute a single tool and its dependencies.

    This is useful for previewing a tool's output in the UI without
    running the entire workflow.

    The tool and all upstream dependencies will be executed.
    """
    try:
        executor = WorkflowExecutor()
        result = await executor.execute_single_tool(
            workflow=request.workflow,
            tool_id=request.tool_id,
            preview_limit=request.preview_limit or 100,
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
async def get_tool_schema(request: ToolSchemaRequest):
    """
    Get output schema for a tool without executing it fully.

    This executes upstream tools to determine input schemas, then asks
    the tool for its output schema based on those inputs.

    Useful for populating dropdowns with available columns from upstream tools.
    """
    try:
        executor = WorkflowExecutor()
        result = await executor.get_tool_schema(
            workflow=request.workflow,
            tool_id=request.tool_id,
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
async def preview_code(request: PreviewCodeRequest):
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
