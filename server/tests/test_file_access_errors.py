"""File-access failures raised in the domain layer map to the right HTTP responses (#82).

Path validation used to raise HTTPException from deep inside the domain layer, which
the workflow and datasource routes then turned into a generic 500. It now raises
domain exceptions and the application maps them.
"""

from pathlib import Path

import polars as pl
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils import security as sec


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _input_workflow(source: str) -> dict:
    return {
        "meta": {
            "name": "file access",
            "description": "",
            "author": "t",
            "workflowId": "file-access",
            "created": "2025-01-01",
        },
        "tools": [
            {
                "id": "input1",
                "type": "Input",
                "x": 0,
                "y": 0,
                "config": {"category": "file", "type": "csv", "source": source, "csvMode": "scan"},
                "sockets": [{"id": "output", "direction": "output"}],
            }
        ],
        "wires": [],
    }


@pytest.fixture
def csv_file(tmp_path: Path) -> Path:
    path = tmp_path / "data" / "in.csv"
    path.parent.mkdir()
    pl.DataFrame({"a": [1, 2]}).write_csv(path)
    return path


class TestWorkflowRoutes:
    def test_missing_file_is_404_with_plain_message(self, client, tmp_path):
        response = client.post(
            "/api/workflow/execute",
            json={"workflow": _input_workflow(str(tmp_path / "nope.csv"))},
        )
        assert response.status_code == 404
        assert response.json() == {"detail": f"File not found: {tmp_path / 'nope.csv'}"}

    def test_directory_is_400(self, client, tmp_path):
        response = client.post(
            "/api/workflow/execute", json={"workflow": _input_workflow(str(tmp_path))}
        )
        assert response.status_code == 400
        assert response.json()["detail"].startswith("Not a file")

    def test_path_outside_allowlist_is_403(self, client, csv_file, tmp_path, monkeypatch):
        allowed = tmp_path / "allowed"
        allowed.mkdir()
        monkeypatch.setattr(sec.settings, "file_access_mode", "allowlist", raising=False)
        monkeypatch.setattr(sec.settings, "allowed_file_paths", [str(allowed)])

        response = client.post(
            "/api/workflow/execute", json={"workflow": _input_workflow(str(csv_file))}
        )

        assert response.status_code == 403
        assert "not allowed" in response.json()["detail"].lower()

    def test_tool_execute_maps_denial_too(self, client, csv_file, tmp_path, monkeypatch):
        monkeypatch.setattr(sec.settings, "file_access_mode", "allowlist", raising=False)
        monkeypatch.setattr(sec.settings, "allowed_file_paths", [str(tmp_path / "elsewhere")])

        response = client.post(
            "/api/workflow/tool/execute",
            json={
                "workflow": _input_workflow(str(csv_file)),
                "tool_id": "input1",
                "socket_id": "output",
            },
        )

        assert response.status_code == 403

    def test_allowed_path_still_executes(self, client, csv_file, monkeypatch):
        monkeypatch.setattr(sec.settings, "file_access_mode", "allowlist", raising=False)
        monkeypatch.setattr(sec.settings, "allowed_file_paths", [str(csv_file.parent)])

        response = client.post(
            "/api/workflow/execute", json={"workflow": _input_workflow(str(csv_file))}
        )

        assert response.status_code == 200


class TestDatasourceRoutes:
    def test_preview_missing_file_reports_the_cause(self, client, tmp_path):
        response = client.post(
            "/api/datasource/preview",
            json={"source": str(tmp_path / "nope.csv"), "source_type": "csv", "config": {}},
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "File not found" in detail
        # The old HTTPException text leaked into messages as "404: File not found"
        assert "404:" not in detail

    def test_inspect_binary_format_denied_is_403(self, client, csv_file, tmp_path, monkeypatch):
        """Datasources that validate paths directly surface 403, not a generic 500."""
        monkeypatch.setattr(sec.settings, "file_access_mode", "allowlist", raising=False)
        monkeypatch.setattr(sec.settings, "allowed_file_paths", [str(tmp_path / "elsewhere")])

        response = client.post(
            "/api/datasource/inspect",
            json={
                "source": str(csv_file.with_suffix(".avro")),
                "source_type": "avro",
                "config": {},
            },
        )

        assert response.status_code == 403


class TestValidationOrder:
    """Permission is decided before existence so paths cannot be probed."""

    def test_nonexistent_path_outside_allowlist_is_denied_not_404(self, tmp_path, monkeypatch):
        allowed = tmp_path / "allowed"
        allowed.mkdir()
        monkeypatch.setattr(sec.settings, "file_access_mode", "allowlist", raising=False)
        monkeypatch.setattr(sec.settings, "allowed_file_paths", [str(allowed)])

        from app.utils.errors import FileAccessDeniedError

        with pytest.raises(FileAccessDeniedError):
            sec.validate_file_path(str(tmp_path / "secret" / "does-not-exist.csv"))

    def test_nonexistent_path_outside_hub_grants_is_denied_not_404(self, tmp_path):
        from app.utils.errors import FileAccessDeniedError

        token = sec.allowed_paths_context.set(
            [sec.FilePathGrant(path=str(tmp_path / "granted"), read_only=False)]
        )
        try:
            with pytest.raises(FileAccessDeniedError):
                sec.validate_file_path(str(tmp_path / "other" / "missing.csv"))
        finally:
            sec.allowed_paths_context.reset(token)

    def test_nonexistent_path_inside_allowlist_is_404(self, tmp_path, monkeypatch):
        monkeypatch.setattr(sec.settings, "file_access_mode", "allowlist", raising=False)
        monkeypatch.setattr(sec.settings, "allowed_file_paths", [str(tmp_path)])

        from app.utils.errors import FileNotFoundAccessError

        with pytest.raises(FileNotFoundAccessError):
            sec.validate_file_path(str(tmp_path / "missing.csv"))
