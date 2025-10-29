"""Workflow executor - orchestrates tool execution"""

from typing import Any

import polars as pl

from app.api.models.workflow import Workflow, Tool
from app.api.models.common import DataSchema, DataPreview
from app.domain.execution.graph import ExecutionGraph
from app.domain.tools.registry import ToolRegistry
from app.utils.errors import ExecutionError, ToolError
from app.utils.type_mapping import schema_from_polars, dataframe_to_dict_list


class WorkflowExecutor:
    """
    Execute workflows by running tools in dependency order.

    Stores intermediate LazyFrames in memory and passes them between tools.
    """

    def __init__(self):
        self.results: dict[str, dict[int, pl.LazyFrame]] = {}  # tool_id -> socket_id -> LazyFrame

    async def execute_workflow(
        self,
        workflow: Workflow,
        target_tool_id: str | None = None,
        preview_limit: int | None = None,
    ) -> dict[str, Any]:
        """
        Execute entire workflow or up to a specific tool.

        Args:
            workflow: Workflow to execute
            target_tool_id: Optional tool ID to stop at (executes up to and including this tool)
            preview_limit: Optional row limit for preview results

        Returns:
            Dict with execution results, schemas, and metrics
        """
        # Build execution graph
        graph = ExecutionGraph(workflow)

        # Validate workflow
        validation_errors = graph.validate()
        if validation_errors:
            raise ExecutionError(f"Workflow validation failed: {', '.join(validation_errors)}")

        # Get execution order
        execution_order = graph.execution_order()

        # Execute tools in order
        for tool_id in execution_order:
            tool = self._get_tool(workflow, tool_id)

            # Gather inputs from previous results
            inputs = self._gather_inputs(tool_id, graph)

            # Execute tool
            outputs = await self._execute_tool(tool, inputs)

            # Store results
            self.results[tool_id] = outputs

            # Stop if target reached
            if target_tool_id and tool_id == target_tool_id:
                break

        # Format results
        return await self._format_results(
            workflow, 
            target_tool_id or execution_order[-1],
            preview_limit
        )

    async def execute_single_tool(
        self,
        workflow: Workflow,
        tool_id: str,
        preview_limit: int | None = None,
    ) -> dict[str, Any]:
        """
        Execute a single tool and its dependencies.

        Useful for previewing a tool's output in the UI.

        Args:
            workflow: Workflow containing the tool
            tool_id: Tool ID to execute
            preview_limit: Optional row limit for preview

        Returns:
            Dict with tool outputs, schemas, and metrics
        """
        return await self.execute_workflow(workflow, target_tool_id=tool_id, preview_limit=preview_limit)

    async def get_tool_schema(
        self,
        workflow: Workflow,
        tool_id: str,
    ) -> dict[str, Any]:
        """
        Get output schema for a tool without executing it.

        Executes upstream tools if needed to determine schemas.

        Args:
            workflow: Workflow containing the tool
            tool_id: Tool ID to get schema for

        Returns:
            Dict with output schemas for each socket
        """
        tool = self._get_tool(workflow, tool_id)
        tool_impl = ToolRegistry.get(tool.type)

        # Build execution graph to find dependencies
        graph = ExecutionGraph(workflow)
        execution_order = graph.execution_order()

        # Execute upstream tools up to (but not including) target
        target_index = execution_order.index(tool_id)
        for upstream_tool_id in execution_order[:target_index]:
            upstream_tool = self._get_tool(workflow, upstream_tool_id)
            inputs = self._gather_inputs(upstream_tool_id, graph)
            outputs = await self._execute_tool(upstream_tool, inputs)
            self.results[upstream_tool_id] = outputs

        # Get input schemas for target tool
        input_schemas = {}
        tool_inputs = graph.get_tool_inputs(tool_id)
        for socket_id, source_list in tool_inputs.items():
            # For now, just use schema from first source (handles Union later)
            if source_list:
                source_tool_id, source_socket_id = source_list[0]
                if source_tool_id in self.results:
                    # Get schema from LazyFrame
                    lf = self.results[source_tool_id][source_socket_id]
                    input_schemas[socket_id] = schema_from_polars(lf)

        # Get output schemas from tool
        output_schemas = await tool_impl.get_output_schema(tool.config, input_schemas)

        return {
            "tool_id": tool_id,
            "outputs": {
                str(socket_id): {"data_schema": schema}
                for socket_id, schema in output_schemas.items()
            },
        }

    async def _execute_tool(
        self, tool: Tool, inputs: dict[int, pl.LazyFrame]
    ) -> dict[int, pl.LazyFrame]:
        """Execute a single tool"""
        try:
            tool_impl = ToolRegistry.get(tool.type)
            outputs = await tool_impl.execute(tool.config, inputs)
            return outputs
        except Exception as e:
            raise ExecutionError(
                f"Failed to execute tool {tool.id} ({tool.type}): {str(e)}"
            ) from e

    def _gather_inputs(
        self, tool_id: str, graph: ExecutionGraph
    ) -> dict[int, pl.LazyFrame]:
        """
        Gather inputs for a tool from previous results.

        For tools with multiple inputs on same socket (Union), concatenates them.
        """
        inputs = {}
        tool_inputs = graph.get_tool_inputs(tool_id)

        for socket_id, source_list in tool_inputs.items():
            if len(source_list) == 1:
                # Single input
                source_tool_id, source_socket_id = source_list[0]
                if source_tool_id not in self.results:
                    raise ExecutionError(
                        f"Tool {tool_id} depends on {source_tool_id} but it hasn't been executed"
                    )
                inputs[socket_id] = self.results[source_tool_id][source_socket_id]
            elif len(source_list) > 1:
                # Multiple inputs (Union tool) - concatenate
                frames = []
                for source_tool_id, source_socket_id in source_list:
                    if source_tool_id not in self.results:
                        raise ExecutionError(
                            f"Tool {tool_id} depends on {source_tool_id} but it hasn't been executed"
                        )
                    frames.append(self.results[source_tool_id][source_socket_id])
                
                # Concatenate all inputs
                inputs[socket_id] = pl.concat(frames)

        return inputs

    async def _format_results(
        self,
        workflow: Workflow,
        target_tool_id: str,
        preview_limit: int | None = None,
    ) -> dict[str, Any]:
        """Format execution results for API response"""
        if target_tool_id not in self.results:
            raise ExecutionError(f"Tool {target_tool_id} was not executed")

        outputs = {}
        tool_outputs = self.results[target_tool_id]

        for socket_id, lf in tool_outputs.items():
            # Collect data for preview
            if preview_limit:
                df = lf.head(preview_limit).collect()
            else:
                df = lf.collect()

            outputs[str(socket_id)] = {
                "data_schema": schema_from_polars(df),
                "data": dataframe_to_dict_list(df),
                "row_count": len(df),
            }

        return {
            "tool_id": target_tool_id,
            "outputs": outputs,
        }

    def _get_tool(self, workflow: Workflow, tool_id: str) -> Tool:
        """Get tool by ID from workflow"""
        for tool in workflow.tools:
            if tool.id == tool_id:
                return tool
        raise ExecutionError(f"Tool {tool_id} not found in workflow")
