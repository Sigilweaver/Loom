"""Tests for manifest generation."""

import pytest
from lib.manifest_builder import ManifestBuilder, is_prerelease


class TestManifestBuilder:
    """Test manifest generation."""

    def test_stable_manifest_structure(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_stable_manifest("abc123")

        assert manifest["schemaVersion"] == 1
        assert manifest["channel"] == "stable"
        assert manifest["version"] == version
        assert manifest["commit"] == "abc123"
        assert "date" in manifest
        assert "assets" in manifest
        assert isinstance(manifest["assets"], list)

    def test_stable_manifest_excludes_checksums(
        self, sample_assets_dir, version, base_url
    ):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_stable_manifest("abc123")

        # Should not include SHA256SUMS.txt
        filenames = [asset["fileName"] for asset in manifest["assets"]]
        assert "SHA256SUMS.txt" not in filenames

    def test_asset_has_required_fields(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_stable_manifest("abc123")

        asset = manifest["assets"][0]
        assert "id" in asset
        assert "os" in asset
        assert "arch" in asset
        assert "kind" in asset
        assert "fileName" in asset
        assert "url" in asset
        assert "size" in asset
        assert "sha256" in asset

    def test_asset_url_construction(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_stable_manifest("abc123")

        # Find the web zip asset (iteration order is not guaranteed)
        asset = next(a for a in manifest["assets"] if a["fileName"].endswith(".zip"))
        assert asset["url"].startswith(base_url)
        assert f"/releases/loom/{version}/" in asset["url"]
        # URL should use the original versioned filename
        assert "Sigilweaver-Loom-Web-v0.2.5.zip" in asset["url"]
        # fileName should also keep the original versioned name
        assert asset["fileName"] == "Sigilweaver-Loom-Web-v0.2.5.zip"

    def test_downloads_manifest_structure(self, sample_assets_dir, version, base_url):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_downloads_manifest()

        assert manifest["schemaVersion"] == 1
        assert manifest["version"] == version
        assert "variants" in manifest
        assert "full" in manifest["variants"]
        assert "client" in manifest["variants"]
        assert "web" in manifest["variants"]

    def test_downloads_manifest_categorizes_variants(
        self, sample_assets_dir, version, base_url
    ):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        manifest = builder.build_downloads_manifest()

        # Check that Client files are in client variant
        client_files = [a["fileName"] for a in manifest["variants"]["client"]]
        assert any("Client" in f for f in client_files)

        # Check that Web files are in web variant
        web_files = [a["fileName"] for a in manifest["variants"]["web"]]
        assert any("Web" in f for f in web_files)

    def test_update_releases_index_creates_new(
        self, sample_assets_dir, version, base_url
    ):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)
        index = builder.update_releases_index(None)

        assert index["schemaVersion"] == 1
        assert index["latest"] == version
        assert len(index["releases"]) == 1
        assert index["releases"][0]["version"] == version
        assert "manifestUrl" in index["releases"][0]

    def test_update_releases_index_appends_release(
        self, sample_assets_dir, version, base_url
    ):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)

        existing = {
            "schemaVersion": 1,
            "generatedAt": "2025-01-01T00:00:00Z",
            "latest": "v0.2.4",
            "releases": [
                {
                    "version": "v0.2.4",
                    "date": "2025-01-01T00:00:00Z",
                    "manifestUrl": "https://example.com/releases/loom/v0.2.4/manifest.json",
                }
            ],
        }

        index = builder.update_releases_index(existing)

        assert index["latest"] == version
        assert len(index["releases"]) == 2
        versions = [r["version"] for r in index["releases"]]
        assert version in versions
        assert "v0.2.4" in versions

    def test_update_releases_index_replaces_duplicate(
        self, sample_assets_dir, version, base_url
    ):
        builder = ManifestBuilder(sample_assets_dir, version, base_url)

        existing = {
            "schemaVersion": 1,
            "generatedAt": "2025-01-01T00:00:00Z",
            "latest": version,
            "releases": [
                {
                    "version": version,
                    "date": "2025-01-01T00:00:00Z",
                    "manifestUrl": "https://example.com/old-url",
                }
            ],
        }

        index = builder.update_releases_index(existing)

        # Should still have only one entry for this version
        assert len(index["releases"]) == 1
        assert index["releases"][0]["version"] == version

    def test_update_releases_index_sorts_semver_numerically(
        self, sample_assets_dir, version, base_url
    ):
        """Versions like v0.10.2 must sort above v0.9.0 (numeric, not lexicographic)."""
        builder = ManifestBuilder(sample_assets_dir, "v0.10.2", base_url)

        existing = {
            "schemaVersion": 1,
            "generatedAt": "2025-01-01T00:00:00Z",
            "latest": "v0.9.0",
            "releases": [
                {
                    "version": "v0.9.0",
                    "date": "2025-06-01T00:00:00Z",
                    "manifestUrl": "https://example.com/releases/loom/v0.9.0/manifest.json",
                },
                {
                    "version": "v0.8.0",
                    "date": "2025-05-01T00:00:00Z",
                    "manifestUrl": "https://example.com/releases/loom/v0.8.0/manifest.json",
                },
            ],
        }

        index = builder.update_releases_index(existing)
        versions = [r["version"] for r in index["releases"]]
        assert versions == ["v0.10.2", "v0.9.0", "v0.8.0"]


class TestIsPrerelease:
    """Tags with a '-' suffix are pre-releases; plain semver tags are stable."""

    @pytest.mark.parametrize("tag", ["v0.13.0", "v1.0.0", "v10.20.30", "0.13.0"])
    def test_stable(self, tag):
        assert is_prerelease(tag) is False

    @pytest.mark.parametrize(
        "tag",
        ["v1.0.0-rc.1", "v0.13.0-beta.2", "v0.2.5-alpha", "1.0.0-rc.1", "v2.0.0-0"],
    )
    def test_prerelease(self, tag):
        assert is_prerelease(tag) is True


class TestPrereleaseHandling:
    """A pre-release must never become the stable download."""

    def test_manifest_channel_is_stable_for_stable_tag(self, sample_assets_dir, base_url):
        builder = ManifestBuilder(sample_assets_dir, "v0.13.0", base_url)
        assert builder.prerelease is False
        assert builder.build_stable_manifest("abc123")["channel"] == "stable"

    def test_manifest_channel_is_prerelease_for_suffixed_tag(
        self, sample_assets_dir, base_url
    ):
        builder = ManifestBuilder(sample_assets_dir, "v1.0.0-rc.1", base_url)
        assert builder.prerelease is True
        assert builder.build_stable_manifest("abc123")["channel"] == "prerelease"

    def test_forced_prerelease_on_plain_tag(self, sample_assets_dir, base_url):
        builder = ManifestBuilder(sample_assets_dir, "v0.13.0", base_url, prerelease=True)
        assert builder.prerelease is True
        assert builder.build_stable_manifest("abc123")["channel"] == "prerelease"

    def test_update_index_rejects_prerelease(self, sample_assets_dir, base_url):
        builder = ManifestBuilder(sample_assets_dir, "v1.0.0-rc.1", base_url)
        with pytest.raises(ValueError, match="pre-release"):
            builder.update_releases_index(None)

    def test_update_index_rejects_forced_prerelease(self, sample_assets_dir, base_url):
        builder = ManifestBuilder(sample_assets_dir, "v0.13.0", base_url, prerelease=True)
        with pytest.raises(ValueError, match="pre-release"):
            builder.update_releases_index(None)

    def test_latest_is_newest_stable_when_index_holds_prereleases(
        self, sample_assets_dir, base_url
    ):
        """Legacy prerelease entries must not be picked as 'latest'."""
        builder = ManifestBuilder(sample_assets_dir, "v0.13.0", base_url)
        existing = {
            "schemaVersion": 1,
            "generatedAt": "2025-01-01T00:00:00Z",
            "latest": "v0.14.0-rc.1",
            "releases": [
                {
                    "version": "v0.14.0-rc.1",
                    "date": "2025-01-01T00:00:00Z",
                    "manifestUrl": "https://example.com/rc",
                },
            ],
        }

        index = builder.update_releases_index(existing)
        assert index["latest"] == "v0.13.0"
        assert [r["version"] for r in index["releases"]] == ["v0.14.0-rc.1", "v0.13.0"]

    def test_reuploading_older_stable_keeps_latest(self, sample_assets_dir, base_url):
        builder = ManifestBuilder(sample_assets_dir, "v0.12.0", base_url)
        existing = {
            "schemaVersion": 1,
            "generatedAt": "2025-01-01T00:00:00Z",
            "latest": "v0.13.0",
            "releases": [
                {
                    "version": "v0.13.0",
                    "date": "2025-01-01T00:00:00Z",
                    "manifestUrl": "https://example.com/13",
                },
            ],
        }

        index = builder.update_releases_index(existing)
        assert index["latest"] == "v0.13.0"
        assert [r["version"] for r in index["releases"]] == ["v0.13.0", "v0.12.0"]
