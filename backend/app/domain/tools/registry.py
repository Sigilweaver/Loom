"""Tool registry for mapping tool types to implementations"""

from typing import Callable, Type

from app.domain.tools.base import BaseTool
from app.utils.errors import ToolError


class ToolRegistry:
    """
    Registry for tool implementations.

    Maps tool type strings (e.g., "Input", "Filter") to their implementation classes.
    """

    _tools: dict[str, Type[BaseTool]] = {}

    @classmethod
    def register(cls, tool_type: str, tool_class: Type[BaseTool]) -> None:
        """
        Register a tool implementation.

        Args:
            tool_type: Tool type string (e.g., "Input", "Filter")
            tool_class: Tool implementation class
        """
        cls._tools[tool_type] = tool_class

    @classmethod
    def get(cls, tool_type: str) -> BaseTool:
        """
        Get tool implementation instance.

        Args:
            tool_type: Tool type string

        Returns:
            Instance of tool implementation

        Raises:
            ToolError: If tool type is not registered
        """
        if tool_type not in cls._tools:
            raise ToolError(f"Unknown tool type: {tool_type}")

        return cls._tools[tool_type]()

    @classmethod
    def is_registered(cls, tool_type: str) -> bool:
        """Check if a tool type is registered"""
        return tool_type in cls._tools

    @classmethod
    def list_registered(cls) -> list[str]:
        """Get list of all registered tool types"""
        return list(cls._tools.keys())


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
