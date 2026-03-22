"""Generate Python code from workflow"""

from datetime import UTC, datetime

from app.api.models.workflow import Tool, Workflow
from app.domain.execution.graph import ExecutionGraph
from app.domain.tools.registry import ToolRegistry


class PythonCodeGenerator:
    """
    Generate executable Python code from a workflow.

    Each tool implementation provides its own code generation logic via to_python_code().
    """

    def __init__(self, workflow: Workflow):
        self.workflow = workflow
        self.graph = ExecutionGraph(workflow)
        self.tool_map = {tool.id: tool for tool in workflow.tools}
        self.var_names: dict[str, dict[str, str]] = {}  # tool_id -> socket_id -> var_name

    def generate(self) -> str:
        """Generate complete Python script"""
        lines = []

        # Header
        lines.append("#!/usr/bin/env python3")
        lines.append('"""')
        lines.append("Auto-generated Sigilweaver Loom workflow")
        lines.append(f"Generated: {datetime.now(UTC).isoformat()}")
        lines.append('"""')
        lines.append("")
        lines.append("import polars as pl")
        lines.append("")

        # Validate workflow
        validation_errors = self.graph.validate()
        if validation_errors:
            lines.append("# ERROR: Workflow validation failed:")
            for error in validation_errors:
                lines.append(f"#   - {error}")
            return "\n".join(lines)

        # Get execution order
        execution_order = self.graph.execution_order()
        if not execution_order:
            lines.append("# ERROR: Could not determine execution order (cycle detected?)")
            return "\n".join(lines)

        # Generate code for each tool
        for tool_id in execution_order:
            tool = self.tool_map[tool_id]
            comment_header = f"# {tool.type}: {tool_id}"
            if tool.comment:
                # Emit multiline comments with # prefix on each line
                comment_lines = tool.comment.split("\n")
                if len(comment_lines) == 1:
                    comment_header += f" -- {tool.comment}"
                else:
                    comment_header += "\n" + "\n".join(f"# {line}" for line in comment_lines)
            lines.append(comment_header)

            try:
                tool_lines = self._generate_tool_code(tool)
                lines.extend(tool_lines)
            except Exception as e:
                lines.append(f"# ERROR generating code for {tool.type}: {str(e)}")

            lines.append("")

        # Footer - example output
        lines.append("# Collect and display results")
        lines.append("# (uncomment to execute)")
        for var_dict in self.var_names.values():
            for var_name in var_dict.values():
                if var_name.startswith("df_"):
                    lines.append(f"# print({var_name}.collect())")

        return "\n".join(lines)

    def _generate_tool_code(self, tool: Tool) -> list[str]:
        """Generate code for a single tool"""
        # Get tool implementation
        tool_impl = ToolRegistry.get(tool.type)

        # Gather input variable names
        input_vars = self._get_input_vars(tool.id)

        # Generate code via tool implementation
        if hasattr(tool_impl, "to_python_code"):
            code_lines, output_vars = tool_impl.to_python_code(tool.id, tool.config, input_vars)

            # Store output variable names for downstream tools
            self.var_names[tool.id] = output_vars

            return code_lines
        else:
            # Fallback for tools without code generation
            return [f"# TODO: {tool.type} does not implement code generation yet"]

    def _get_input_vars(self, tool_id: str) -> dict[str, str | list[str]]:
        """Get input variable names for a tool.

        Returns dict of socket_id -> var_name (single) or [var_names] (multiple).
        """
        input_vars: dict[str, str | list[str]] = {}
        tool_inputs = self.graph.get_tool_inputs(tool_id)

        for socket_id, sources in tool_inputs.items():
            if sources:
                if len(sources) == 1:
                    # Single input - return as string
                    source_tool_id, source_socket_id = sources[0]
                    if source_tool_id in self.var_names:
                        var_name = self.var_names[source_tool_id].get(source_socket_id)
                        if var_name:
                            input_vars[socket_id] = var_name
                else:
                    # Multiple inputs - return as list
                    var_names = []
                    for source_tool_id, source_socket_id in sources:
                        if source_tool_id in self.var_names:
                            var_name = self.var_names[source_tool_id].get(source_socket_id)
                            if var_name:
                                var_names.append(var_name)
                    if var_names:
                        input_vars[socket_id] = var_names

        return input_vars

    @staticmethod
    def sanitize_var_name(text: str) -> str:
        """Convert tool ID to valid Python variable name"""
        return text.replace("-", "_").replace(" ", "_").lower()

    @staticmethod
    def escape_string(s: str) -> str:
        """Escape string for use in Python code"""
        return (
            s.replace("\\", "\\\\")
            .replace('"', '\\"')
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
        )

    @staticmethod
    def escape_path(path: str) -> str:
        """Escape file path for Python string"""
        return path.replace("\\", "\\\\").replace('"', '\\"')
