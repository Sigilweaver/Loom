"""Tests for the file browser routes (trust boundary: what a caller may see on disk)."""

from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.routes import files as files_mod
from app.api.routes.files import BrowseContext, get_browse_context
from app.config import settings
from app.domain.hub.client import AuthorizationResult, FilePathGrant
from app.main import app


@pytest.fixture
def tree(tmp_path: Path) -> dict[str, Path]:
    """Layout: granted/{a.csv, sales_2024.parquet, notes.txt, sub/deep.csv}, secret/s.csv"""
    granted = tmp_path / "granted"
    (granted / "sub").mkdir(parents=True)
    secret = tmp_path / "secret"
    secret.mkdir()
    for path in (
        granted / "a.csv",
        granted / "sales_2024.parquet",
        granted / "notes.txt",
        granted / "sub" / "deep.csv",
        secret / "s.csv",
    ):
        path.write_text("x")
    return {"root": tmp_path, "granted": granted, "secret": secret}


def use_grants(*grants: FilePathGrant):
    """Override the browse context so routes see exactly these grants."""
    app.dependency_overrides[get_browse_context] = lambda: BrowseContext(
        user_id="u1", file_paths=list(grants)
    )


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.pop(get_browse_context, None)


@pytest.fixture(autouse=True)
def no_admin_allowlist(monkeypatch):
    monkeypatch.setattr(settings, "file_access_mode", "open", raising=False)
    monkeypatch.setattr(settings, "restrict_file_access", False)
    monkeypatch.setattr(settings, "allowed_file_paths", [])


def grant(path: Path, read_only: bool = False) -> FilePathGrant:
    return FilePathGrant(path=str(path), read_only=read_only)


class TestRoots:
    def test_lists_existing_granted_directories(self, client, tree):
        use_grants(grant(tree["granted"], read_only=True), grant(tree["root"] / "missing"))

        response = client.get("/api/files/roots")

        assert response.status_code == 200
        assert response.json() == [{"path": str(tree["granted"].resolve()), "read_only": True}]

    def test_file_grants_are_not_roots(self, client, tree):
        use_grants(grant(tree["granted"] / "a.csv"))
        assert client.get("/api/files/roots").json() == []

    def test_no_grants_no_roots(self, client):
        use_grants()
        assert client.get("/api/files/roots").json() == []


