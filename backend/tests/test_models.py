"""Basic test for API models"""

import pytest
from app.api.models.workflow import Workflow, Tool, Wire, Socket, WireEndpoint, WorkflowMeta


def test_workflow_model():
    """Test that workflow model parses correctly"""
    workflow_data = {
        "meta": {
            "name": "Test Workflow",
            "description": "A test workflow",
            "author": "Test User",
            "workflowId": "test-123",
            "created": "2025-10-25T00:00:00Z",
        },
        "tools": [
            {
                "id": "tool-1",
                "type": "Input",
                "x": 100.0,
                "y": 100.0,
                "config": {"source": "/path/to/file.csv"},
                "sockets": [{"id": "output", "direction": "output"}],
            }
        ],
        "wires": [
            {
                "from": {"tool": "tool-1", "socket": "output"},
                "to": {"tool": "tool-2", "socket": "input"},
            }
        ],
    }

    workflow = Workflow(**workflow_data)
    assert workflow.meta.name == "Test Workflow"
    assert workflow.meta.workflow_id == "test-123"
    assert len(workflow.tools) == 1
    assert workflow.tools[0].type == "Input"
    assert len(workflow.wires) == 1


def test_socket_model():
    """Test socket model"""
    socket = Socket(id="input", direction="input", type="L", multiple=False)
    assert socket.id == "input"
    assert socket.direction == "input"
    assert socket.type == "L"


def test_wire_model():
    """Test wire model with alias"""
    wire_data = {"from": {"tool": "tool-1", "socket": "output"}, "to": {"tool": "tool-2", "socket": "input"}}

    wire = Wire(**wire_data)
    assert wire.from_.tool == "tool-1"
    assert wire.from_.socket == "output"
    assert wire.to.tool == "tool-2"
    assert wire.to.socket == "input"
