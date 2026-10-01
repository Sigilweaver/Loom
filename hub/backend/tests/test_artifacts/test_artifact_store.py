"""Unit tests for the content-addressed artifact store and CSV serialization.

These tests exercise pure filesystem/serialization logic and do not require a
database.
"""

import hashlib
import tempfile

import pytest

from app.domain.artifacts.service import serialize_rows_to_csv
from app.domain.artifacts.store import (
    ArtifactCorruptedError,
    ArtifactNotFoundError,
    ArtifactStore,
    ArtifactStoreError,
)


class TestArtifactStore:
    def test_put_is_content_addressed(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = ArtifactStore(root=tmp)
            data = b"hello, loom"
            sha256, size = store.put_bytes(data)

            assert sha256 == hashlib.sha256(data).hexdigest()
            assert size == len(data)
            # On-disk path is sharded by the first byte of the digest.
            assert store.path_for(sha256).exists()
            assert store.path_for(sha256).parent.name == sha256[:2]
            assert store.path_for(sha256).name == sha256[2:]

    def test_put_is_idempotent_and_dedups(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = ArtifactStore(root=tmp)
            data = b"duplicate"
            sha1, _ = store.put_bytes(data)
            sha2, _ = store.put_bytes(data)
            assert sha1 == sha2
            # Only a single blob file exists for identical content.
            blobs = [p for p in (store.root).rglob("*") if p.is_file()]
            assert len(blobs) == 1

    def test_verify_detects_corruption(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = ArtifactStore(root=tmp)
            sha256, _ = store.put_bytes(b"original content")
            assert store.verify(sha256) is True

            # Tamper with the stored blob.
            store.path_for(sha256).write_bytes(b"tampered content!")
            assert store.verify(sha256) is False

    def test_open_stream_verifies_before_yielding(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = ArtifactStore(root=tmp)
            payload = b"a" * (200 * 1024)  # multiple chunks
            sha256, _ = store.put_bytes(payload)

            streamed = b"".join(store.open_stream(sha256, verify=True))
            assert streamed == payload

            store.path_for(sha256).write_bytes(b"corrupt")
            with pytest.raises(ArtifactCorruptedError):
                list(store.open_stream(sha256, verify=True))

    def test_missing_blob_raises_not_found(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = ArtifactStore(root=tmp)
            missing = "0" * 64
            assert store.exists(missing) is False
            with pytest.raises(ArtifactNotFoundError):
                store.size(missing)
            with pytest.raises(ArtifactNotFoundError):
                list(store.open_stream(missing))

    @pytest.mark.parametrize(
        "bad",
        [
            "",
            "not-a-digest",
            "../../etc/passwd",
            "g" * 64,  # non-hex
            "a" * 63,  # too short
            "a" * 65,  # too long
        ],
    )
    def test_invalid_digest_is_rejected(self, bad):
        with tempfile.TemporaryDirectory() as tmp:
            store = ArtifactStore(root=tmp)
            with pytest.raises(ArtifactStoreError):
                store.path_for(bad)


class TestCsvSerialization:
    def test_rows_serialize_with_header(self):
        rows = [
            {"a": 1, "b": "x"},
            {"a": 2, "b": "y"},
        ]
        schema = {"columns": [{"name": "a"}, {"name": "b"}]}
        csv_bytes = serialize_rows_to_csv(rows, schema)
        assert csv_bytes == b"a,b\n1,x\n2,y\n"

    def test_empty_output_uses_schema_for_header(self):
        schema = {"columns": [{"name": "id"}, {"name": "value"}]}
        csv_bytes = serialize_rows_to_csv([], schema)
        assert csv_bytes == b"id,value\n"

    def test_header_falls_back_to_first_row_when_no_schema(self):
        rows = [{"name": "loom", "count": 3}]
        csv_bytes = serialize_rows_to_csv(rows, None)
        assert csv_bytes == b"name,count\nloom,3\n"

    def test_none_values_become_empty_cells(self):
        rows = [{"a": None, "b": "ok"}]
        schema = {"columns": [{"name": "a"}, {"name": "b"}]}
        csv_bytes = serialize_rows_to_csv(rows, schema)
        assert csv_bytes == b"a,b\n,ok\n"
