"""Integration tests: every registered tool exposes a typed config schema."""

import pytest
from fastapi.testclient import TestClient

# Importing implementations ensures @register_tool side effects run.
import app.domain.tools.implementations  # noqa: F401
from app.domain.tools.registry import ToolRegistry
from app.main import app as fastapi_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def _registered_tool_types() -> list[str]:
    """Return canonical tool types (skip namespaced aliases like core/polars::X)."""
    return sorted(t for t in ToolRegistry._tools.keys() if "/" not in t)


def test_every_tool_returns_typed_schema(client: TestClient) -> None:
    """Acceptance: every tool exposes x-typed=True after migration."""
    tool_types = _registered_tool_types()
    assert tool_types, "ToolRegistry is empty - implementations did not register"

    missing: list[str] = []
    for tool_type in tool_types:
        resp = client.get(f"/api/workflow/tool/{tool_type}/schema")
        assert resp.status_code == 200, f"{tool_type}: {resp.status_code} {resp.text}"
        body = resp.json()
        if not body.get("x-typed"):
            missing.append(tool_type)
        # Every schema must declare an object type with a properties dict.
        assert body.get("type") == "object", f"{tool_type}: type is not object"
        assert "properties" in body, f"{tool_type}: missing properties"

    assert not missing, f"Tools without typed Pydantic configs: {missing}"


def test_unknown_tool_returns_404(client: TestClient) -> None:
    resp = client.get("/api/workflow/tool/DefinitelyNotARealTool/schema")
    assert resp.status_code == 404


@pytest.mark.parametrize(
    "tool_type,expected_property",
    [
        ("Filter", "expression"),
        ("Formula", "operations"),
        ("Sort", "sortColumns"),
        ("Join", "leftKeys"),
        ("Pivot", "on"),
        ("Unpivot", "on"),
        ("Sample", "mode"),
        ("Select", "columnConfigs"),
        ("Summarize", "aggregations"),
        ("Union", "mode"),
        ("Unique", "columns"),
        ("Input", "type"),
        ("Output", "type"),
    ],
)
def test_tool_schema_exposes_key_property(
    client: TestClient, tool_type: str, expected_property: str
) -> None:
    """Each migrated tool's schema must surface its main config field."""
    resp = client.get(f"/api/workflow/tool/{tool_type}/schema")
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("x-typed") is True, f"{tool_type} not marked x-typed"
    properties = body.get("properties", {})
    assert expected_property in properties, (
        f"{tool_type}: expected property '{expected_property}' missing from "
        f"schema properties {sorted(properties)}"
    )
