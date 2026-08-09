"""Tests for execution graph builder and topological sort"""

import pytest

from app.api.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta
from app.domain.execution.graph import ExecutionGraph
from app.utils.errors import ValidationError


def test_simple_linear_workflow():
    """Test execution order for simple linear workflow: A -> B -> C"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2025-08-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="A", socket="input"),
                to=WireEndpoint(tool="B", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="B", socket="output"),
                to=WireEndpoint(tool="C", socket="input"),
            ),
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
            created="2025-08-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="A", socket="input"),
                to=WireEndpoint(tool="B", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="A", socket="input"),
                to=WireEndpoint(tool="C", socket="input"),
            ),
        ],
    )

    graph = ExecutionGraph(workflow)
    order = graph.execution_order()

    # A must come first, B and C can be in any order
    assert order[0] == "A"
    assert set(order[1:]) == {"B", "C"}


def test_parallel_branches_preserve_tool_order():
    """Dependents becoming ready together retain workflow tool order."""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2025-08-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="A", socket="output"),
                to=WireEndpoint(tool="C", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="A", socket="output"),
                to=WireEndpoint(tool="B", socket="input"),
            ),
        ],
    )

    assert ExecutionGraph(workflow).execution_order() == ["A", "B", "C"]


def test_diamond_pattern():
    """Test diamond pattern: A -> B -> D, A -> C -> D"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2025-08-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
            Tool(id="D", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="A", socket="input"),
                to=WireEndpoint(tool="B", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="A", socket="input"),
                to=WireEndpoint(tool="C", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="B", socket="output"),
                to=WireEndpoint(tool="D", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="C", socket="input"),
                to=WireEndpoint(tool="D", socket="output"),
            ),
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
            created="2025-08-01",
        ),
        tools=[
            Tool(id="A", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="A", socket="output"),
                to=WireEndpoint(tool="B", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="B", socket="output"),
                to=WireEndpoint(tool="C", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="C", socket="output"),
                to=WireEndpoint(tool="A", socket="input"),
            ),
        ],
    )

    graph = ExecutionGraph(workflow)
    with pytest.raises(
        ValidationError,
        match=r"^Workflow contains a cycle\. Cannot determine execution order\.$",
    ):
        graph.execution_order()


def test_validate_preserves_wire_error_messages():
    """Validation reports socket errors with the established wording and order."""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2025-08-01",
        ),
        tools=[
            Tool(
                id="A",
                type="Input",
                x=0,
                y=0,
                config={},
                sockets=[Socket(id="input", direction="input")],
            ),
            Tool(
                id="B",
                type="Filter",
                x=0,
                y=0,
                config={},
                sockets=[Socket(id="output", direction="output")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="A", socket="input"),
                to=WireEndpoint(tool="B", socket="missing"),
            ),
        ],
    )

    assert ExecutionGraph(workflow).validate() == [
        "Wire source socket input on tool A is not an output socket",
        "Wire references unknown socket missing on tool B",
    ]


def test_get_tool_inputs():
    """Test mapping socket connections to source tools"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2025-08-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="A", socket="input"),
                to=WireEndpoint(tool="C", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="B", socket="input"),
                to=WireEndpoint(tool="C", socket="output"),
            ),
        ],
    )

    graph = ExecutionGraph(workflow)
    inputs = graph.get_tool_inputs("C")

    assert inputs == {
        "input": [("A", "input")],
        "output": [("B", "input")],
    }


def test_multi_input_socket():
    """Test multiple wires connecting to the same input socket (Union tool)"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2025-08-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="A", socket="input"),
                to=WireEndpoint(tool="C", socket="input"),
            ),
            # Same socket!
            Wire(
                from_=WireEndpoint(tool="B", socket="input"),
                to=WireEndpoint(tool="C", socket="input"),
            ),
        ],
    )

    graph = ExecutionGraph(workflow)
    inputs = graph.get_tool_inputs("C")

    # Should have 2 sources for socket "input"
    assert len(inputs["input"]) == 2
    assert ("A", "input") in inputs["input"]
    assert ("B", "input") in inputs["input"]


def test_validate_missing_tool_reference():
    """Test validation catches invalid tool ID in wire"""
    workflow = Workflow(
        meta=WorkflowMeta(
            name="Test",
            description="Test",
            author="Test",
            workflowId="test",
            created="2025-08-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            # Invalid!
            Wire(
                from_=WireEndpoint(tool="MISSING", socket="input"),
                to=WireEndpoint(tool="B", socket="input"),
            ),
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
            created="2025-08-01",
        ),
        tools=[
            Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="B", type="Input", x=0, y=0, config={}, sockets=[]),
            Tool(id="C", type="Filter", x=0, y=0, config={}, sockets=[]),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="A", socket="input"),
                to=WireEndpoint(tool="C", socket="input"),
            ),
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
            created="2025-08-01",
        ),
        tools=[],
        wires=[],
    )
    graph = ExecutionGraph(workflow)
    order = graph.execution_order()
    assert order == []
