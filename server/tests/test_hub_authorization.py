"""Hub authorization on the workflow routes and file-access configuration checks."""

from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.routes import workflow as workflow_routes
from app.api.routes.workflow import (
    _authorize_hub_request,
    _extract_bearer_token,
    _extract_hub_connections,
    _set_file_paths_context,
)
from app.config import settings
from app.domain.hub.client import AuthorizationResult, FilePathGrant
from app.utils import security as sec
from app.utils.errors import FileAccessDeniedError


class TestBearerToken:
    @pytest.mark.parametrize(
        ("header", "expected"),
        [
            ("Bearer abc", "abc"),
            ("bearer abc", "abc"),
            ("BEARER abc", "abc"),
            ("Bearer a b c", "a b c"),
            (None, None),
            ("", None),
            ("Bearer", None),
            ("Basic abc", None),
            ("abc", None),
        ],
    )
    def test_extract(self, header, expected):
        assert _extract_bearer_token(header) == expected


class TestExtractHubConnections:
    def test_only_hub_owned_input_connections_in_order_without_duplicates(self):
        workflow = {
            "tools": [
                {"type": "Input", "config": {"owner": "hub", "connectionId": "c1"}},
                {"type": "Input", "config": {"owner": "hub", "connectionId": "c2"}},
                {"type": "Input", "config": {"owner": "hub", "connectionId": "c1"}},
                {"type": "Input", "config": {"owner": "client", "connectionId": "local"}},
                {"type": "Input", "config": {"connectionId": "defaults-to-client"}},
                {"type": "Input", "config": {"owner": "hub"}},
                {"type": "Filter", "config": {"owner": "hub", "connectionId": "not-an-input"}},
                {"type": "Input", "config": None},
            ]
        }
        assert _extract_hub_connections(workflow) == ["c1", "c2"]

    def test_empty_workflow(self):
        assert _extract_hub_connections({}) == []


class FakeHub:
    def __init__(self, result: AuthorizationResult) -> None:
        self.result = result
        self.calls: list[dict] = []

    async def authorize(self, **kwargs):
        self.calls.append(kwargs)
        return self.result


