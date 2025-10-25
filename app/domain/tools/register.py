"""Register all tool implementations"""

# Import tool implementations to trigger @register_tool decorators
from app.domain.tools.implementations import InputTool, FilterTool, SelectTool

# Tools are automatically registered via @register_tool decorator
# This file just needs to be imported somewhere to trigger registration

__all__ = ["InputTool", "FilterTool", "SelectTool"]
