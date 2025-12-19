"""Tests for ExecutionPlanner"""

import pytest

from app.api.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta
from app.domain.execution.planner import ExecutionPlan, ExecutionPlanner


def make_workflow_meta() -> WorkflowMeta:
    """Create a default workflow metadata for tests."""
    return WorkflowMeta(
        name="Test",
        description="Test",
        author="Test",
        workflowId="test-123",
        created="2025-01-01",
    )


def make_tool(tool_id: str, tool_type: str, config: dict | None = None) -> Tool:
    """Create a tool with standard input/output sockets."""
    return Tool(
        id=tool_id,
        type=tool_type,
        x=0,
        y=0,
        config=config or {},
        sockets=[
            Socket(id="input", direction="input"),
            Socket(id="output", direction="output"),
        ],
    )



class TestExecutionPlan:
    """Tests for ExecutionPlan dataclass."""

    def test_iteration(self):
        """Test that ExecutionPlan is iterable."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C"),
            tool_inputs={},
            tool_map={},
            dependencies={},
        )

        assert list(plan) == ["A", "B", "C"]

    def test_len(self):
        """Test that len() works on ExecutionPlan."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C"),
            tool_inputs={},
            tool_map={},
            dependencies={},
        )

        assert len(plan) == 3

    def test_get_tool(self):
        """Test get_tool returns the correct tool."""
        tool_a = Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[])
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A",),
            tool_inputs={},
            tool_map={"A": tool_a},
            dependencies={},
        )

        assert plan.get_tool("A") == tool_a

    def test_get_inputs(self):
        """Test get_inputs returns correct mappings."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B"),
            tool_inputs={"B": {"input": [("A", "output")]}},
            tool_map={},
            dependencies={},
        )

        assert plan.get_inputs("B") == {"input": [("A", "output")]}
        assert plan.get_inputs("A") == {}

    def test_get_dependencies(self):
        """Test get_dependencies returns correct list."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B"),
            tool_inputs={},
            tool_map={},
            dependencies={"B": ["A"], "A": []},
        )

        assert plan.get_dependencies("B") == ["A"]
        assert plan.get_dependencies("A") == []

    def test_get_execution_order_up_to(self):
        """Test get_execution_order_up_to returns correct subset."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C", "D"),
            tool_inputs={},
            tool_map={},
            dependencies={},
        )

        assert plan.get_execution_order_up_to("B") == ["A", "B"]
        assert plan.get_execution_order_up_to("D") == ["A", "B", "C", "D"]
        assert plan.get_execution_order_up_to("A") == ["A"]

    def test_is_immutable(self):
        """Test that ExecutionPlan is frozen (immutable)."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B"),
            tool_inputs={},
            tool_map={},
            dependencies={},
        )

        with pytest.raises(AttributeError):
            plan.workflow_id = "changed"


class TestExecutionPlanner:
    """Tests for ExecutionPlanner class."""

    def test_create_plan_linear_workflow(self):
        """Test plan creation for A -> B -> C."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
                Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
                Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
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
            ],
        )

        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan()

        assert list(plan) == ["A", "B", "C"]
        assert plan.workflow_id == "test-123"

    def test_create_plan_with_target(self):
        """Test partial plan creation."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
                Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
                Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
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
            ],
        )

        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan(target_tool_id="B")

        assert list(plan) == ["A", "B"]

    def test_create_plan_includes_tool_map(self):
        """Test that plan includes tool map."""
        tool_a = Tool(id="A", type="Input", x=0, y=0, config={"path": "/data.csv"}, sockets=[])
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[tool_a],
            wires=[],
        )

        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan()

        assert plan.get_tool("A").type == "Input"
        assert plan.get_tool("A").config == {"path": "/data.csv"}

    def test_create_plan_includes_inputs(self):
        """Test that plan includes input mappings."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
                Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            ],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
            ],
        )

        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan()

        inputs_b = plan.get_inputs("B")
        assert inputs_b == {"input": [("A", "output")]}

    def test_create_plan_includes_dependencies(self):
        """Test that plan includes dependencies."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
                Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            ],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
            ],
        )

        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan()

        assert plan.get_dependencies("B") == ["A"]
        assert plan.get_dependencies("A") == []

    def test_validate_returns_errors(self):
        """Test that validate catches invalid workflows."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
            ],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="MISSING", socket="output"),
                    to=WireEndpoint(tool="A", socket="input"),
                ),
            ],
        )

        planner = ExecutionPlanner(workflow)
        errors = planner.validate()

        assert len(errors) > 0
        assert any("MISSING" in error for error in errors)

    def test_validate_returns_empty_for_valid(self):
        """Test that validate returns empty list for valid workflow."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                make_tool("A", "Input"),
                make_tool("B", "Filter"),
            ],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
            ],
        )

        planner = ExecutionPlanner(workflow)
        errors = planner.validate()

        assert errors == []

    def test_graph_property(self):
        """Test that graph property exposes ExecutionGraph."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[])],
            wires=[],
        )

        planner = ExecutionPlanner(workflow)
        graph = planner.graph

        assert graph is not None
        assert graph.execution_order() == ["A"]

    def test_empty_workflow(self):
        """Test planner handles empty workflow."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[],
            wires=[],
        )

        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan()

        assert list(plan) == []
        assert len(plan) == 0

    def test_diamond_pattern(self):
        """Test plan creation for diamond pattern: A -> B -> D, A -> C -> D."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
                Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
                Tool(id="C", type="Select", x=0, y=0, config={}, sockets=[]),
                Tool(id="D", type="Union", x=0, y=0, config={}, sockets=[]),
            ],
            wires=[
                Wire(from_=WireEndpoint(tool="A", socket="output"), to=WireEndpoint(tool="B", socket="input")),
                Wire(from_=WireEndpoint(tool="A", socket="output"), to=WireEndpoint(tool="C", socket="input")),
                Wire(from_=WireEndpoint(tool="B", socket="output"), to=WireEndpoint(tool="D", socket="input")),
                Wire(from_=WireEndpoint(tool="C", socket="output"), to=WireEndpoint(tool="D", socket="input")),
            ],
        )

        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan()

        order = list(plan)
        assert order[0] == "A"
        assert order[-1] == "D"
        assert set(order) == {"A", "B", "C", "D"}

    def test_target_not_in_workflow(self):
        """Test that invalid target falls back to full order."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                Tool(id="A", type="Input", x=0, y=0, config={}, sockets=[]),
                Tool(id="B", type="Filter", x=0, y=0, config={}, sockets=[]),
            ],
            wires=[
                Wire(from_=WireEndpoint(tool="A", socket="output"), to=WireEndpoint(tool="B", socket="input")),
            ],
        )

        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan(target_tool_id="NONEXISTENT")

        # Should return full order when target not found
        assert list(plan) == ["A", "B"]