class TestList:
    def test_lists_directory_dirs_first_then_by_name(self, client, tree):
        use_grants(grant(tree["granted"]))

        response = client.get("/api/files/list", params={"path": str(tree["granted"])})

        assert response.status_code == 200
        body = response.json()
        assert body["read_only"] is False
        assert [(e["name"], e["is_dir"]) for e in body["entries"]] == [
            ("sub", True),
            ("a.csv", False),
            ("notes.txt", False),
            ("sales_2024.parquet", False),
        ]
        csv_entry = next(e for e in body["entries"] if e["name"] == "a.csv")
        assert csv_entry["extension"] == "csv"
        assert csv_entry["size"] == 1

    def test_read_only_grant_is_reported(self, client, tree):
        use_grants(grant(tree["granted"], read_only=True))
        response = client.get("/api/files/list", params={"path": str(tree["granted"])})
        assert response.json()["read_only"] is True

    def test_outside_grants_is_403(self, client, tree):
        use_grants(grant(tree["granted"]))
        response = client.get("/api/files/list", params={"path": str(tree["secret"])})
        assert response.status_code == 403

    def test_dotdot_traversal_out_of_grant_is_403(self, client, tree):
        use_grants(grant(tree["granted"]))
        sneaky = f"{tree['granted']}/../secret"
        response = client.get("/api/files/list", params={"path": sneaky})
        assert response.status_code == 403

    def test_sibling_with_shared_prefix_is_not_inside_grant(self, client, tree):
        sibling = tree["root"] / "granted-evil"
        sibling.mkdir()
        use_grants(grant(tree["granted"]))
        response = client.get("/api/files/list", params={"path": str(sibling)})
        assert response.status_code == 403

    def test_missing_directory_inside_grant_is_404(self, client, tree):
        use_grants(grant(tree["granted"]))
        response = client.get("/api/files/list", params={"path": str(tree["granted"] / "nope")})
        assert response.status_code == 404

    def test_missing_path_outside_grant_is_403_not_404(self, client, tree):
        """Existence of paths outside the grants must not be observable."""
        use_grants(grant(tree["granted"]))
        response = client.get("/api/files/list", params={"path": str(tree["root"] / "nope")})
        assert response.status_code == 403

    def test_file_path_is_400(self, client, tree):
        use_grants(grant(tree["granted"]))
        response = client.get("/api/files/list", params={"path": str(tree["granted"] / "a.csv")})
        assert response.status_code == 400

    def test_null_byte_path_is_400(self, client, tree):
        use_grants(grant(tree["granted"]))
        response = client.get("/api/files/list", params={"path": "/tmp/\x00evil"})
        assert response.status_code == 400

    def test_symlink_escaping_the_grant_is_hidden(self, client, tree):
        link = tree["granted"] / "escape.csv"
        link.symlink_to(tree["secret"] / "s.csv")
        dir_link = tree["granted"] / "escape_dir"
        dir_link.symlink_to(tree["secret"], target_is_directory=True)
        use_grants(grant(tree["granted"]))

        response = client.get("/api/files/list", params={"path": str(tree["granted"])})

        names = {e["name"] for e in response.json()["entries"]}
        assert "escape.csv" not in names
        assert "escape_dir" not in names
        assert "s.csv" not in names

    def test_listing_a_symlink_that_escapes_is_403(self, client, tree):
        dir_link = tree["granted"] / "escape_dir"
        dir_link.symlink_to(tree["secret"], target_is_directory=True)
        use_grants(grant(tree["granted"]))

        response = client.get("/api/files/list", params={"path": str(dir_link)})

        assert response.status_code == 403

    def test_symlink_that_stays_inside_the_grant_is_listed(self, client, tree):
        (tree["granted"] / "alias.csv").symlink_to(tree["granted"] / "a.csv")
        use_grants(grant(tree["granted"]))

        response = client.get("/api/files/list", params={"path": str(tree["granted"])})

        assert response.status_code == 200
        assert len(response.json()["entries"]) >= 4

    def test_admin_allowlist_narrows_a_broader_grant(self, client, tree, monkeypatch):
        monkeypatch.setattr(settings, "file_access_mode", "allowlist", raising=False)
        monkeypatch.setattr(settings, "allowed_file_paths", [str(tree["granted"])])
        use_grants(grant(tree["root"]))  # grant is the whole tmp tree

        assert (
            client.get("/api/files/list", params={"path": str(tree["granted"])}).status_code == 200
        )
        assert (
            client.get("/api/files/list", params={"path": str(tree["secret"])}).status_code == 403
        )

    def test_legacy_restrict_flag_still_narrows_grants(self, client, tree, monkeypatch):
        monkeypatch.setattr(settings, "restrict_file_access", True)
        monkeypatch.setattr(settings, "allowed_file_paths", [str(tree["granted"])])
        use_grants(grant(tree["root"]))

        assert (
            client.get("/api/files/list", params={"path": str(tree["secret"])}).status_code == 403
        )


class TestStat:
    def test_existing_file(self, client, tree):
        use_grants(grant(tree["granted"], read_only=True))

        response = client.get("/api/files/stat", params={"path": str(tree["granted"] / "a.csv")})

        assert response.status_code == 200
        body = response.json()
        assert body["exists"] is True
        assert body["is_file"] is True
        assert body["is_dir"] is False
        assert body["extension"] == "csv"
        assert body["read_only"] is True

    def test_existing_directory(self, client, tree):
        use_grants(grant(tree["granted"]))
        body = client.get("/api/files/stat", params={"path": str(tree["granted"] / "sub")}).json()
        assert body["is_dir"] is True
        assert body["size"] is None
        assert body["extension"] is None

    def test_missing_path_inside_grant_reports_not_exists(self, client, tree):
        use_grants(grant(tree["granted"]))
        response = client.get("/api/files/stat", params={"path": str(tree["granted"] / "nope")})
        assert response.status_code == 200
        assert response.json()["exists"] is False

    def test_outside_grant_is_403_whether_or_not_it_exists(self, client, tree):
        use_grants(grant(tree["granted"]))
        for path in (tree["secret"] / "s.csv", tree["secret"] / "missing.csv"):
            response = client.get("/api/files/stat", params={"path": str(path)})
            assert response.status_code == 403

    def test_symlink_escape_is_403(self, client, tree):
        link = tree["granted"] / "escape.csv"
        link.symlink_to(tree["secret"] / "s.csv")
        use_grants(grant(tree["granted"]))

        response = client.get("/api/files/stat", params={"path": str(link)})

        assert response.status_code == 403