class TestAuthorizeHubRequest:
    WORKFLOW = {"tools": [{"type": "Input", "config": {"owner": "hub", "connectionId": "c1"}}]}

    async def test_not_hub_mode_skips_authorization(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "disabled")
        assert await _authorize_hub_request(self.WORKFLOW, authorization=None) is None

    async def test_hub_mode_without_configured_client_is_500(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(workflow_routes, "get_hub_client", lambda: None)
        with pytest.raises(HTTPException) as exc:
            await _authorize_hub_request(self.WORKFLOW, authorization="Bearer t")
        assert exc.value.status_code == 500

    @pytest.mark.parametrize("header", [None, "", "Basic abc", "Bearer"])
    async def test_missing_or_malformed_bearer_is_401_and_hub_not_called(self, monkeypatch, header):
        hub = FakeHub(AuthorizationResult(authorized=True))
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(workflow_routes, "get_hub_client", lambda: hub)

        with pytest.raises(HTTPException) as exc:
            await _authorize_hub_request(self.WORKFLOW, authorization=header)

        assert exc.value.status_code == 401
        assert hub.calls == []

    async def test_denied_is_401_with_the_hub_reason(self, monkeypatch):
        hub = FakeHub(AuthorizationResult(authorized=False, error="Token already used"))
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(workflow_routes, "get_hub_client", lambda: hub)

        with pytest.raises(HTTPException) as exc:
            await _authorize_hub_request(self.WORKFLOW, authorization="Bearer t")

        assert exc.value.status_code == 401
        assert exc.value.detail == "Token already used"

    async def test_denied_without_reason_has_generic_message(self, monkeypatch):
        hub = FakeHub(AuthorizationResult(authorized=False))
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(workflow_routes, "get_hub_client", lambda: hub)

        with pytest.raises(HTTPException) as exc:
            await _authorize_hub_request(self.WORKFLOW, authorization="Bearer t")

        assert exc.value.detail == "Authorization failed"

    async def test_success_forwards_token_connections_and_workflow(self, monkeypatch):
        granted = AuthorizationResult(
            authorized=True, file_paths=[FilePathGrant(path="/d", read_only=True)]
        )
        hub = FakeHub(granted)
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(workflow_routes, "get_hub_client", lambda: hub)

        result = await _authorize_hub_request(
            self.WORKFLOW, authorization="Bearer tok", request_type="preview"
        )

        assert result is granted
        assert hub.calls == [
            {
                "server_token": "tok",
                "request_type": "preview",
                "connection_ids": ["c1"],
                "workflow": self.WORKFLOW,
            }
        ]


class TestFilePathsContext:
    def test_no_hub_result_leaves_context_untouched(self):
        with _set_file_paths_context(None):
            assert sec.allowed_paths_context.get() is None

    def test_grants_are_installed_and_removed(self):
        result = AuthorizationResult(
            authorized=True,
            file_paths=[
                FilePathGrant(path="/a", read_only=True),
                FilePathGrant(path="/b", read_only=False),
            ],
        )

        with _set_file_paths_context(result):
            grants = sec.allowed_paths_context.get()
            assert grants is not None
            assert [(g.path, g.read_only) for g in grants] == [("/a", True), ("/b", False)]

        assert sec.allowed_paths_context.get() is None

    def test_hub_result_without_grants_installs_deny_all(self, tmp_path):
        """Hub said yes but granted no paths: file access is denied, not unrestricted."""
        target = tmp_path / "f.csv"
        target.write_text("x")

        with _set_file_paths_context(AuthorizationResult(authorized=True, file_paths=None)):
            assert sec.allowed_paths_context.get() == []
            with pytest.raises(FileAccessDeniedError):
                sec.validate_file_path(str(target))

    def test_context_is_removed_when_the_body_raises(self):
        result = AuthorizationResult(authorized=True, file_paths=[])
        with pytest.raises(RuntimeError):
            with _set_file_paths_context(result):
                raise RuntimeError("boom")
        assert sec.allowed_paths_context.get() is None

    def test_grants_confine_validation_to_granted_directory(self, tmp_path):
        granted = tmp_path / "granted"
        granted.mkdir()
        inside = granted / "in.csv"
        inside.write_text("x")
        outside = tmp_path / "out.csv"
        outside.write_text("x")
        result = AuthorizationResult(
            authorized=True, file_paths=[FilePathGrant(path=str(granted), read_only=True)]
        )

        with _set_file_paths_context(result):
            assert sec.validate_file_path(str(inside)) == inside.resolve()
            with pytest.raises(FileAccessDeniedError):
                sec.validate_file_path(str(outside))
            # Read-only grant: reading is fine, writing is not
            with pytest.raises(FileAccessDeniedError, match="read-only"):
                sec.validate_file_path_for_write(str(granted / "new.csv"))


class TestFileAccessConfigValidation:
    """validate_file_access_config refuses contradictory settings at startup."""

    @pytest.fixture(autouse=True)
    def _defaults(self, monkeypatch):
        monkeypatch.setattr(settings, "file_access_mode", "auto", raising=False)
        monkeypatch.setattr(settings, "auth_mode", "disabled")
        monkeypatch.setattr(settings, "restrict_file_access", False)
        monkeypatch.setattr(settings, "allowed_file_paths", [])

    def test_unknown_mode_refuses_to_start(self, monkeypatch, caplog):
        monkeypatch.setattr(settings, "file_access_mode", "yolo", raising=False)
        with pytest.raises(SystemExit) as exc:
            sec.validate_file_access_config()
        assert exc.value.code == 2
        assert "yolo" in caplog.text

    def test_allowlist_needs_paths(self, monkeypatch):
        monkeypatch.setattr(settings, "file_access_mode", "allowlist", raising=False)
        with pytest.raises(SystemExit):
            sec.validate_file_access_config()

    def test_allowlist_with_paths_is_ok(self, monkeypatch):
        monkeypatch.setattr(settings, "file_access_mode", "allowlist", raising=False)
        monkeypatch.setattr(settings, "allowed_file_paths", ["/data"])
        sec.validate_file_access_config()

    def test_hub_mode_requires_hub_auth(self, monkeypatch):
        monkeypatch.setattr(settings, "file_access_mode", "hub", raising=False)
        with pytest.raises(SystemExit):
            sec.validate_file_access_config()

    def test_hub_mode_with_hub_auth_is_ok(self, monkeypatch):
        monkeypatch.setattr(settings, "file_access_mode", "hub", raising=False)
        monkeypatch.setattr(settings, "auth_mode", "hub")
        sec.validate_file_access_config()

    def test_legacy_restrict_flag_without_paths_refuses_to_start(self, monkeypatch):
        monkeypatch.setattr(settings, "restrict_file_access", True)
        with pytest.raises(SystemExit):
            sec.validate_file_access_config()

    def test_legacy_restrict_flag_without_paths_is_tolerated_under_hub(self, monkeypatch):
        monkeypatch.setattr(settings, "restrict_file_access", True)
        monkeypatch.setattr(settings, "auth_mode", "hub")
        sec.validate_file_access_config()

    def test_open_mode_warns_loudly(self, monkeypatch, caplog):
        monkeypatch.setattr(settings, "file_access_mode", "open", raising=False)
        with caplog.at_level("WARNING", logger=sec.logger.name):
            sec.validate_file_access_config()
        assert any("open" in r.message and r.levelname == "WARNING" for r in caplog.records)


class TestResolveMode:
    @pytest.mark.parametrize("explicit", ["open", "allowlist", "hub"])
    def test_explicit_mode_wins(self, monkeypatch, explicit):
        monkeypatch.setattr(settings, "file_access_mode", explicit, raising=False)
        monkeypatch.setattr(settings, "auth_mode", "disabled")
        assert sec.resolve_file_access_mode() == explicit

    @pytest.mark.parametrize(
        ("auth_mode", "restrict", "paths", "expected"),
        [
            ("hub", False, [], "hub"),
            ("hub", True, ["/d"], "hub"),
            ("disabled", True, ["/d"], "allowlist"),
            ("disabled", True, [], "open"),
            ("disabled", False, ["/d"], "open"),
            ("ephemeral", False, [], "open"),
        ],
    )
    def test_auto_derivation(self, monkeypatch, auth_mode, restrict, paths, expected):
        monkeypatch.setattr(settings, "file_access_mode", "auto", raising=False)
        monkeypatch.setattr(settings, "auth_mode", auth_mode)
        monkeypatch.setattr(settings, "restrict_file_access", restrict)
        monkeypatch.setattr(settings, "allowed_file_paths", paths)
        assert sec.resolve_file_access_mode() == expected


class TestServerAllowlistFencesHubGrants:
    """An admin allowlist still applies inside Hub mode (defence in depth)."""

    @pytest.fixture
    def files(self, tmp_path: Path) -> dict[str, Path]:
        for name in ("fenced", "outside"):
            (tmp_path / name).mkdir()
            (tmp_path / name / "f.csv").write_text("x")
        return {"fenced": tmp_path / "fenced" / "f.csv", "outside": tmp_path / "outside" / "f.csv"}

    def test_hub_grant_outside_admin_allowlist_is_denied(self, monkeypatch, tmp_path, files):
        monkeypatch.setattr(settings, "file_access_mode", "auto", raising=False)
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(settings, "restrict_file_access", True)
        monkeypatch.setattr(settings, "allowed_file_paths", [str(tmp_path / "fenced")])
        token = sec.allowed_paths_context.set(
            [sec.FilePathGrant(path=str(tmp_path), read_only=False)]
        )
        try:
            assert sec.validate_file_path(str(files["fenced"])) == files["fenced"].resolve()
            with pytest.raises(FileAccessDeniedError):
                sec.validate_file_path(str(files["outside"]))
            with pytest.raises(FileAccessDeniedError):
                sec.validate_file_path_for_write(str(files["outside"]))
        finally:
            sec.allowed_paths_context.reset(token)

    def test_no_allowlist_means_hub_grants_alone_decide(self, monkeypatch, tmp_path, files):
        monkeypatch.setattr(settings, "file_access_mode", "auto", raising=False)
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(settings, "restrict_file_access", False)
        monkeypatch.setattr(settings, "allowed_file_paths", [])
        token = sec.allowed_paths_context.set(
            [sec.FilePathGrant(path=str(tmp_path), read_only=False)]
        )
        try:
            assert sec.validate_file_path(str(files["outside"])) == files["outside"].resolve()
        finally:
            sec.allowed_paths_context.reset(token)

    def test_hub_mode_without_grants_denies_everything(self, monkeypatch, files):
        monkeypatch.setattr(settings, "file_access_mode", "hub", raising=False)
        monkeypatch.setattr(settings, "auth_mode", "hub")
        with pytest.raises(FileAccessDeniedError, match="Hub-issued grant"):
            sec.validate_file_path(str(files["fenced"]))
        with pytest.raises(FileAccessDeniedError, match="Hub-issued grant"):
            sec.validate_file_path_for_write(str(files["fenced"]))

    def test_active_allowlist_rules(self, monkeypatch):
        monkeypatch.setattr(settings, "allowed_file_paths", ["/a"])
        monkeypatch.setattr(settings, "file_access_mode", "open", raising=False)
        monkeypatch.setattr(settings, "restrict_file_access", False)
        assert sec.active_server_allowlist() is None

        monkeypatch.setattr(settings, "file_access_mode", "allowlist", raising=False)
        assert sec.active_server_allowlist() == ["/a"]

        monkeypatch.setattr(settings, "file_access_mode", "auto", raising=False)
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(settings, "restrict_file_access", True)
        assert sec.active_server_allowlist() == ["/a"]

        monkeypatch.setattr(settings, "allowed_file_paths", [])
        assert sec.active_server_allowlist() is None


class TestHubGrantsEnforcedThroughTheRoutes:
    """End to end: the grants Hub returns decide which files a workflow may read."""

    @staticmethod
    def _workflow(source: str) -> dict:
        return {
            "meta": {
                "name": "hub",
                "description": "",
                "author": "t",
                "workflowId": "hub-e2e",
                "created": "2025-01-01",
            },
            "tools": [
                {
                    "id": "in1",
                    "type": "Input",
                    "x": 0,
                    "y": 0,
                    "config": {
                        "category": "file",
                        "type": "csv",
                        "source": source,
                        "csvMode": "scan",
                    },
                    "sockets": [{"id": "output", "direction": "output"}],
                }
            ],
            "wires": [],
        }

    @pytest.fixture
    def hub_env(self, monkeypatch, tmp_path):
        import polars as pl

        granted = tmp_path / "granted"
        granted.mkdir()
        other = tmp_path / "other"
        other.mkdir()
        for folder in (granted, other):
            pl.DataFrame({"a": [1, 2]}).write_csv(folder / "d.csv")

        hub = FakeHub(
            AuthorizationResult(
                authorized=True,
                file_paths=[FilePathGrant(path=str(granted), read_only=True)],
            )
        )
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(settings, "file_access_mode", "auto", raising=False)
        monkeypatch.setattr(settings, "restrict_file_access", False)
        monkeypatch.setattr(settings, "allowed_file_paths", [])
        monkeypatch.setattr(workflow_routes, "get_hub_client", lambda: hub)
        return {"hub": hub, "granted": granted / "d.csv", "other": other / "d.csv"}

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient

        from app.main import app

        return TestClient(app)

    def test_file_inside_grant_executes(self, client, hub_env):
        response = client.post(
            "/api/workflow/execute",
            json={"workflow": self._workflow(str(hub_env["granted"]))},
            headers={"Authorization": "Bearer one-time"},
        )
        assert response.status_code == 200
        assert response.json()["outputs"]["output"]["row_count"] == 2

    def test_file_outside_grant_is_403(self, client, hub_env):
        response = client.post(
            "/api/workflow/execute",
            json={"workflow": self._workflow(str(hub_env["other"]))},
            headers={"Authorization": "Bearer one-time"},
        )
        assert response.status_code == 403
        assert "granted paths" in response.json()["detail"]

    def test_missing_token_is_401_and_nothing_runs(self, client, hub_env):
        response = client.post(
            "/api/workflow/execute", json={"workflow": self._workflow(str(hub_env["granted"]))}
        )
        assert response.status_code == 401
        assert hub_env["hub"].calls == []

    def test_grants_do_not_leak_into_the_next_request(self, client, hub_env):
        client.post(
            "/api/workflow/execute",
            json={"workflow": self._workflow(str(hub_env["granted"]))},
            headers={"Authorization": "Bearer one-time"},
        )
        assert sec.allowed_paths_context.get() is None
