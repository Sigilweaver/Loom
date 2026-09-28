"""Tests for the upload_to_r2.py entry point (no network: R2Uploader is faked)."""

import json
import sys

import pytest
import upload_to_r2


class FakeUploader:
    """Records what would be written to R2."""

    instances: list["FakeUploader"] = []

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.manifests: dict[str, dict] = {}
        self.assets_uploaded = False
        self.index_downloaded = False
        FakeUploader.instances.append(self)

    def get_base_url(self) -> str:
        return "https://cdn.example.com"

    def upload_assets(self, assets_dir, version):
        self.assets_uploaded = True

    def upload_manifest_atomic(self, manifest_data, key, cache_control="max-age=60,public"):
        # Round-trip through JSON to prove the payload is serializable.
        self.manifests[key] = json.loads(json.dumps(manifest_data))

    def download_json(self, key):
        self.index_downloaded = True
        return None

    def cleanup_staging_files(self):
        pass


@pytest.fixture
def fake_uploader(monkeypatch):
    FakeUploader.instances = []
    monkeypatch.setattr(upload_to_r2, "R2Uploader", FakeUploader)
    for var in (
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME",
        "R2_ENDPOINT_URL",
    ):
        monkeypatch.setenv(var, "x")
    return FakeUploader


def run(monkeypatch, *argv):
    monkeypatch.setattr(sys, "argv", ["upload_to_r2.py", *argv])
    return upload_to_r2.main()


def test_stable_release_updates_index(monkeypatch, fake_uploader, sample_assets_dir):
    assert run(monkeypatch, "v0.13.0", str(sample_assets_dir)) == 0

    uploader = fake_uploader.instances[0]
    assert uploader.assets_uploaded
    assert uploader.index_downloaded
    index = uploader.manifests["releases/loom/index.json"]
    assert index["latest"] == "v0.13.0"
    assert uploader.manifests["releases/loom/v0.13.0/manifest.json"]["channel"] == "stable"


def test_prerelease_tag_skips_index(monkeypatch, fake_uploader, sample_assets_dir):
    assert run(monkeypatch, "v1.0.0-rc.1", str(sample_assets_dir)) == 0

    uploader = fake_uploader.instances[0]
    assert uploader.assets_uploaded
    assert "releases/loom/index.json" not in uploader.manifests
    assert not uploader.index_downloaded
    manifest = uploader.manifests["releases/loom/v1.0.0-rc.1/manifest.json"]
    assert manifest["channel"] == "prerelease"
    assert "releases/loom/v1.0.0-rc.1/downloads.json" in uploader.manifests


def test_prerelease_flag_skips_index_for_plain_tag(
    monkeypatch, fake_uploader, sample_assets_dir
):
    assert run(monkeypatch, "v0.13.0", str(sample_assets_dir), "--prerelease") == 0

    uploader = fake_uploader.instances[0]
    assert "releases/loom/index.json" not in uploader.manifests
    manifest = uploader.manifests["releases/loom/v0.13.0/manifest.json"]
    assert manifest["channel"] == "prerelease"


def test_missing_assets_dir_fails(monkeypatch, fake_uploader, tmp_path):
    assert run(monkeypatch, "v0.13.0", str(tmp_path / "nope")) == 1
