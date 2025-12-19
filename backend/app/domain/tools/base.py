"""Base tool interface"""

from abc import ABC, abstractmethod
from typing import Any

import polars as pl

from app.api.models.common import DataSchema


class BaseTool(ABC):
    """
    Base class for all tool implementations.

    Tools receive Polars LazyFrames as inputs and return LazyFrames as outputs.
    All execution is lazy by default - collection happens only when needed
    (for preview or final output).
    """

    @abstractmethod
    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """
        Execute tool logic.

        Args:
            config: Tool-specific configuration from workflow JSON
            inputs: Dict of socket_id -> LazyFrame (or list of LazyFrames) from connected tools

        Returns:
            Dict of socket_id -> LazyFrame for output sockets

        Note: Keep execution lazy! Don't call .collect() unless absolutely necessary.
        """
        pass

    @abstractmethod
    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Get output schema without executing the tool.

        Args:
            config: Tool-specific configuration
            input_schemas: Dict of socket_id -> DataSchema (or list) from input tools

        Returns:
            Dict of socket_id -> DataSchema for output sockets

        This is used to populate dropdowns and validate connections without
        running the full workflow.
        """
        pass

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate tool configuration.

        Args:
            config: Tool-specific configuration

        Returns:
            List of error messages (empty if valid)

        Override this if your tool has specific validation requirements.
        """
        return []

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """
        Generate Python code for this tool.

        Args:
            tool_id: Unique identifier for this tool instance
            config: Tool-specific configuration
            input_vars: Dict of socket_id -> variable name (or list of names) for inputs

        Returns:
            (code_lines, output_vars):
                - code_lines: List of Python code lines
                - output_vars: Dict of socket_id -> variable name for outputs

        Override this to provide code generation for your tool.
        Default implementation returns a TODO comment.
        """
        from app.domain.workflow.code_generator import PythonCodeGenerator

        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"
        return (
            [f"# TODO: {self.__class__.__name__} code generation not implemented"],
            {"output": var_name},
        )

    def _get_input_var(self, var: str | list[str] | None, default: str = "df_input") -> str:
        """
        Extract single variable name from input_vars value.

        Args:
            var: Value from input_vars (str, list[str], or None)
            default: Default variable name if None

        Returns:
            Single variable name string
        """
        if var is None:
            return default
        if isinstance(var, list):
            return var[0] if var else default
        return var

    def is_blocking(self) -> bool:
        """
        Check if this tool requires full data materialization.

        Blocking tools break Polars streaming optimization - they must
        see all input data before producing any output. Examples include
        Sort (must see all rows to determine order), Summarize (must see
        all rows per group), and Join (must scan both sides for matches).

        Returns:
            True if the tool is blocking, False otherwise
        """
        return False

    def should_cache(self, config: dict[str, Any]) -> bool:
        """
        Check if this tool's output should be cached to disk.

        By default, cache if the tool is blocking. Override this method
        for special cases (e.g., Input caches for databases but not files).

        Args:
            config: Tool-specific configuration

        Returns:
            True if output should be cached, False otherwise
        """
        return self.is_blocking()
