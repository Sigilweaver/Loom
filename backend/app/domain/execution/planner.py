"""
ExecutionPlanner - Determines tool execution order and dependencies.

Separated from WorkflowExecutor to:
1. Enable testing execution planning independently
2. Allow future parallel execution strategies
3. Support execution plan caching
"""

from dataclasses import dataclass, field
from typing import Iterator

from app.api.models.workflow import Tool, Workflow
from app.domain.execution.graph import ExecutionGraph


@dataclass(frozen=True)
class ExecutionPlan:
    """
    Immutable execution plan for a workflow.

    Contains the execution order and input mappings for tools.
    This is a pure data structure with no behavior beyond accessors.
    """

    workflow_id: str
    execution_order: tuple[str, ...]  # Immutable tuple instead of list
    tool_inputs: dict[str, dict[str, list[tuple[str, str]]]]
    tool_map: dict[str, Tool]
    dependencies: dict[str, list[str]]

    def __iter__(self) -> Iterator[str]:
        """Iterate over tool IDs in execution order."""
        return iter(self.execution_order)

    def __len__(self) -> int:
        """Return number of tools in execution order."""
        return len(self.execution_order)

    def get_tool(self, tool_id: str) -> Tool:
        """Get tool by ID."""
        return self.tool_map[tool_id]

    def get_inputs(self, tool_id: str) -> dict[str, list[tuple[str, str]]]:
        """Get input mappings for a tool (socket_id -> [(source_tool, source_socket)])."""
        return self.tool_inputs.get(tool_id, {})

    def get_dependencies(self, tool_id: str) -> list[str]:
        """Get list of tool IDs this tool depends on."""
        return self.dependencies.get(tool_id, [])

    def get_execution_order_up_to(self, target_tool_id: str) -> list[str]:
        """
        Get execution order up to and including target tool.

        Args:
            target_tool_id: Tool ID to stop at

        Returns:
            List of tool IDs in execution order up to target
        """
        result = []
        for tool_id in self.execution_order:
            result.append(tool_id)
            if tool_id == target_tool_id:
                break
        return result


class ExecutionPlanner:
    """
    Plans workflow execution order.

    Responsible for:
    - Building dependency graph
    - Topological sort for execution order
    - Determining tool inputs
    - Validating workflow structure
    - Creating immutable execution plans
    """

    def __init__(self, workflow: Workflow):
        """
        Initialize planner for a workflow.

        Args:
            workflow: Workflow to plan execution for
        """
        self.workflow = workflow
        self._graph = ExecutionGraph(workflow)

    def create_plan(self, target_tool_id: str | None = None) -> ExecutionPlan:
        """
        Create an execution plan for the workflow.

        Args:
            target_tool_id: Optional tool ID to create partial plan for.
                            If provided, plan only includes tools needed to execute target.

        Returns:
            Immutable ExecutionPlan with execution order and input mappings
        """
        # Get full execution order
        full_order = self._graph.execution_order()

        # Filter to target if specified
        if target_tool_id:
            # Find index of target
            try:
                target_index = full_order.index(target_tool_id)
                execution_order = full_order[: target_index + 1]
            except ValueError:
                # Target not found, return full order
                execution_order = full_order
        else:
            execution_order = full_order

        # Build tool map
        tool_map = {tool.id: tool for tool in self.workflow.tools}

        # Build input mappings for each tool
        tool_inputs = {
            tool_id: self._graph.get_tool_inputs(tool_id)
            for tool_id in execution_order
        }

        return ExecutionPlan(
            workflow_id=self.workflow.meta.workflow_id,
            execution_order=tuple(execution_order),
            tool_inputs=tool_inputs,
            tool_map=tool_map,
            dependencies=dict(self._graph.dependencies),
        )

    def validate(self) -> list[str]:
        """
        Validate workflow structure.

        Returns:
            List of error messages (empty if valid)
        """
        return self._graph.validate()

    @property
    def graph(self) -> ExecutionGraph:
        """Access underlying execution graph (for advanced operations)."""
        return self._graph