class TestSearch:
    def test_finds_and_ranks_by_relevance(self, client, tree):
        (tree["granted"] / "sales.csv").write_text("x")
        use_grants(grant(tree["granted"]))

        body = client.get("/api/files/search", params={"query": "sales"}).json()

        names = [r["name"] for r in body["results"]]
        assert names[0] == "sales.csv"  # exact match beats prefix match
        assert "sales_2024.parquet" in names
        assert body["results"][0]["score"] == 1.0

    def test_default_extensions_exclude_non_data_files(self, client, tree):
        use_grants(grant(tree["granted"]))
        body = client.get("/api/files/search", params={"query": "notes"}).json()
        assert body["results"] == []

    def test_extension_filter(self, client, tree):
        use_grants(grant(tree["granted"]))
        body = client.get(
            "/api/files/search", params={"query": "a", "extensions": ".parquet, TXT"}
        ).json()
        assert {r["name"] for r in body["results"]} <= {"sales_2024.parquet", "notes.txt"}
        assert body["results"]

    def test_recurses_into_subdirectories(self, client, tree):
        use_grants(grant(tree["granted"]))
        body = client.get("/api/files/search", params={"query": "deep"}).json()
        assert [r["name"] for r in body["results"]] == ["deep.csv"]

    def test_never_returns_files_outside_grants(self, client, tree):
        use_grants(grant(tree["granted"]))
        body = client.get("/api/files/search", params={"query": "s"}).json()
        assert all(str(tree["secret"]) not in r["path"] for r in body["results"])

    def test_symlinks_out_of_the_grant_are_not_followed(self, client, tree):
        (tree["granted"] / "escape_dir").symlink_to(tree["secret"], target_is_directory=True)
        (tree["granted"] / "escape.csv").symlink_to(tree["secret"] / "s.csv")
        use_grants(grant(tree["granted"]))

        body = client.get("/api/files/search", params={"query": "s"}).json()

        assert all(str(tree["secret"]) not in r["path"] for r in body["results"])

    def test_symlink_cycles_do_not_multiply_the_scan(self, tree, monkeypatch):
        """Each real directory is walked once, however many links point back at it."""
        for i in range(3):
            (tree["granted"] / f"loop{i}").symlink_to(tree["granted"], target_is_directory=True)
            (tree["granted"] / "sub" / f"loop{i}").symlink_to(
                tree["granted"], target_is_directory=True
            )
        real_iterdir = Path.iterdir
        calls: list[Path] = []

        def counting_iterdir(self: Path):
            calls.append(self)
            return real_iterdir(self)

        monkeypatch.setattr(Path, "iterdir", counting_iterdir)

        found = files_mod._walk_data_files(
            tree["granted"], [grant(tree["granted"])], files_mod.DATA_EXTENSIONS
        )

        assert len(calls) == 2  # granted/ and granted/sub/ only
        assert {p.name for p, _ in found} == {"a.csv", "sales_2024.parquet", "deep.csv"}

    def test_symlink_cycle_terminates_without_duplicates(self, client, tree):
        (tree["granted"] / "sub" / "loop").symlink_to(tree["granted"], target_is_directory=True)
        (tree["granted"] / "loop2").symlink_to(tree["granted"], target_is_directory=True)
        use_grants(grant(tree["granted"]))

        response = client.get("/api/files/search", params={"query": "deep"})

        assert response.status_code == 200
        body = response.json()
        assert [r["name"] for r in body["results"]] == ["deep.csv"]

    def test_hidden_directories_are_skipped(self, client, tree):
        hidden = tree["granted"] / ".hidden"
        hidden.mkdir()
        (hidden / "ghost.csv").write_text("x")
        use_grants(grant(tree["granted"]))
        assert client.get("/api/files/search", params={"query": "ghost"}).json()["results"] == []

    def test_limit(self, client, tree):
        for i in range(5):
            (tree["granted"] / f"report_{i}.csv").write_text("x")
        use_grants(grant(tree["granted"]))
        body = client.get("/api/files/search", params={"query": "report", "limit": 3}).json()
        assert len(body["results"]) == 3

    def test_limit_is_bounded(self, client, tree):
        use_grants(grant(tree["granted"]))
        assert (
            client.get("/api/files/search", params={"query": "a", "limit": 1000}).status_code == 422
        )

    def test_blank_query_is_400(self, client, tree):
        use_grants(grant(tree["granted"]))
        assert client.get("/api/files/search", params={"query": "   "}).status_code == 400

    def test_overlapping_grants_do_not_duplicate_results(self, client, tree):
        use_grants(grant(tree["granted"]), grant(tree["granted"] / "sub"))
        body = client.get("/api/files/search", params={"query": "deep"}).json()
        assert [r["name"] for r in body["results"]] == ["deep.csv"]

    def test_scan_is_capped(self, tree, monkeypatch):
        for i in range(10):
            (tree["granted"] / f"bulk_{i}.csv").write_text("x")

        found = files_mod._walk_data_files(
            tree["granted"], [grant(tree["granted"])], files_mod.DATA_EXTENSIONS, max_files=4
        )

        assert len(found) == 4


