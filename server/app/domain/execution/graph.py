"""Execution graph builder and topological sort"""

from collections import defaultdict, deque

from app.api.models.workflow import Socket, Tool, Workflow
from app.utils.errors import ValidationError


class ExecutionGraph:
    """Build and analyze workflow execution graph"""

    def __init__(self, workflow: Workflow):
        self.workflow = workflow
        self.dependencies, self.dependents, self.in_degree = self._build_dependency_graph()

    def _build_dependency_graph(
        self,
    ) -> tuple[dict[str, list[str]], dict[str, list[str]], dict[str, int]]:
        """
        Build dependency and reverse dependency graphs from wires.
        """
        graph: dict[str, list[str]] = defaultdict(list)
        dependency_sets: dict[str, set[str]] = defaultdict(set)

        # Initialize all tools in graph
        for tool in self.workflow.tools:
            if tool.id not in graph:
                graph[tool.id] = []

        # Build dependencies from wires
        for wire in self.workflow.wires:
            # Target tool depends on source tool
            target_tool_id = wire.to.tool
            source_tool_id = wire.from_.tool

            if source_tool_id not in dependency_sets[target_tool_id]:
                graph[target_tool_id].append(source_tool_id)
                dependency_sets[target_tool_id].add(source_tool_id)

        dependencies = dict(graph)
        dependents: dict[str, list[str]] = defaultdict(list)
        in_degree = {tool_id: len(deps) for tool_id, deps in dependencies.items()}

        # Iterate in dependency graph order to preserve the existing queue ordering.
        for tool_id, deps in dependencies.items():
            for dependency in deps:
                dependents[dependency].append(tool_id)

        return dependencies, dict(dependents), in_degree

    def execution_order(self) -> list[str]:
        """
        Determine execution order using topological sort (Kahn's algorithm).
        Returns list of tool IDs in execution order.
        Raises ValidationError if cycle detected.
        """
        # Work on a copy so repeated calls return the same result.
        in_degree = self.in_degree.copy()

        # Queue of nodes with no dependencies
        queue = deque([tool_id for tool_id, degree in in_degree.items() if degree == 0])

        result = []

        while queue:
            # Process node with no dependencies
            current = queue.popleft()
            result.append(current)

            for tool_id in self.dependents.get(current, []):
                in_degree[tool_id] -= 1
                if in_degree[tool_id] == 0:
                    queue.append(tool_id)

        # Check for cycles
        if len(result) != len(self.dependencies):
            raise ValidationError("Workflow contains a cycle. Cannot determine execution order.")

        return result

    def ancestors(self, tool_id: str) -> set[str]:
        """Return the IDs of every tool that transitively feeds ``tool_id``.

        The tool itself is not included. Tools that merely share a downstream
        consumer with ``tool_id`` (sibling branches) are not ancestors.
        """
        seen: set[str] = set()
        stack = list(self.dependencies.get(tool_id, []))
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            stack.extend(self.dependencies.get(current, []))
        return seen

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

        # Index tools and sockets once while preserving the first-match behavior.
        tools_by_id: dict[str, Tool] = {}
        sockets_by_tool_id: dict[str, dict[str, Socket]] = {}
        for tool in self.workflow.tools:
            if tool.id not in tools_by_id:
                tools_by_id[tool.id] = tool
                sockets_by_tool_id[tool.id] = {}
                for socket in tool.sockets:
                    sockets_by_tool_id[tool.id].setdefault(socket.id, socket)

        # Check all wires reference valid tools
        tool_ids = tools_by_id.keys()
        for wire in self.workflow.wires:
            if wire.from_.tool not in tool_ids:
                errors.append(f"Wire references unknown source tool: {wire.from_.tool}")
            if wire.to.tool not in tool_ids:
                errors.append(f"Wire references unknown target tool: {wire.to.tool}")

        # Check all wires reference valid sockets
        for wire in self.workflow.wires:
            source_tool = tools_by_id.get(wire.from_.tool)
            target_tool = tools_by_id.get(wire.to.tool)

            if source_tool:
                source_socket = sockets_by_tool_id[source_tool.id].get(wire.from_.socket)
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
                target_socket = sockets_by_tool_id[target_tool.id].get(wire.to.socket)
                if not target_socket:
                    errors.append(
                        f"Wire references unknown socket {wire.to.socket} on tool {wire.to.tool}"
                    )
                elif target_socket.direction != "input":
                    errors.append(
                        f"Wire target socket {wire.to.socket} on tool {wire.to.tool} "
                        f"is not an input socket"
                    )

        return errors
