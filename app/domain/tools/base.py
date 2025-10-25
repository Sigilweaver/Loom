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
        self, config: dict[str, Any], inputs: dict[int, pl.LazyFrame]
    ) -> dict[int, pl.LazyFrame]:
        """
        Execute tool logic.

        Args:
            config: Tool-specific configuration from workflow JSON
            inputs: Dict of socket_id -> LazyFrame from connected tools

        Returns:
            Dict of socket_id -> LazyFrame for output sockets

        Note: Keep execution lazy! Don't call .collect() unless absolutely necessary.
        """
        pass

    @abstractmethod
    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[int, DataSchema]
    ) -> dict[int, DataSchema]:
        """
        Get output schema without executing the tool.

        Args:
            config: Tool-specific configuration
            input_schemas: Dict of socket_id -> DataSchema from input tools

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
