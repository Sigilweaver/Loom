"""Workflow executor - orchestrates tool execution"""

import logging
import time
from pathlib import Path
from typing import Any

import polars as pl

from app.api.models.workflow import Tool, Workflow
from app.config import settings
from app.domain.execution.graph import ExecutionGraph
from app.domain.tools.registry import ToolRegistry
from app.utils.errors import ExecutionError
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars

logger = logging.getLogger(__name__)


class WorkflowExecutor:
    """
    Execute workflows by running tools in dependency order.

    Stores intermediate LazyFrames in memory and passes them between tools.
    """

    def __init__(self):
        self.results: dict[str, dict[str, pl.LazyFrame]] = {}  # tool_id -> socket_id -> LazyFrame
        self.archive_dir: Path | None = None  # Set when archiving is enabled

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
        start_time = time.time()
        execution_log = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "target_tool_id": target_tool_id,
            "preview_limit": preview_limit,
            "status": "started",
        }

        # Initialize archive if enabled
        if settings.archive_enabled:
            try:
                from app.domain.workflow.archive import WorkflowArchive
                archive = WorkflowArchive(settings.archive_path)
                self.archive_dir = archive.create_archive(workflow)
                execution_log["archive_path"] = str(self.archive_dir.relative_to(archive.archive_root))
                logger.info(f"Workflow archived to: {self.archive_dir}")
            except Exception as e:
                logger.error(f"Failed to create workflow archive: {e}")
                self.archive_dir = None

        try:
            # Build execution graph
            graph = ExecutionGraph(workflow)

            # Validate workflow
            validation_errors = graph.validate()
            if validation_errors:
                error_msg = f"Workflow validation failed: {', '.join(validation_errors)}"
                execution_log["status"] = "validation_failed"
                execution_log["error"] = error_msg
                execution_log["validation_errors"] = validation_errors
                self._save_execution_log(execution_log, start_time)
                raise ExecutionError(error_msg)

            # Get execution order
            execution_order = graph.execution_order()
            execution_log["execution_order"] = execution_order
            execution_log["tool_count"] = len(execution_order)

            # Execute tools in order
            tool_execution_logs = []
            for tool_id in execution_order:
                tool_start = time.time()
                tool = self._get_tool(workflow, tool_id)

                # Gather inputs from previous results
                inputs = self._gather_inputs(tool_id, graph)

                # Execute tool
                outputs = await self._execute_tool(tool, inputs)

                # Store results
                self.results[tool_id] = outputs

                # Log tool execution
                tool_execution_logs.append({
                    "tool_id": tool_id,
                    "tool_type": tool.type,
                    "execution_time_ms": (time.time() - tool_start) * 1000,
                    "status": "success",
                })

                # Stop if target reached
                if target_tool_id and tool_id == target_tool_id:
                    break

            execution_log["tool_executions"] = tool_execution_logs

            # Format results
            result = await self._format_results(
                workflow,
                target_tool_id or execution_order[-1],
                preview_limit
            )

            # Update execution log with success
            execution_log["status"] = "completed"
            execution_log["result_summary"] = {
                "tool_id": result["tool_id"],
                "output_count": len(result["outputs"]),
            }
            self._save_execution_log(execution_log, start_time)

            return result

        except Exception as e:
            # Log execution failure
            execution_log["status"] = "failed"
            execution_log["error"] = str(e)
            execution_log["error_type"] = type(e).__name__
            self._save_execution_log(execution_log, start_time)
            raise

    async def execute_single_tool(
        self,
        workflow: Workflow,
        tool_id: str,
        socket_id: str,
        preview_limit: int | None = None,
    ) -> dict[str, Any]:
        """
        Execute a single tool and its dependencies.

        Useful for previewing a tool's output in the UI.

        Args:
            workflow: Workflow containing the tool
            tool_id: Tool ID to execute
            socket_id: Socket ID to return data for
            preview_limit: Optional row limit for preview

        Returns:
            Dict with single-socket output (tool_id, socket_id, data_schema, data, row_count)
        """
        result = await self.execute_workflow(workflow, target_tool_id=tool_id, preview_limit=preview_limit)

        socket_key = str(socket_id)
        if socket_key not in result.get("outputs", {}):
            raise ExecutionError(f"Socket {socket_id} not found in tool {tool_id} outputs")

        socket_output = result["outputs"][socket_key]
        return {
            "tool_id": tool_id,
            "socket_id": socket_id,
            "data_schema": socket_output.get("data_schema"),
            "data": socket_output.get("data"),
            "row_count": socket_output.get("row_count"),
        }

    async def preview_all_tools(
        self,
        workflow: Workflow,
        preview_limit: int = 100,
    ) -> dict[str, Any]:
        """
        Execute entire workflow and return preview data for ALL tools.

        This is more efficient than calling execute_single_tool multiple times
        because upstream tools are only executed once.

        Args:
            workflow: Workflow to execute
            preview_limit: Row limit for preview per tool

        Returns:
            Dict with tool_id -> outputs for every executed tool
        """
        # Execute the full workflow (this populates self.results for all tools)
        await self.execute_workflow(workflow, preview_limit=preview_limit)

        # Format results for all tools
        all_results = {}
        for tool_id, tool_outputs in self.results.items():
            outputs = {}
            for socket_id, lf in tool_outputs.items():
                # Collect data for preview
                df = lf.head(preview_limit).collect()
                outputs[str(socket_id)] = {
                    "data_schema": schema_from_polars(df),
                    "data": dataframe_to_dict_list(df),
                    "row_count": len(df),
                }
            all_results[tool_id] = {"outputs": outputs}

        return {"tools": all_results}

    async def get_tool_schema(
        self,
        workflow: Workflow,
        tool_id: str,
        socket_id: str,
    ) -> dict[str, Any]:
        """
        Get output schema for a tool without executing it.

        Executes upstream tools if needed to determine schemas.

        Args:
            workflow: Workflow containing the tool
            tool_id: Tool ID to get schema for
            socket_id: Socket ID to return schema for

        Returns:
            Dict with single-socket schema (tool_id, socket_id, data_schema)
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
        for sid, source_list in tool_inputs.items():
            if not source_list:
                continue

            if len(source_list) > 1:
                # Multiple inputs (Union tool)
                schemas = []
                for source_tool_id, source_socket_id in source_list:
                    if source_tool_id in self.results:
                        lf = self.results[source_tool_id][source_socket_id]
                        schemas.append(schema_from_polars(lf))
                input_schemas[sid] = schemas
            else:
                # Single input
                source_tool_id, source_socket_id = source_list[0]
                if source_tool_id in self.results:
                    # Get schema from LazyFrame
                    lf = self.results[source_tool_id][source_socket_id]
                    input_schemas[sid] = schema_from_polars(lf)

        # Get output schemas from tool
        output_schemas = await tool_impl.get_output_schema(tool.config, input_schemas)

        socket_key = str(socket_id)
        if socket_key not in output_schemas:
            raise ExecutionError(f"Socket {socket_id} not found in tool {tool_id} output schemas")

        return {
            "tool_id": tool_id,
            "socket_id": socket_id,
            "data_schema": output_schemas[socket_key],
        }

    async def get_tool_metadata(
        self,
        workflow: Workflow,
        tool_id: str,
        socket_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Get metadata for a tool for autocomplete suggestions.

        Returns available columns per input socket, or for a specific socket.

        Args:
            workflow: Workflow containing the tool
            tool_id: Tool ID to get metadata for
            socket_id: Optional socket ID to filter columns for

        Returns:
            Dict with columns for the requested socket(s)
        """
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

        # Get input schemas for target tool, grouped by socket
        tool_inputs = graph.get_tool_inputs(tool_id)

        # If socket_id is specified, only process that socket
        sockets_to_process = (
            {socket_id: tool_inputs.get(socket_id, [])}
            if socket_id
            else tool_inputs
        )

        inputs_metadata: dict[str, list[dict[str, Any]]] = {}
        for sid, source_list in sockets_to_process.items():
            socket_columns = []
            # For Union-style multi-input, merge all sources
            for source_tool_id, source_socket_id in source_list:
                if source_tool_id in self.results:
                    lf = self.results[source_tool_id][source_socket_id]
                    schema = schema_from_polars(lf)
                    for col in schema.columns:
                        col_info = {
                            "name": col.name,
                            "dtype": col.dtype.value,
                            "nullable": col.nullable,
                        }
                        # Avoid duplicates for Union
                        if col_info not in socket_columns:
                            socket_columns.append(col_info)
            inputs_metadata[sid] = socket_columns

        # Return metadata
        return {
            "tool_id": tool_id,
            "socket_id": socket_id,
            "columns": inputs_metadata.get(socket_id, []) if socket_id else None,
            "inputs": inputs_metadata,
        }

    async def _execute_tool(
        self, tool: Tool, inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
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
    ) -> dict[str, pl.LazyFrame | list[pl.LazyFrame]]:
        """
        Gather inputs for a tool from previous results.

        For tools with multiple inputs on same socket (Union), returns list of LazyFrames.
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
                # Multiple inputs (Union tool) - return list
                frames = []
                for source_tool_id, source_socket_id in source_list:
                    if source_tool_id not in self.results:
                        raise ExecutionError(
                            f"Tool {tool_id} depends on {source_tool_id} but it hasn't been executed"
                        )
                    frames.append(self.results[source_tool_id][source_socket_id])

                inputs[socket_id] = frames

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

    def _save_execution_log(self, log_data: dict[str, Any], start_time: float) -> None:
        """Save execution log to archive"""
        if not self.archive_dir or not settings.archive_enabled:
            return

        try:
            # Add execution time
            log_data["execution_time_ms"] = (time.time() - start_time) * 1000

            from app.domain.workflow.archive import WorkflowArchive
            archive = WorkflowArchive(settings.archive_path)
            archive.save_execution_log(self.archive_dir, log_data)
        except Exception as e:
            logger.error(f"Failed to save execution log: {e}")
