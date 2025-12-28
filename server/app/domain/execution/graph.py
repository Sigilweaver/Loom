"""Execution graph builder and topological sort"""

from collections import defaultdict, deque

from app.api.models.workflow import Workflow
from app.utils.errors import ValidationError


class ExecutionGraph:
    """Build and analyze workflow execution graph"""

    def __init__(self, workflow: Workflow):
        self.workflow = workflow
        self.dependencies = self._build_dependency_graph()

    def _build_dependency_graph(self) -> dict[str, list[str]]:
        """
        Build dependency graph from wires.
        Returns dict of tool_id -> list of tool_ids it depends on.
        """
        graph: dict[str, list[str]] = defaultdict(list)

        # Initialize all tools in graph
        for tool in self.workflow.tools:
            if tool.id not in graph:
                graph[tool.id] = []

        # Build dependencies from wires
        for wire in self.workflow.wires:
            # Target tool depends on source tool
            target_tool_id = wire.to.tool
            source_tool_id = wire.from_.tool

            if source_tool_id not in graph[target_tool_id]:
                graph[target_tool_id].append(source_tool_id)

        return dict(graph)

    def execution_order(self) -> list[str]:
        """
        Determine execution order using topological sort (Kahn's algorithm).
        Returns list of tool IDs in execution order.
        Raises ValidationError if cycle detected.
        """
        # Calculate in-degrees
        in_degree: dict[str, int] = defaultdict(int)
        for tool_id in self.dependencies:
            in_degree[tool_id] = len(self.dependencies[tool_id])

        # Queue of nodes with no dependencies
        queue = deque([tool_id for tool_id, degree in in_degree.items() if degree == 0])

        result = []

        while queue:
            # Process node with no dependencies
            current = queue.popleft()
            result.append(current)

            # Find nodes that depend on current node
            for tool_id, deps in self.dependencies.items():
                if current in deps:
                    in_degree[tool_id] -= 1
                    if in_degree[tool_id] == 0:
                        queue.append(tool_id)

        # Check for cycles
        if len(result) != len(self.dependencies):
            raise ValidationError(
                "Workflow contains a cycle. Cannot determine execution order."
            )

        return result

    def get_tool_inputs(self, tool_id: str) -> dict[str, list[tuple[str, str]]]:
        """
        Get input mappings for a tool.
        Returns dict of socket_id -> [(source_tool_id, source_socket_id), ...]

        For tools with multiple=True sockets, multiple sources map to same socket.
        """
        inputs: dict[str, list[tuple[str, str]]] = defaultdict(list)

        for wire in self.workflow.wires:
            if wire.to.tool == tool_id:
                target_socket = wire.to.socket
                source_info = (wire.from_.tool, wire.from_.socket)
                inputs[target_socket].append(source_info)

        return dict(inputs)

    def validate(self) -> list[str]:
        """
        Validate workflow structure.
        Returns list of error messages.
        """
        errors = []

        # Check for cycles
        try:
            self.execution_order()
        except ValidationError as e:
            errors.append(str(e))

        # Check all wires reference valid tools
        tool_ids = {tool.id for tool in self.workflow.tools}
        for wire in self.workflow.wires:
            if wire.from_.tool not in tool_ids:
                errors.append(f"Wire references unknown source tool: {wire.from_.tool}")
            if wire.to.tool not in tool_ids:
                errors.append(f"Wire references unknown target tool: {wire.to.tool}")

        # Check all wires reference valid sockets
        for wire in self.workflow.wires:
            source_tool = next(
                (t for t in self.workflow.tools if t.id == wire.from_.tool), None
            )
            target_tool = next(
                (t for t in self.workflow.tools if t.id == wire.to.tool), None
            )

            if source_tool:
                source_socket = next(
                    (s for s in source_tool.sockets if s.id == wire.from_.socket), None
                )
                if not source_socket:
                    errors.append(
                        f"Wire references unknown socket {wire.from_.socket} "
                        f"on tool {wire.from_.tool}"
                    )
                elif source_socket.direction != "output":
                    errors.append(
                        f"Wire source socket {wire.from_.socket} on tool {wire.from_.tool} "
                        f"is not an output socket"
                    )

            if target_tool:
                target_socket = next(
                    (s for s in target_tool.sockets if s.id == wire.to.socket), None
                )
                if not target_socket:
                    errors.append(
                        f"Wire references unknown socket {wire.to.socket} "
                        f"on tool {wire.to.tool}"
                    )
                elif target_socket.direction != "input":
                    errors.append(
                        f"Wire target socket {wire.to.socket} on tool {wire.to.tool} "
                        f"is not an input socket"
                    )

        return errors
