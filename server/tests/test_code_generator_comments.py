"""Tests for comment handling in PythonCodeGenerator."""

from app.domain.models.workflow import Socket, Tool, Wire, Workflow, WorkflowMeta


def _make_workflow(tools: list[Tool], wires: list[Wire] | None = None) -> Workflow:
    """Create a minimal valid workflow for code generation testing."""
    return Workflow(
        version="1.0",
        meta=WorkflowMeta(
            name="Test",
            description="",
            author="test",
            workflowId="wf-test",
            created="2026-01-01T00:00:00Z",
        ),
        tools=tools,
        wires=wires or [],
    )


def _make_tool(
    tool_id: str = "tool-1",
    tool_type: str = "Input",
    comment: str | None = None,
) -> Tool:
    """Create a minimal tool with optional comment."""
    return Tool(
        id=tool_id,
        type=tool_type,
        x=0,
        y=0,
        comment=comment,
        config={"source": "/data/test.csv", "category": "file", "type": "csv"},
        sockets=[
            Socket(id="output", direction="output"),
        ],
    )


class TestCodeGeneratorComments:
    """Tests for comment emission in generated Python code."""

    def test_no_comment_produces_plain_header(self):
        """Tool without comment should produce '# Type: id' header only."""
        tool = _make_tool(comment=None)
        workflow = _make_workflow([tool])

        from app.domain.workflow.code_generator import PythonCodeGenerator

        code = PythonCodeGenerator(workflow).generate()

        assert "# Input: tool-1" in code
        # Should NOT have a comment separator
        assert "# Input: tool-1 --" not in code

    def test_single_line_comment(self):
        """Single-line comment appended with ' -- ' separator."""
        tool = _make_tool(comment="Load sales data")
        workflow = _make_workflow([tool])

        from app.domain.workflow.code_generator import PythonCodeGenerator

        code = PythonCodeGenerator(workflow).generate()

        assert "# Input: tool-1 -- Load sales data" in code

    def test_multiline_comment(self):
        """Multi-line comment should emit each line prefixed with #."""
        tool = _make_tool(comment="Line one\nLine two\nLine three")
        workflow = _make_workflow([tool])

        from app.domain.workflow.code_generator import PythonCodeGenerator

        code = PythonCodeGenerator(workflow).generate()

        assert "# Input: tool-1" in code
        assert "# Line one" in code
        assert "# Line two" in code
        assert "# Line three" in code

    def test_empty_string_comment_treated_as_no_comment(self):
        """Empty string comment is falsy, should not append anything."""
        tool = _make_tool(comment="")
        workflow = _make_workflow([tool])

        from app.domain.workflow.code_generator import PythonCodeGenerator

        code = PythonCodeGenerator(workflow).generate()

        assert "# Input: tool-1" in code
        assert "# Input: tool-1 --" not in code

    def test_no_unicode_em_dash_in_output(self):
        """Generated code must use ASCII only (no em dash U+2014)."""
        tool = _make_tool(comment="some note")
        workflow = _make_workflow([tool])

        from app.domain.workflow.code_generator import PythonCodeGenerator

        code = PythonCodeGenerator(workflow).generate()

        assert "\u2014" not in code, "Generated code must not contain Unicode em dash"
        assert "-- some note" in code
