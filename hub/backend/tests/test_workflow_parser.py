"""Tests for workflow parser."""

import json

import pytest

from app.domain.workflows.parser import ParseError, WorkflowParser


@pytest.fixture
def parser():
    """Create a parser instance."""
    return WorkflowParser()


@pytest.fixture
def valid_workflow_json():
    """Valid workflow JSON content."""
    return {
        "version": "2.0",
        "meta": {
            "name": "Test Workflow",
            "description": "A test workflow",
            "author": "Test Author",
            "workflowId": "d7f0101e-6151-46fa-922d-c081146a19c8",
            "created": "2025-11-28T01:27:00.041Z",
        },
        "tools": [
            {
                "id": "RLOJUUyx",
                "type": "Input",
                "x": -300,
                "y": 180,
                "config": {"category": "file", "type": "csv"},
                "sockets": [{"id": 0, "direction": "output"}],
            }
        ],
        "wires": [],
    }


@pytest.fixture
def valid_workflow_bytes(valid_workflow_json):
    """Valid workflow as bytes."""
    return json.dumps(valid_workflow_json).encode("utf-8")


class TestWorkflowParser:
    """Tests for WorkflowParser."""

    def test_parse_valid_workflow(self, parser, valid_workflow_bytes):
        """Successfully parse a valid workflow file."""
        result = parser.parse(valid_workflow_bytes)

        assert result.version == "2.0"
        assert result.meta.name == "Test Workflow"
        assert result.meta.description == "A test workflow"
        assert result.meta.author == "Test Author"
        assert result.meta.workflow_id == "d7f0101e-6151-46fa-922d-c081146a19c8"
        assert len(result.tools) == 1
        assert result.tools[0]["type"] == "Input"
        assert result.wires == []

    def test_parse_invalid_json(self, parser):
        """Reject non-JSON content."""
        with pytest.raises(ParseError, match="not valid JSON"):
            parser.parse(b"not json content")

    def test_parse_invalid_utf8(self, parser):
        """Reject non-UTF8 content."""
        with pytest.raises(ParseError, match="not valid UTF-8"):
            parser.parse(b"\xff\xfe")

    def test_parse_missing_version(self, parser, valid_workflow_json):
        """Reject workflow without version."""
        del valid_workflow_json["version"]
        content = json.dumps(valid_workflow_json).encode()

        with pytest.raises(ParseError, match="Missing required field: version"):
            parser.parse(content)

    def test_parse_missing_meta(self, parser, valid_workflow_json):
        """Reject workflow without meta."""
        del valid_workflow_json["meta"]
        content = json.dumps(valid_workflow_json).encode()

        with pytest.raises(ParseError, match="Missing required field: meta"):
            parser.parse(content)

    def test_parse_missing_tools(self, parser, valid_workflow_json):
        """Reject workflow without tools."""
        del valid_workflow_json["tools"]
        content = json.dumps(valid_workflow_json).encode()

        with pytest.raises(ParseError, match="Missing required field: tools"):
            parser.parse(content)

    def test_parse_missing_wires(self, parser, valid_workflow_json):
        """Reject workflow without wires."""
        del valid_workflow_json["wires"]
        content = json.dumps(valid_workflow_json).encode()

        with pytest.raises(ParseError, match="Missing required field: wires"):
            parser.parse(content)

    def test_parse_invalid_meta_type(self, parser, valid_workflow_json):
        """Reject workflow with non-object meta."""
        valid_workflow_json["meta"] = "not an object"
        content = json.dumps(valid_workflow_json).encode()

        with pytest.raises(ParseError, match="must be an object"):
            parser.parse(content)

    def test_parse_missing_meta_name(self, parser, valid_workflow_json):
        """Reject workflow without meta.name."""
        del valid_workflow_json["meta"]["name"]
        content = json.dumps(valid_workflow_json).encode()

        with pytest.raises(ParseError, match="Invalid meta field"):
            parser.parse(content)

    def test_parse_missing_meta_workflow_id(self, parser, valid_workflow_json):
        """Reject workflow without meta.workflowId."""
        del valid_workflow_json["meta"]["workflowId"]
        content = json.dumps(valid_workflow_json).encode()

        with pytest.raises(ParseError, match="Invalid meta field"):
            parser.parse(content)

    def test_extract_metadata(self, parser, valid_workflow_bytes):
        """Extract just metadata from workflow."""
        meta = parser.extract_metadata(valid_workflow_bytes)

        assert meta.name == "Test Workflow"
        assert meta.workflow_id == "d7f0101e-6151-46fa-922d-c081146a19c8"

    def test_parse_minimal_workflow(self, parser):
        """Parse workflow with minimal required fields."""
        minimal = {
            "version": "1.0",
            "meta": {
                "name": "Minimal",
                "workflowId": "abc123",
                "created": "2025-01-01",
            },
            "tools": [],
            "wires": [],
        }
        content = json.dumps(minimal).encode()

        result = parser.parse(content)

        assert result.meta.name == "Minimal"
        assert result.meta.description == ""
        assert result.meta.author == ""
