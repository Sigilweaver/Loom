"""Tool registry for mapping tool types to implementations"""

from typing import Callable, Type

from app.domain.models.workflow import DEFAULT_ENGINE
from app.domain.tools.base import BaseTool
from app.utils.errors import ToolError


class ToolRegistry:
    """
    Registry for tool implementations.

    Maps tool type strings (e.g., "Input", "Filter") to their implementation classes.
    Supports engine-qualified lookups: "Filter" resolves using the engine from the
    workflow, while an explicit "core/polars::Filter" lookup is also supported.
    """

    _tools: dict[str, Type[BaseTool]] = {}

    @classmethod
    def register(cls, tool_type: str, tool_class: Type[BaseTool]) -> None:
        """
        Register a tool implementation.

        The tool is stored under its simple name (e.g., "Filter") and also under
        its engine-qualified name (e.g., "core/polars::Filter").

        Args:
            tool_type: Tool type string (e.g., "Input", "Filter")
            tool_class: Tool implementation class
        """
        cls._tools[tool_type] = tool_class
        # Also register under engine-qualified key
        engine = getattr(tool_class, "engine", DEFAULT_ENGINE)
        qualified = f"{engine}::{tool_type}"
        cls._tools[qualified] = tool_class

    @classmethod
    def get(cls, tool_type: str, engine: str | None = None) -> BaseTool:
        """
        Get tool implementation instance.

        Lookup order:
        1. If engine is provided, try "{engine}::{tool_type}" first
        2. Fall back to plain "{tool_type}"

        Args:
            tool_type: Tool type string
            engine: Optional engine identifier for qualified lookup

        Returns:
            Instance of tool implementation

        Raises:
            ToolError: If tool type is not registered
        """
        if engine:
            qualified = f"{engine}::{tool_type}"
            if qualified in cls._tools:
                return cls._tools[qualified]()

        if tool_type not in cls._tools:
            msg = f"Unknown tool type: {tool_type}"
            if engine:
                msg += f" (engine: {engine})"
            raise ToolError(msg)

        return cls._tools[tool_type]()

    @classmethod
    def is_registered(cls, tool_type: str) -> bool:
        """Check if a tool type is registered"""
        return tool_type in cls._tools

    @classmethod
    def list_registered(cls, engine: str | None = None) -> list[str]:
        """Get list of all registered tool types.

        Args:
            engine: If provided, only list tools for that engine.
                    Returns unqualified names (e.g., "Filter" not "core/polars::Filter").
        """
        if engine:
            prefix = f"{engine}::"
            return [key.removeprefix(prefix) for key in cls._tools if key.startswith(prefix)]
        # Return only unqualified names
        return [key for key in cls._tools if "::" not in key]


def register_tool(tool_type: str) -> Callable[[Type[BaseTool]], Type[BaseTool]]:
    """
    Decorator for registering tool implementations.

    Usage:
        @register_tool("Input")
        class InputTool(BaseTool):
            ...
    """

    def decorator(tool_class: Type[BaseTool]) -> Type[BaseTool]:
        ToolRegistry.register(tool_type, tool_class)
        return tool_class

    return decorator
