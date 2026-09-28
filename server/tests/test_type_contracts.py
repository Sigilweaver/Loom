"""
Type contract tests - validate workflow JSON schema compatibility.

These tests ensure that workflow JSON created by the frontend
can be correctly parsed by the backend's Pydantic models.

If these tests fail, it indicates a schema drift between
frontend TypeScript types and backend Pydantic models.
"""

from app.domain.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta


class TestMinimalWorkflowContract:
    """Test the minimal valid workflow structure."""

    def test_minimal_workflow_parses(self):
        """Minimal workflow with no tools or wires must parse."""
        minimal = {
            "version": "1.0",
            "meta": {
                "name": "Test",
                "description": "Test workflow",
                "author": "Test",
                "workflowId": "test-123",
                "created": "2025-01-01T00:00:00Z",
            },
            "tools": [],
            "wires": [],
        }

        workflow = Workflow(**minimal)
        assert workflow.meta.workflow_id == "test-123"
        assert workflow.meta.name == "Test"
        assert len(workflow.tools) == 0
        assert len(workflow.wires) == 0

    def test_meta_field_aliasing(self):
        """workflowId in JSON maps to workflow_id in Pydantic."""
        meta_data = {
            "name": "Test",
            "description": "Test",
            "author": "Test",
            "workflowId": "camelCase-id",
            "created": "2025-01-01T00:00:00Z",
        }

        meta = WorkflowMeta(**meta_data)
        assert meta.workflow_id == "camelCase-id"


class TestToolSocketContract:
    """Test that tools with sockets parse correctly."""

    def test_input_tool_with_output_socket(self):
        """Input tool has single output socket."""
        tool_data = {
            "id": "input-1",
            "type": "Input",
            "x": 0,
            "y": 0,
            "config": {"category": "file", "type": "csv", "source": "/path/to/file.csv"},
            "sockets": [{"id": "output", "direction": "output"}],
        }

        tool = Tool(**tool_data)
        assert tool.id == "input-1"
        assert tool.type == "Input"
        assert len(tool.sockets) == 1
        assert tool.sockets[0].id == "output"
        assert tool.sockets[0].direction == "output"

    def test_filter_tool_with_typed_sockets(self):
        """Filter tool has typed output sockets (T/F)."""
        tool_data = {
            "id": "filter-1",
            "type": "Filter",
            "x": 200,
            "y": 0,
            "config": {"expression": "pl.col('a') > 1"},
            "sockets": [
                {"id": "input", "direction": "input"},
                {"id": "output-true", "direction": "output", "type": "T"},
                {"id": "output-false", "direction": "output", "type": "F"},
            ],
        }

        tool = Tool(**tool_data)
        assert len(tool.sockets) == 3
        assert tool.sockets[1].id == "output-true"
        assert tool.sockets[1].type == "T"
        assert tool.sockets[2].id == "output-false"
        assert tool.sockets[2].type == "F"

    def test_join_tool_with_multi_sockets(self):
        """Join tool has left/right input and three outputs."""
        tool_data = {
            "id": "join-1",
            "type": "Join",
            "x": 400,
            "y": 0,
            "config": {"joinType": "inner", "leftKeys": ["id"], "rightKeys": ["id"]},
            "sockets": [
                {"id": "input-left", "direction": "input", "type": "L"},
                {"id": "input-right", "direction": "input", "type": "R"},
                {"id": "output-left", "direction": "output", "type": "L"},
                {"id": "output-match", "direction": "output", "type": "J"},
                {"id": "output-right", "direction": "output", "type": "R"},
            ],
        }

        tool = Tool(**tool_data)
        assert len(tool.sockets) == 5
        input_sockets = [s for s in tool.sockets if s.direction == "input"]
        output_sockets = [s for s in tool.sockets if s.direction == "output"]
        assert len(input_sockets) == 2
        assert len(output_sockets) == 3

    def test_union_tool_with_multiple_input(self):
        """Union tool has multiple=True on input socket."""
        tool_data = {
            "id": "union-1",
            "type": "Union",
            "x": 200,
            "y": 0,
            "config": {"mode": "ByName"},
            "sockets": [
                {"id": "input", "direction": "input", "multiple": True},
                {"id": "output", "direction": "output"},
            ],
        }

        tool = Tool(**tool_data)
        assert tool.sockets[0].multiple is True
        assert tool.sockets[1].multiple is None

    def test_socket_type_is_optional(self):
        """Socket type field is optional."""
        socket_data = {"id": "output", "direction": "output"}
        socket = Socket(**socket_data)
        assert socket.type is None

    def test_socket_multiple_is_optional(self):
        """Socket multiple field is optional."""
        socket_data = {"id": "input", "direction": "input"}
        socket = Socket(**socket_data)
        assert socket.multiple is None


class TestWireContract:
    """Test wire serialization format."""

    def test_wire_uses_from_alias(self):
        """Wire 'from' field in JSON maps to 'from_' in Pydantic."""
        wire_data = {
            "from": {"tool": "input-1", "socket": "output"},
            "to": {"tool": "filter-1", "socket": "input"},
        }

        wire = Wire(**wire_data)
        assert wire.from_.tool == "input-1"
        assert wire.from_.socket == "output"
        assert wire.to.tool == "filter-1"
        assert wire.to.socket == "input"

    def test_wire_endpoint_structure(self):
        """Wire endpoints have tool and socket fields."""
        endpoint_data = {"tool": "tool-123", "socket": "output-true"}
        endpoint = WireEndpoint(**endpoint_data)
        assert endpoint.tool == "tool-123"
        assert endpoint.socket == "output-true"


