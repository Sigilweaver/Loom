"""Tests for ExecutionPlanner"""

import pytest

from app.domain.execution.planner import ExecutionPlan, ExecutionPlanner
from app.domain.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta
from app.utils.errors import ValidationError


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

    def test_without_tool(self):
        """without_tool drops a tool from the run order but keeps input mappings."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C"),
            tool_inputs={"C": {"input": [("B", "output")]}},
            tool_map={},
            dependencies={"B": ["A"], "C": ["B"]},
        )

        trimmed = plan.without_tool("C")

        assert list(trimmed) == ["A", "B"]
        assert trimmed.get_inputs("C") == {"input": [("B", "output")]}
        assert list(plan) == ["A", "B", "C"]  # original untouched

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
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="C", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="B", socket="output"),
                    to=WireEndpoint(tool="D", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="C", socket="output"),
                    to=WireEndpoint(tool="D", socket="input"),
                ),
            ],
        )

        planner = ExecutionPlanner(workflow)
        plan = planner.create_plan()

        order = list(plan)
        assert order[0] == "A"
        assert order[-1] == "D"
        assert set(order) == {"A", "B", "C", "D"}

    def test_target_not_in_workflow(self):
        """An unknown target is a client error, not a silent full-workflow run."""
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
        with pytest.raises(ValidationError, match="NONEXISTENT"):
            planner.create_plan(target_tool_id="NONEXISTENT")

    def test_partial_plan_excludes_unrelated_branches(self):
        """Regression for #84: a target's plan holds only its ancestors."""
        # A -> B -> D
        # C -> E          (independent branch, listed between the others)
        # A -> F          (sibling branch off A)
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[make_tool(t, "Filter") for t in ["A", "C", "B", "E", "F", "D"]],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="B", socket="output"),
                    to=WireEndpoint(tool="D", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="C", socket="output"),
                    to=WireEndpoint(tool="E", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="F", socket="input"),
                ),
            ],
        )

        plan = ExecutionPlanner(workflow).create_plan(target_tool_id="D")

        assert list(plan) == ["A", "B", "D"]
        assert set(plan.tool_inputs) == {"A", "B", "D"}

    def test_partial_plan_includes_all_transitive_ancestors(self):
        """Diamond shape: both parents and the root are planned, nothing else."""
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[make_tool(t, "Filter") for t in ["A", "B", "C", "D", "X"]],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="C", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="B", socket="output"),
                    to=WireEndpoint(tool="D", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="C", socket="output"),
                    to=WireEndpoint(tool="D", socket="input"),
                ),
            ],
        )

        plan = ExecutionPlanner(workflow).create_plan(target_tool_id="D")

        assert plan.execution_order[0] == "A"
        assert plan.execution_order[-1] == "D"
        assert set(plan) == {"A", "B", "C", "D"}

    def test_partial_plan_for_root_tool_is_just_that_tool(self):
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[make_tool(t, "Filter") for t in ["A", "B"]],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
            ],
        )

        plan = ExecutionPlanner(workflow).create_plan(target_tool_id="A")

        assert list(plan) == ["A"]


class TestExecutionLevels:
    """Tests for parallel execution level computation."""

    def test_linear_workflow_single_level_per_tool(self):
        """Test A -> B -> C has 3 levels."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C"),
            tool_inputs={},
            tool_map={},
            dependencies={"A": [], "B": ["A"], "C": ["B"]},
        )

        levels = plan.get_execution_levels()

        assert levels == [["A"], ["B"], ["C"]]

    def test_parallel_branches_same_level(self):
        """Test A -> B, A -> C has B and C at same level."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C"),
            tool_inputs={},
            tool_map={},
            dependencies={"A": [], "B": ["A"], "C": ["A"]},
        )

        levels = plan.get_execution_levels()

        assert levels[0] == ["A"]
        assert set(levels[1]) == {"B", "C"}
        assert len(levels) == 2

    def test_diamond_pattern_levels(self):
        """Test A -> B -> D, A -> C -> D has correct levels."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C", "D"),
            tool_inputs={},
            tool_map={},
            dependencies={"A": [], "B": ["A"], "C": ["A"], "D": ["B", "C"]},
        )

        levels = plan.get_execution_levels()

        assert levels[0] == ["A"]
        assert set(levels[1]) == {"B", "C"}
        assert levels[2] == ["D"]

    def test_complex_dag_levels(self):
        """Test complex DAG with multiple independent branches."""
        # A -> B -> E
        # A -> C -> E
        # D -> E (D is independent of A)
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "D", "B", "C", "E"),
            tool_inputs={},
            tool_map={},
            dependencies={
                "A": [],
                "D": [],
                "B": ["A"],
                "C": ["A"],
                "E": ["B", "C", "D"],
            },
        )

        levels = plan.get_execution_levels()

        # Level 0: A, D (no dependencies)
        assert set(levels[0]) == {"A", "D"}
        # Level 1: B, C (depend on A)
        assert set(levels[1]) == {"B", "C"}
        # Level 2: E (depends on B, C, D)
        assert levels[2] == ["E"]

    def test_empty_plan_no_levels(self):
        """Test empty plan returns empty levels."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=(),
            tool_inputs={},
            tool_map={},
            dependencies={},
        )

        levels = plan.get_execution_levels()

        assert levels == []

    def test_single_tool_one_level(self):
        """Test single tool has one level."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A",),
            tool_inputs={},
            tool_map={},
            dependencies={"A": []},
        )

        levels = plan.get_execution_levels()

        assert levels == [["A"]]


class TestReadyTools:
    """Tests for dynamic ready tool computation."""

    def test_initial_state_roots_ready(self):
        """Test roots are ready with no completions."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C"),
            tool_inputs={},
            tool_map={},
            dependencies={"A": [], "B": ["A"], "C": ["B"]},
        )

        ready = plan.get_ready_tools(completed=set())

        assert ready == ["A"]

    def test_dependencies_satisfied(self):
        """Test tool becomes ready when dependencies complete."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C"),
            tool_inputs={},
            tool_map={},
            dependencies={"A": [], "B": ["A"], "C": ["B"]},
        )

        ready = plan.get_ready_tools(completed={"A"})

        assert ready == ["B"]

    def test_multiple_ready(self):
        """Test multiple tools can be ready at once."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C"),
            tool_inputs={},
            tool_map={},
            dependencies={"A": [], "B": ["A"], "C": ["A"]},
        )

        ready = plan.get_ready_tools(completed={"A"})

        assert set(ready) == {"B", "C"}

    def test_partial_dependencies(self):
        """Test tool not ready if only some deps complete."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C", "D"),
            tool_inputs={},
            tool_map={},
            dependencies={"A": [], "B": [], "C": [], "D": ["A", "B", "C"]},
        )

        # Only A and B complete, D still needs C
        ready = plan.get_ready_tools(completed={"A", "B"})

        assert "D" not in ready
        assert "C" in ready

    def test_all_complete_none_ready(self):
        """Test nothing ready when all tools complete."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B"),
            tool_inputs={},
            tool_map={},
            dependencies={"A": [], "B": ["A"]},
        )

        ready = plan.get_ready_tools(completed={"A", "B"})

        assert ready == []

    def test_independent_roots_both_ready(self):
        """Test independent root nodes are all ready."""
        plan = ExecutionPlan(
            workflow_id="test",
            execution_order=("A", "B", "C"),
            tool_inputs={},
            tool_map={},
            dependencies={"A": [], "B": [], "C": ["A", "B"]},
        )

        ready = plan.get_ready_tools(completed=set())

        assert set(ready) == {"A", "B"}
