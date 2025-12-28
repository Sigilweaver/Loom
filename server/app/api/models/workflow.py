"""Workflow-related data models"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class WorkflowMeta(BaseModel):
    """Workflow metadata"""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str
    author: str
    workflow_id: str = Field(alias="workflowId")
    created: str


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
    x: float
    y: float
    config: dict[str, Any]
    sockets: list[Socket]


class WireEndpoint(BaseModel):
    """Wire connection endpoint"""

    tool: str
    socket: str


class Wire(BaseModel):
    """Connection between two tool sockets"""

    model_config = ConfigDict(populate_by_name=True)

    from_: WireEndpoint = Field(alias="from")
    to: WireEndpoint


class Workflow(BaseModel):
    """Complete workflow definition"""

    version: str = "1.0"
    meta: WorkflowMeta
    tools: list[Tool]
    wires: list[Wire]