class TestFuzzyScore:
    @pytest.mark.parametrize(
        ("query", "name", "expected"),
        [
            ("sales", "sales.csv", 1.0),
            ("SALES", "sales.csv", 1.0),
            ("sal", "sales_2024.csv", 0.9),
            ("2024", "sales_2024.csv", 0.8),
            ("ale", "sales.csv", 0.7),
            ("xyz", "sales.csv", 0.0),
        ],
    )
    def test_tiers(self, query, name, expected):
        assert files_mod._fuzzy_score(query, name) == expected

    def test_subsequence_scores_between_tiers(self):
        score = files_mod._fuzzy_score("sls", "sales.csv")
        assert 0.3 < score < 0.7

    def test_tighter_subsequence_scores_higher(self):
        assert files_mod._fuzzy_score("sls", "sals.csv") > files_mod._fuzzy_score(
            "sls", "s_____a_____l_____s.csv"
        )


class TestBrowseContext:
    """get_browse_context decides what a caller may browse."""

    async def test_non_hub_uses_configured_allowlist(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "disabled")
        monkeypatch.setattr(settings, "allowed_file_paths", ["/data/a", "/data/b"])

        ctx = await get_browse_context(authorization=None)

        assert ctx.user_id is None
        assert [(g.path, g.read_only) for g in ctx.file_paths] == [
            ("/data/a", False),
            ("/data/b", False),
        ]

    async def test_non_hub_with_no_allowlist_grants_nothing(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "disabled")
        monkeypatch.setattr(settings, "allowed_file_paths", [])
        assert (await get_browse_context(authorization=None)).file_paths == []

    @pytest.fixture
    def hub_mode(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "hub")

    async def test_hub_requires_authorization_header(self, hub_mode):
        with pytest.raises(HTTPException) as exc:
            await get_browse_context(authorization=None)
        assert exc.value.status_code == 401

    @pytest.mark.parametrize("header", ["token-only", "Basic abc", "Bearer", ""])
    async def test_hub_rejects_malformed_authorization(self, hub_mode, header):
        with pytest.raises(HTTPException) as exc:
            await get_browse_context(authorization=header)
        assert exc.value.status_code == 401

    async def test_hub_without_client_is_503(self, hub_mode, monkeypatch):
        monkeypatch.setattr(files_mod, "get_hub_client", lambda: None)
        with pytest.raises(HTTPException) as exc:
            await get_browse_context(authorization="Bearer tok")
        assert exc.value.status_code == 503

    async def test_hub_denial_is_401_with_reason(self, hub_mode, monkeypatch):
        class Denying:
            async def authorize(self, **kwargs):
                return AuthorizationResult(authorized=False, error="Token expired")

        monkeypatch.setattr(files_mod, "get_hub_client", lambda: Denying())

        with pytest.raises(HTTPException) as exc:
            await get_browse_context(authorization="Bearer tok")

        assert exc.value.status_code == 401
        assert exc.value.detail == "Token expired"

    async def test_hub_grants_become_the_context(self, hub_mode, monkeypatch):
        seen: dict = {}

        class Allowing:
            async def authorize(self, **kwargs):
                seen.update(kwargs)
                return AuthorizationResult(
                    authorized=True,
                    user_id="u9",
                    file_paths=[FilePathGrant(path="/granted", read_only=True)],
                )

        monkeypatch.setattr(files_mod, "get_hub_client", lambda: Allowing())

        ctx = await get_browse_context(authorization="bearer tok-123")

        assert seen == {"server_token": "tok-123", "request_type": "browse"}
        assert ctx.user_id == "u9"
        assert [(g.path, g.read_only) for g in ctx.file_paths] == [("/granted", True)]

    async def test_hub_authorization_without_grants_browses_nothing(self, hub_mode, monkeypatch):
        class Bare:
            async def authorize(self, **kwargs):
                return AuthorizationResult(authorized=True)

        monkeypatch.setattr(files_mod, "get_hub_client", lambda: Bare())

        ctx = await get_browse_context(authorization="Bearer tok")

        assert ctx.file_paths == []
