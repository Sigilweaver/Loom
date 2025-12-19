"""Workflow executor - orchestrates tool execution"""

import logging
import time
from pathlib import Path
from typing import Any

import polars as pl

from app.api.models.common import DataSchema
from app.api.models.workflow import Tool, Workflow
from app.config import settings
from app.domain.execution.cache_manager import CacheManager
from app.domain.execution.planner import ExecutionPlan, ExecutionPlanner
from app.domain.tools.registry import ToolRegistry
from app.utils.errors import ExecutionError
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars

logger = logging.getLogger(__name__)


class WorkflowExecutor:
    """
    Execute workflows by running tools in dependency order.

    Stores intermediate LazyFrames in memory and passes them between tools.
    Delegates caching decisions to CacheManager and execution planning to
    ExecutionPlanner.
    """

    def __init__(self) -> None:
        self.results: dict[str, dict[str, pl.LazyFrame]] = {}
        self.archive_dir: Path | None = None

    async def execute_workflow(
        self,
        workflow: Workflow,
        target_tool_id: str | None = None,
        preview_limit: int | None = None,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        """
        Execute entire workflow or up to a specific tool.

        Args:
            workflow: Workflow to execute
            target_tool_id: Optional tool ID to stop at
            preview_limit: Optional row limit for preview results
            force_refresh: If True, clears cache before execution

        Returns:
            Dict with execution results, schemas, and metrics
        """
        start_time = time.time()
        execution_log = self._create_execution_log(target_tool_id, preview_limit, force_refresh)

        # Initialize archive if enabled
        self._init_archive(workflow, execution_log)

        # Initialize cache manager
        cache_mgr = CacheManager(workflow.meta.workflow_id, force_refresh)
        if force_refresh and cache_mgr.is_enabled:
            execution_log["cache_cleared"] = True

        try:
            # Create execution plan
            planner = ExecutionPlanner(workflow)
            validation_errors = planner.validate()
            if validation_errors:
                return self._handle_validation_failure(execution_log, validation_errors, start_time)

            plan = planner.create_plan(target_tool_id)
            execution_log["execution_order"] = list(plan.execution_order)
            execution_log["tool_count"] = len(plan)

            # Execute tools
            tool_logs, cache_hits = await self._execute_plan(plan, cache_mgr)
            execution_log["tool_executions"] = tool_logs
            execution_log["cache_hits"] = cache_hits

            # Format results
            final_tool_id = target_tool_id or list(plan.execution_order)[-1]
            result = self._format_results(final_tool_id, preview_limit)

            execution_log["status"] = "completed"
            execution_log["result_summary"] = {
                "tool_id": result["tool_id"],
                "output_count": len(result["outputs"]),
            }
            self._save_execution_log(execution_log, start_time)
            return result

        except Exception as e:
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
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        """Execute a single tool and its dependencies."""
        result = await self.execute_workflow(
            workflow, target_tool_id=tool_id, preview_limit=preview_limit,
            force_refresh=force_refresh,
        )

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
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        """Execute entire workflow and return preview data for ALL tools."""
        await self.execute_workflow(
            workflow, preview_limit=preview_limit, force_refresh=force_refresh
        )

        all_results = {}
        for tool_id, tool_outputs in self.results.items():
            outputs = {}
            for socket_id, lf in tool_outputs.items():
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
        """Get output schema for a tool without full execution."""
        tool = self._get_tool(workflow, tool_id)
        tool_impl = ToolRegistry.get(tool.type)

        # Execute upstream tools to get input schemas
        cache_mgr = CacheManager(workflow.meta.workflow_id)
        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan(tool_id)
        execution_order = list(plan.execution_order)

        target_index = execution_order.index(tool_id)
        for upstream_tool_id in execution_order[:target_index]:
            upstream_tool = plan.get_tool(upstream_tool_id)
            inputs = self._gather_inputs(upstream_tool_id, plan)
            outputs, _ = await self._execute_tool_with_cache(upstream_tool, inputs, plan, cache_mgr)
            self.results[upstream_tool_id] = outputs

        # Get input schemas for target tool
        input_schemas = self._build_input_schemas(tool_id, plan)
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
        """Get metadata for a tool for autocomplete suggestions."""
        cache_mgr = CacheManager(workflow.meta.workflow_id)
        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan(tool_id)
        execution_order = list(plan.execution_order)

        target_index = execution_order.index(tool_id)
        for upstream_tool_id in execution_order[:target_index]:
            upstream_tool = plan.get_tool(upstream_tool_id)
            inputs = self._gather_inputs(upstream_tool_id, plan)
            outputs, _ = await self._execute_tool_with_cache(upstream_tool, inputs, plan, cache_mgr)
            self.results[upstream_tool_id] = outputs

        # Get input schemas grouped by socket
        tool_inputs = plan.get_inputs(tool_id)
        if socket_id:
            sockets_to_process = {socket_id: tool_inputs.get(socket_id, [])}
        else:
            sockets_to_process = tool_inputs

        inputs_metadata: dict[str, list[dict[str, Any]]] = {}
        for sid, source_list in sockets_to_process.items():
            socket_columns = []
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
                        if col_info not in socket_columns:
                            socket_columns.append(col_info)
            inputs_metadata[sid] = socket_columns

        return {
            "tool_id": tool_id,
            "socket_id": socket_id,
            "columns": inputs_metadata.get(socket_id, []) if socket_id else None,
            "inputs": inputs_metadata,
        }

    # --- Private methods ---

    async def _execute_plan(
        self,
        plan: ExecutionPlan,
        cache_mgr: CacheManager,
    ) -> tuple[list[dict[str, Any]], int]:
        """Execute all tools in the plan."""
        tool_logs = []
        cache_hits = 0

        for tool_id in plan:
            tool_start = time.time()
            tool = plan.get_tool(tool_id)
            inputs = self._gather_inputs(tool_id, plan)
            outputs, from_cache = await self._execute_tool_with_cache(tool, inputs, plan, cache_mgr)

            self.results[tool_id] = outputs
            if from_cache:
                cache_hits += 1

            tool_logs.append({
                "tool_id": tool_id,
                "tool_type": tool.type,
                "execution_time_ms": (time.time() - tool_start) * 1000,
                "status": "success",
                "from_cache": from_cache,
            })

        return tool_logs, cache_hits

    async def _execute_tool_with_cache(
        self,
        tool: Tool,
        inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]],
        plan: ExecutionPlan,
        cache_mgr: CacheManager,
    ) -> tuple[dict[str, pl.LazyFrame], bool]:
        """Execute a single tool with cache support."""
        # Compute lineage hash (needed for all tools, even non-cached)
        lineage_hash = cache_mgr.compute_lineage_hash(tool, plan)

        # Check cache
        if cache_mgr.should_cache_tool(tool):
            cached = cache_mgr.check_cache(tool, lineage_hash)
            if cached:
                cache_mgr.record_lineage_hash(tool.id, lineage_hash)
                logger.debug(f"Cache hit for tool {tool.id}")
                return cached, True

        # Execute tool
        try:
            tool_impl = ToolRegistry.get(tool.type)
            outputs = await tool_impl.execute(tool.config, inputs)
        except Exception as e:
            raise ExecutionError(f"Failed to execute tool {tool.id} ({tool.type}): {str(e)}") from e

        # Store in cache if appropriate
        if cache_mgr.should_cache_tool(tool):
            outputs = cache_mgr.store_in_cache(tool, lineage_hash, outputs)

        # Record lineage hash for downstream tools
        cache_mgr.record_lineage_hash(tool.id, lineage_hash)
        return outputs, False

    def _gather_inputs(
        self,
        tool_id: str,
        plan: ExecutionPlan,
    ) -> dict[str, pl.LazyFrame | list[pl.LazyFrame]]:
        """Gather inputs for a tool from previous results."""
        inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]] = {}
        tool_inputs = plan.get_inputs(tool_id)

        for socket_id, source_list in tool_inputs.items():
            if len(source_list) == 1:
                source_tool_id, source_socket_id = source_list[0]
                if source_tool_id not in self.results:
                    raise ExecutionError(
                        f"Tool {tool_id} depends on {source_tool_id} but it hasn't been executed"
                    )
                inputs[socket_id] = self.results[source_tool_id][source_socket_id]
            elif len(source_list) > 1:
                frames = []
                for source_tool_id, source_socket_id in source_list:
                    if source_tool_id not in self.results:
                        raise ExecutionError(
                            f"Tool {tool_id} depends on {source_tool_id} "
                            "but it hasn't been executed"
                        )
                    frames.append(self.results[source_tool_id][source_socket_id])
                inputs[socket_id] = frames

        return inputs

    def _build_input_schemas(
        self,
        tool_id: str,
        plan: ExecutionPlan,
    ) -> dict[str, DataSchema | list[DataSchema]]:
        """Build input schemas for a tool from executed results."""
        input_schemas: dict[str, DataSchema | list[DataSchema]] = {}
        tool_inputs = plan.get_inputs(tool_id)

        for sid, source_list in tool_inputs.items():
            if not source_list:
                continue
            if len(source_list) > 1:
                schemas = []
                for source_tool_id, source_socket_id in source_list:
                    if source_tool_id in self.results:
                        lf = self.results[source_tool_id][source_socket_id]
                        schemas.append(schema_from_polars(lf))
                input_schemas[sid] = schemas
            else:
                source_tool_id, source_socket_id = source_list[0]
                if source_tool_id in self.results:
                    lf = self.results[source_tool_id][source_socket_id]
                    input_schemas[sid] = schema_from_polars(lf)

        return input_schemas

    def _format_results(
        self, target_tool_id: str, preview_limit: int | None = None
    ) -> dict[str, Any]:
        """Format execution results for API response."""
        if target_tool_id not in self.results:
            raise ExecutionError(f"Tool {target_tool_id} was not executed")

        outputs = {}
        for socket_id, lf in self.results[target_tool_id].items():
            df = lf.head(preview_limit).collect() if preview_limit else lf.collect()
            outputs[str(socket_id)] = {
                "data_schema": schema_from_polars(df),
                "data": dataframe_to_dict_list(df),
                "row_count": len(df),
            }

        return {"tool_id": target_tool_id, "outputs": outputs}

    def _get_tool(self, workflow: Workflow, tool_id: str) -> Tool:
        """Get tool by ID from workflow."""
        for tool in workflow.tools:
            if tool.id == tool_id:
                return tool
        raise ExecutionError(f"Tool {tool_id} not found in workflow")

    def _create_execution_log(
        self,
        target_tool_id: str | None,
        preview_limit: int | None,
        force_refresh: bool,
    ) -> dict[str, Any]:
        """Create initial execution log."""
        return {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "target_tool_id": target_tool_id,
            "preview_limit": preview_limit,
            "force_refresh": force_refresh,
            "status": "started",
        }

    def _init_archive(self, workflow: Workflow, execution_log: dict[str, Any]) -> None:
        """Initialize archive if enabled."""
        if not settings.archive_enabled:
            return
        try:
            from app.domain.workflow.archive import WorkflowArchive
            archive = WorkflowArchive(settings.archive_path)
            self.archive_dir = archive.create_archive(workflow)
            archive_rel = str(self.archive_dir.relative_to(archive.archive_root))
            execution_log["archive_path"] = archive_rel
            logger.info(f"Workflow archived to: {self.archive_dir}")
        except Exception as e:
            logger.error(f"Failed to create workflow archive: {e}")
            self.archive_dir = None

    def _handle_validation_failure(
        self,
        execution_log: dict[str, Any],
        validation_errors: list[str],
        start_time: float,
    ) -> dict[str, Any]:
        """Handle workflow validation failure."""
        error_msg = f"Workflow validation failed: {', '.join(validation_errors)}"
        execution_log["status"] = "validation_failed"
        execution_log["error"] = error_msg
        execution_log["validation_errors"] = validation_errors
        self._save_execution_log(execution_log, start_time)
        raise ExecutionError(error_msg)

    def _save_execution_log(self, log_data: dict[str, Any], start_time: float) -> None:
        """Save execution log to archive."""
        if not self.archive_dir or not settings.archive_enabled:
            return
        try:
            log_data["execution_time_ms"] = (time.time() - start_time) * 1000
            from app.domain.workflow.archive import WorkflowArchive
            archive = WorkflowArchive(settings.archive_path)
            archive.save_execution_log(self.archive_dir, log_data)
        except Exception as e:
            logger.error(f"Failed to save execution log: {e}")
