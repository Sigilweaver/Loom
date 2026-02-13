"""Workflow-related data models"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# Default engine identifier for all tools that don't specify one
DEFAULT_ENGINE = "sigilweaver/polars"


class WorkflowMeta(BaseModel):
    """Workflow metadata"""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str
    author: str
    workflow_id: str = Field(alias="workflowId")
    created: str
    default_engine: str = Field(default=DEFAULT_ENGINE, alias="defaultEngine")


class Socket(BaseModel):
    """Tool socket (connection point)"""

    id: str
    direction: Literal["input", "output"]
    type: str | None = None
    multiple: bool | None = None


class Tool(BaseModel):
    """Tool definition in a workflow"""

    id: str
    type: str
    engine: str | None = None
    x: float
    y: float
    config: dict[str, Any]
    sockets: list[Socket]

    def get_engine(self, default: str = DEFAULT_ENGINE) -> str:
        """Resolve engine: tool-level override > workflow default > global default"""
        return self.engine or default


class WireEndpoint(BaseModel):
    """Wire connection endpoint"""

    tool: str
    socket: str


class Wire(BaseModel):
    """Connection between two tool sockets"""

    model_config = ConfigDict(populate_by_name=True)

    from_: WireEndpoint = Field(alias="from")
    to: WireEndpoint


class EngineConfig(BaseModel):
    """Engine-specific configuration block.

    Holds connection details, project paths, or other config
    that is specific to an execution engine (e.g. dbt project path,
    Spark cluster URL). The schema is intentionally open (dict)
    since each engine defines its own config shape.
    """

    model_config = ConfigDict(extra="allow")


class Workflow(BaseModel):
    """Complete workflow definition"""

    version: str = "1.0"
    meta: WorkflowMeta
    tools: list[Tool]
    wires: list[Wire]
    engines: dict[str, EngineConfig] | None = None

    def get_engine_for_tool(self, tool: Tool) -> str:
        """Resolve the engine for a tool using the precedence chain:
        tool.engine > meta.defaultEngine > DEFAULT_ENGINE"""
        return tool.get_engine(self.meta.default_engine)
