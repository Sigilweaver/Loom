"""Workflow file and database stay consistent; bad uploads are 400, not 500."""

import json
from unittest.mock import patch

import pytest

from app.config import settings
from app.domain.workflows.parser import ParseError, WorkflowParser
from app.domain.workflows.store import WorkflowFileStore
from tests import db_helpers
from tests.conftest import make_workflow_content, new_client


def _with_meta(**changes: object) -> bytes:
    data = json.loads(make_workflow_content())
    for key, value in changes.items():
        if key.startswith("meta_"):
            data["meta"][key[5:]] = value
        else:
            data[key] = value
    return json.dumps(data).encode()


async def _upload(client, headers, content: bytes):
    return await client.post(
        "/api/v1/workflows",
        headers=headers,
        files={"file": ("wf.swwf", content, "application/octet-stream")},
        data={"folder_path": "/", "tags": ""},
    )


class TestParser:
    @pytest.mark.parametrize(
        "content",
        [
            _with_meta(version=1),
            _with_meta(meta_description=None),
            _with_meta(tools=[1]),
            _with_meta(meta_name=123),
            _with_meta(meta_name="x" * 256),
            _with_meta(meta_author="a" * 300),
        ],
    )
    def test_invalid_field_types_raise_parse_error(self, content):
        with pytest.raises(ParseError):
            WorkflowParser().parse(content)

    async def test_invalid_upload_is_400(self, user_headers):
        async with new_client() as client:
            response = await _upload(client, user_headers, _with_meta(version=1))
        assert response.status_code == 400
        assert "version" in response.json()["detail"]


class TestUpdate:
    async def test_failed_update_leaves_file_and_row_unchanged(self, user_headers):
        original = make_workflow_content(name="orig")
        async with new_client() as client:
            created = (await _upload(client, user_headers, original)).json()
            store = WorkflowFileStore(settings.workflow_storage_path)

            # The database rejects the commit after the file would be written.
            with patch(
                "sqlalchemy.ext.asyncio.AsyncSession.commit",
                side_effect=RuntimeError("database went away"),
            ):
                with pytest.raises(RuntimeError):
                    await client.put(
                        f"/api/v1/workflows/{created['id']}",
                        headers=user_headers,
                        files={
                            "file": (
                                "wf.swwf",
                                make_workflow_content(name="new"),
                                "application/octet-stream",
                            )
                        },
                    )

            fetched = (
                await client.get(f"/api/v1/workflows/{created['id']}", headers=user_headers)
            ).json()
        assert fetched["name"] == "orig"
        from uuid import UUID

        assert store.load(UUID(created["id"])) == original
        assert store.verify_checksum(UUID(created["id"]), store.calculate_checksum(original))

    def test_store_save_leaves_no_temp_file(self, temp_storage):
        from pathlib import Path
        from uuid import uuid4

        store = WorkflowFileStore(temp_storage)
        wid = uuid4()
        store.save(wid, b"one")
        store.save(wid, b"two", overwrite=True)
        assert store.load(wid) == b"two"
        assert [p.name for p in Path(temp_storage).iterdir()] == [f"{wid}.swwf"]


class TestDelete:
    async def test_workflow_with_executions_is_kept_with_409(self, user_headers):
        async with new_client() as client:
            created = (await _upload(client, user_headers, make_workflow_content())).json()
            server = await db_helpers.make_server()
            from uuid import UUID

            await db_helpers.make_execution(UUID(created["id"]), server.id)
            response = await client.delete(
                f"/api/v1/workflows/{created['id']}", headers=user_headers
            )
            assert response.status_code == 409
            assert "execution" in response.json()["detail"]
            download = await client.get(
                f"/api/v1/workflows/{created['id']}/download", headers=user_headers
            )
        assert download.status_code == 200

    async def test_unused_workflow_is_deleted_with_its_file(self, user_headers):
        from uuid import UUID

        async with new_client() as client:
            created = (await _upload(client, user_headers, make_workflow_content())).json()
            response = await client.delete(
                f"/api/v1/workflows/{created['id']}", headers=user_headers
            )
        assert response.status_code == 204
        store = WorkflowFileStore(settings.workflow_storage_path)
        assert not store.exists(UUID(created["id"]))


class TestDownload:
    async def test_non_latin1_name_downloads(self, user_headers):
        async with new_client() as client:
            created = (
                await _upload(
                    client, user_headers, make_workflow_content(name='Café 日本 "q"')
                )
            ).json()
            response = await client.get(
                f"/api/v1/workflows/{created['id']}/download", headers=user_headers
            )
        assert response.status_code == 200
        disposition = response.headers["content-disposition"]
        assert "filename*=UTF-8''Caf%C3%A9%20%E6%97%A5%E6%9C%AC%20%22q%22.swwf" in disposition
        assert 'filename="Caf_ __ _q_.swwf"' in disposition
