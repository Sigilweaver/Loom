"""Abstract base class for file loaders"""

from abc import ABC, abstractmethod
from typing import Any

import polars as pl


class FileLoader(ABC):
    """
    Abstract base class for file format loaders.

    Each loader handles a specific file format (CSV, Parquet, etc.)
    and provides methods to load data into LazyFrames.
    """

    @abstractmethod
    async def load(self, config: dict[str, Any]) -> pl.LazyFrame:
        """
        Load data from a file source.

        Args:
            config: Configuration dict containing at minimum:
                - source: File path
                - Other format-specific options

        Returns:
            LazyFrame with loaded data

        Raises:
            ToolError: If loading fails
        """
        pass

    @abstractmethod
    def build_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars kwargs.

        Args:
            config: Frontend configuration dict

        Returns:
            Dict of kwargs suitable for Polars functions
        """
        pass

    @abstractmethod
    def to_python_code(
        self,
        var_name: str,
        config: dict[str, Any],
    ) -> list[str]:
        """
        Generate Python code for this loader.

        Args:
            var_name: Variable name to assign result to
            config: Configuration dict

        Returns:
            List of Python code lines
        """
        pass

    def _format_kwarg_value(self, key: str, value: Any) -> str | None:
        """
        Format a single kwarg value for code generation.

        Args:
            key: Parameter name
            value: Parameter value

        Returns:
            Formatted string like 'key=value' or None to skip
        """
        from app.domain.workflow.code_generator import PythonCodeGenerator

        if value is None:
            return None

        if isinstance(value, str):
            return f'{key}="{PythonCodeGenerator.escape_string(value)}"'
        elif isinstance(value, bool):
            return f"{key}={str(value)}"
        elif isinstance(value, (int, float)):
            return f"{key}={value}"
        elif isinstance(value, list) and value:
            if all(isinstance(v, str) for v in value):
                escaped = [f'"{PythonCodeGenerator.escape_string(v)}"' for v in value]
                return f"{key}=[{', '.join(escaped)}]"
            else:
                return f"{key}={value}"
        elif isinstance(value, dict):
            return f"{key}={value}"

        return None

    def _format_kwargs_for_code(self, kwargs: dict[str, Any]) -> list[str]:
        """
        Format all kwargs for code generation.

        Args:
            kwargs: Dict of kwargs

        Returns:
            List of formatted 'key=value' strings
        """
        options = []
        for key, value in kwargs.items():
            formatted = self._format_kwarg_value(key, value)
            if formatted:
                options.append(formatted)
        return options