class TestCompleteWorkflowContract:
    """Test complete workflow structures."""

    def test_linear_workflow(self):
        """Input -> Filter -> Output workflow parses correctly."""
        workflow_data = {
            "version": "1.0",
            "meta": {
                "name": "Linear Test",
                "description": "Test linear workflow",
                "author": "Test",
                "workflowId": "linear-123",
                "created": "2025-01-01T00:00:00Z",
            },
            "tools": [
                {
                    "id": "input-1",
                    "type": "Input",
                    "x": 0,
                    "y": 0,
                    "config": {"category": "file", "type": "csv"},
                    "sockets": [{"id": "output", "direction": "output"}],
                },
                {
                    "id": "filter-1",
                    "type": "Filter",
                    "x": 200,
                    "y": 0,
                    "config": {"expression": "pl.col('a') > 1"},
                    "sockets": [
                        {"id": "input", "direction": "input"},
                        {"id": "output-true", "direction": "output", "type": "T"},
                        {"id": "output-false", "direction": "output", "type": "F"},
                    ],
                },
                {
                    "id": "output-1",
                    "type": "Output",
                    "x": 400,
                    "y": 0,
                    "config": {"type": "csv", "destination": "/path/to/output.csv"},
                    "sockets": [{"id": "input", "direction": "input"}],
                },
            ],
            "wires": [
                {
                    "from": {"tool": "input-1", "socket": "output"},
                    "to": {"tool": "filter-1", "socket": "input"},
                },
                {
                    "from": {"tool": "filter-1", "socket": "output-true"},
                    "to": {"tool": "output-1", "socket": "input"},
                },
            ],
        }

        workflow = Workflow(**workflow_data)
        assert len(workflow.tools) == 3
        assert len(workflow.wires) == 2
        assert workflow.tools[0].type == "Input"
        assert workflow.tools[1].type == "Filter"
        assert workflow.tools[2].type == "Output"

    def test_join_workflow(self):
        """Workflow with Join tool parses correctly."""
        workflow_data = {
            "version": "1.0",
            "meta": {
                "name": "Join Test",
                "description": "Test join workflow",
                "author": "Test",
                "workflowId": "join-123",
                "created": "2025-01-01T00:00:00Z",
            },
            "tools": [
                {
                    "id": "input-left",
                    "type": "Input",
                    "x": 0,
                    "y": 0,
                    "config": {"category": "file", "type": "csv"},
                    "sockets": [{"id": "output", "direction": "output"}],
                },
                {
                    "id": "input-right",
                    "type": "Input",
                    "x": 0,
                    "y": 200,
                    "config": {"category": "file", "type": "csv"},
                    "sockets": [{"id": "output", "direction": "output"}],
                },
                {
                    "id": "join-1",
                    "type": "Join",
                    "x": 200,
                    "y": 100,
                    "config": {
                        "joinType": "inner",
                        "leftKeys": ["id"],
                        "rightKeys": ["id"],
                    },
                    "sockets": [
                        {"id": "input-left", "direction": "input", "type": "L"},
                        {"id": "input-right", "direction": "input", "type": "R"},
                        {"id": "output-left", "direction": "output", "type": "L"},
                        {"id": "output-match", "direction": "output", "type": "J"},
                        {"id": "output-right", "direction": "output", "type": "R"},
                    ],
                },
            ],
            "wires": [
                {
                    "from": {"tool": "input-left", "socket": "output"},
                    "to": {"tool": "join-1", "socket": "input-left"},
                },
                {
                    "from": {"tool": "input-right", "socket": "output"},
                    "to": {"tool": "join-1", "socket": "input-right"},
                },
            ],
        }

        workflow = Workflow(**workflow_data)
        assert len(workflow.tools) == 3
        assert len(workflow.wires) == 2
        join_tool = workflow.tools[2]
        assert join_tool.type == "Join"
        assert join_tool.config.get("joinType") == "inner"


class TestSocketIdConstants:
    """Verify socket IDs match expected constants."""

    def test_common_socket_ids(self):
        """Common sockets use 'input' and 'output'."""
        from app.domain.tools.sockets import CommonSockets

        assert CommonSockets.INPUT == "input"
        assert CommonSockets.OUTPUT == "output"

    def test_filter_socket_ids(self):
        """Filter sockets use correct IDs."""
        from app.domain.tools.sockets import FilterSockets

        assert FilterSockets.INPUT == "input"
        assert FilterSockets.OUTPUT_TRUE == "output-true"
        assert FilterSockets.OUTPUT_FALSE == "output-false"

    def test_join_socket_ids(self):
        """Join sockets use correct IDs."""
        from app.domain.tools.sockets import JoinSockets

        assert JoinSockets.INPUT_LEFT == "input-left"
        assert JoinSockets.INPUT_RIGHT == "input-right"
        assert JoinSockets.OUTPUT_LEFT == "output-left"
        assert JoinSockets.OUTPUT_MATCH == "output-match"
        assert JoinSockets.OUTPUT_RIGHT == "output-right"

    def test_union_socket_ids(self):
        """Union sockets use correct IDs."""
        from app.domain.tools.sockets import UnionSockets

        assert UnionSockets.INPUT == "input"
        assert UnionSockets.OUTPUT == "output"
