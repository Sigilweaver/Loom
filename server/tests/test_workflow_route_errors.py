"""Status codes for client mistakes on the workflow routes.

Deliberate HTTP errors (bad workflow JSON, unknown tool) used to be swallowed by the
"unexpected error" mapper and returned as 500s.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _workflow() -> dict:
    return {
        "meta": {
            "name": "w",
            "description": "",
            "author": "t",
            "workflowId": "route-errors",
            "created": "2025-01-01",
        },
        "tools": [
            {
                "id": "in1",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {"category": "file", "type": "csv", "source": "/nope.csv"},
                "sockets": [{"id": "output", "direction": "output"}],
            }
        ],
        "wires": [],
    }


@pytest.mark.parametrize(
    "path",
    [
        "/api/workflow/execute",
        "/api/workflow/preview_all",
        "/api/workflow/preview_code",
    ],
)
def test_malformed_workflow_is_400(client, path):
    response = client.post(path, json={"workflow": {"tools": "not-a-list"}})
    assert response.status_code == 400
    assert "Invalid workflow format" in str(response.json()["detail"])


def test_unknown_target_tool_is_400(client):
    response = client.post(
        "/api/workflow/execute", json={"workflow": _workflow(), "target_tool_id": "ghost"}
    )
    assert response.status_code == 400
    assert "ghost" in response.json()["detail"]


@pytest.mark.parametrize(
    ("path", "extra"),
    [
        ("/api/workflow/tool/execute", {"socket_id": "output"}),
        ("/api/workflow/tool/schema", {"socket_id": "output"}),
        ("/api/workflow/tool/metadata", {}),
        ("/api/workflow/tool/profile", {"socket_id": "output"}),
    ],
)
def test_unknown_tool_is_400(client, path, extra):
    response = client.post(path, json={"workflow": _workflow(), "tool_id": "ghost", **extra})
    assert response.status_code == 400
    assert "ghost" in response.json()["detail"]
