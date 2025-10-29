"""Tests for execution graph builder and topological sort"""

import pytest
from app.domain.execution.graph import ExecutionGraph
from app.api.models.workflow import Workflow, Tool, Wire, WireEndpoint, Socket, WorkflowMeta
from app.utils.errors import ValidationError


def test_simple_linear_workflow():
    """Test execution order for simple linear workflow: A -> B -> C"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2024-01-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="A", socket=0), to=WireEndpoint(tool="B", socket=0)),
            Wire(from_=WireEndpoint(tool="B", socket=1), to=WireEndpoint(tool="C", socket=0)),
        ],
    )

    graph = ExecutionGraph(workflow)
    order = graph.execution_order()

    assert order == ["A", "B", "C"]


def test_parallel_branches():
    """Test execution order with parallel branches: A -> B and A -> C"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2024-01-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="A", socket=0), to=WireEndpoint(tool="B", socket=0)),
            Wire(from_=WireEndpoint(tool="A", socket=0), to=WireEndpoint(tool="C", socket=0)),
        ],
    )

    graph = ExecutionGraph(workflow)
    order = graph.execution_order()

    # A must come first, B and C can be in any order
    assert order[0] == "A"
    assert set(order[1:]) == {"B", "C"}


def test_diamond_pattern():
    """Test diamond pattern: A -> B -> D, A -> C -> D"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2024-01-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
            Tool(id="D", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="A", socket=0), to=WireEndpoint(tool="B", socket=0)),
            Wire(from_=WireEndpoint(tool="A", socket=0), to=WireEndpoint(tool="C", socket=0)),
            Wire(from_=WireEndpoint(tool="B", socket=1), to=WireEndpoint(tool="D", socket=0)),
            Wire(from_=WireEndpoint(tool="C", socket=0), to=WireEndpoint(tool="D", socket=1)),
        ],
    )

    graph = ExecutionGraph(workflow)
    order = graph.execution_order()

    # A must come first, D must come last
    assert order[0] == "A"
    assert order[-1] == "D"
    # B and C must come after A and before D
    assert "B" in order[1:-1]
    assert "C" in order[1:-1]


def test_cycle_detection():
    """Test that cycles are detected: A -> B -> C -> A"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2024-01-01",
        ),
        tools=[
            Tool(id="A", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="A", socket=1), to=WireEndpoint(tool="B", socket=0)),
            Wire(from_=WireEndpoint(tool="B", socket=1), to=WireEndpoint(tool="C", socket=0)),
            Wire(from_=WireEndpoint(tool="C", socket=1), to=WireEndpoint(tool="A", socket=0)),
        ],
    )

    graph = ExecutionGraph(workflow)
    with pytest.raises(ValidationError, match="cycle"):
        graph.execution_order()


def test_get_tool_inputs():
    """Test mapping socket connections to source tools"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2024-01-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="A", socket=0), to=WireEndpoint(tool="C", socket=0)),
            Wire(from_=WireEndpoint(tool="B", socket=0), to=WireEndpoint(tool="C", socket=1)),
        ],
    )

    graph = ExecutionGraph(workflow)
    inputs = graph.get_tool_inputs("C")

    assert inputs == {
        0: [("A", 0)],
        1: [("B", 0)],
    }


def test_multi_input_socket():
    """Test multiple wires connecting to the same input socket (Union tool)"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2024-01-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="A", socket=0), to=WireEndpoint(tool="C", socket=0)),
            Wire(from_=WireEndpoint(tool="B", socket=0), to=WireEndpoint(tool="C", socket=0)),  # Same socket!
        ],
    )

    graph = ExecutionGraph(workflow)
    inputs = graph.get_tool_inputs("C")

    # Should have 2 sources for socket 0
    assert len(inputs[0]) == 2
    assert ("A", 0) in inputs[0]
    assert ("B", 0) in inputs[0]


def test_validate_missing_tool_reference():
    """Test validation catches invalid tool ID in wire"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2024-01-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="MISSING", socket=0), to=WireEndpoint(tool="B", socket=0)),  # Invalid!
        ],
    )

    graph = ExecutionGraph(workflow)
    errors = graph.validate()
    
    # Should have error about unknown source tool
    assert len(errors) > 0
    assert any("MISSING" in error for error in errors)


def test_isolated_tool():
    """Test that tools with no connections are still included"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2024-01-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="A", socket=0), to=WireEndpoint(tool="C", socket=0)),
            # B is isolated - no connections
        ],
    )

    graph = ExecutionGraph(workflow)
    order = graph.execution_order()

    # All three tools should be in the order
    assert len(order) == 3
    assert set(order) == {"A", "B", "C"}


def test_empty_workflow():
    """Test empty workflow"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2024-01-01",
        ),
        tools=[],
        wires=[],
    )
    graph = ExecutionGraph(workflow)
    order = graph.execution_order()
    assert order == []
