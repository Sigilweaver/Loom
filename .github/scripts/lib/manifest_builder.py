"""
Manifest generation for release assets.

Builds JSON manifests for stable channel and downloads page.
"""

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

from .asset_detector import detect_asset_type, is_variant


def _version_sort_key(version: str) -> tuple:
    """
    Parse a version string into a tuple of ints for correct numeric sorting.

    Strips a leading 'v', splits on '.', and converts each segment to int.
    A pre-release suffix (e.g. '-alpha') sorts before the bare release by
    appending 0 for pre-release vs 1 for stable.

    Examples:
        'v0.10.2'       -> (0, 10, 2, 1)
        'v0.9.0'        -> (0, 9, 0, 1)
        'v0.10.2-alpha' -> (0, 10, 2, 0)
    """
    v = version.lstrip("v")
    # Separate pre-release suffix
    if "-" in v:
        v, _ = v.split("-", 1)
        pre_release = 0
    else:
        pre_release = 1
    parts = tuple(int(x) for x in v.split("."))
    return parts + (pre_release,)


def is_prerelease(version: str) -> bool:
    """
    Return True when a release tag is a pre-release (e.g. 'v1.0.0-rc.1').

    A tag is a pre-release when it carries a semver pre-release suffix, i.e.
    anything after a '-' following the leading 'v'. This mirrors the rule in
    the release workflow, which marks the GitHub release as a pre-release for
    the same tags. Pre-releases must never become the 'latest' stable release.
    """
    return "-" in version.lstrip("v")


def strip_version_from_filename(filename: str) -> str:
    """
    Strip version string from filename.

    Examples:
        Sigilweaver-Loom-Setup-v0.3.0-alpha.exe -> Sigilweaver-Loom-Setup.exe
        Sigilweaver-Loom-v0.3.0-alpha-x64.AppImage -> Sigilweaver-Loom-x64.AppImage
        Sigilweaver-Loom-Client-v0.3.0-alpha-x64.snap -> Sigilweaver-Loom-Client-x64.snap
    """
    path = Path(filename)
    name = path.stem
    ext = path.suffix

    # Remove version pattern: -vX.Y.Z[-prerelease] from name
    name_no_version = re.sub(
        r"-v\d+\.\d+\.\d+(?:-[a-z][a-z0-9]*(?:\.[a-z0-9]+)*)?",
        "",
        name,
        flags=re.IGNORECASE,
    )

    # Reconstruct with extension
    return name_no_version + ext


class ManifestBuilder:
    """Builds release manifest JSON files."""

    def __init__(
        self,
        assets_dir: Path,
        version: str,
        base_url: str,
        prerelease: bool = False,
    ):
        """
        Initialize manifest builder.

        Args:
            assets_dir: Directory containing release assets
            version: Release version (e.g., 'v0.2.5-alpha')
            base_url: Base URL for asset downloads (e.g., 'https://bucket.endpoint.com')
            prerelease: Force pre-release handling. A version with a pre-release
                suffix (see is_prerelease) is always treated as a pre-release.
        """
        self.assets_dir = Path(assets_dir)
        self.version = version
        self.base_url = base_url.rstrip("/")
        self.prerelease = prerelease or is_prerelease(version)
        # Path prefix for all assets in this release
        self.path_prefix = f"releases/loom/{version}"

    def build_stable_manifest(self, commit_sha: str) -> Dict:
        """
        Build stable channel manifest.

        Args:
            commit_sha: Git commit SHA for this release

        Returns:
            Manifest dictionary ready for JSON serialization
        """
        assets = []

        for file in self.assets_dir.iterdir():
            if not file.is_file():
                continue

            # Skip checksums and manifest files
            if file.name in ("SHA256SUMS.txt", "downloads.json"):
                continue

            asset_info = self._build_asset_info(file, path_prefix=self.path_prefix)
            if asset_info:
                assets.append(asset_info)

        return {
            "schemaVersion": 1,
            "channel": "prerelease" if self.prerelease else "stable",
            "version": self.version,
            "date": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "commit": commit_sha,
            "assets": assets,
        }

    def build_downloads_manifest(self) -> Dict:
        """
        Build downloads.json manifest for website.

        Returns:
            Downloads manifest dictionary
        """
        full_assets = []
        client_assets = []
        web_assets = []
        tauri_assets = []

        for file in self.assets_dir.iterdir():
            if not file.is_file():
                continue

            # Skip checksums
            if file.name == "SHA256SUMS.txt":
                continue

            if is_variant(file.name, "Client"):
                asset_info = self._build_asset_info(file, path_prefix=self.path_prefix)
                if asset_info:
                    client_assets.append(asset_info)
            elif is_variant(file.name, "Web"):
                asset_info = self._build_asset_info(file, path_prefix=self.path_prefix)
                if asset_info:
                    web_assets.append(asset_info)
            elif is_variant(file.name, "Tauri"):
                asset_info = self._build_asset_info(file, path_prefix=self.path_prefix)
                if asset_info:
                    tauri_assets.append(asset_info)
            else:
                asset_info = self._build_asset_info(file, path_prefix=self.path_prefix)
                if asset_info:
                    full_assets.append(asset_info)

        return {
            "schemaVersion": 1,
            "version": self.version,
            "date": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "variants": {
                "full": full_assets,
                "client": client_assets,
                "tauri": tauri_assets,
                "web": web_assets,
            },
        }

    def _build_asset_info(self, file: Path, path_prefix: str) -> Optional[Dict]:
        """
        Build asset information dictionary.

        Args:
            file: Path to asset file
            path_prefix: URL path prefix (e.g., 'releases/loom/v0.2.5')

        Returns:
            Asset info dictionary or None if file should be skipped
        """
        type_info = detect_asset_type(file.name)

        # Compute SHA256
        sha256_hash = hashlib.sha256()
        with open(file, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256_hash.update(chunk)

        # Always use the original filename
        url_filename = file.name

        return {
            "id": type_info["id"],
            "os": type_info["os"],
            "arch": "x64",  # All our builds are x64 for now
            "kind": type_info["kind"],
            "fileName": file.name,  # Keep original for reference
            "url": f"{self.base_url}/{path_prefix}/{url_filename}",
            "size": file.stat().st_size,
            "sha256": sha256_hash.hexdigest(),
        }

    def update_releases_index(self, existing_index: Optional[Dict] = None) -> Dict:
        """
        Update releases/index.json with new release.

        The index is what the website and update checks read to find the
        latest stable download, so a pre-release must never be added to it.
        ``latest`` always points at the highest stable version in the index,
        so re-uploading an older release cannot roll it back.

        Args:
            existing_index: Existing index.json content or None

        Returns:
            Updated index dictionary

        Raises:
            ValueError: if this builder's version is a pre-release
        """
        if self.prerelease:
            raise ValueError(
                f"{self.version} is a pre-release and must not be added to the "
                "releases index"
            )

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        if existing_index is None:
            existing_index = {"releases": []}

        # Remove any existing entry for this version
        releases = [
            r
            for r in existing_index.get("releases", [])
            if r["version"] != self.version
        ]

        # Add new release entry
        releases.append(
            {
                "version": self.version,
                "date": now,
                "manifestUrl": f"{self.base_url}/releases/loom/{self.version}/manifest.json",
            }
        )

        # Sort by version (newest first) using numeric semver comparison
        releases.sort(key=lambda r: _version_sort_key(r["version"]), reverse=True)

        # The newest stable entry is "latest". Stable is always present (this
        # release), so the fallback is never used.
        latest = next(
            (r["version"] for r in releases if not is_prerelease(r["version"])),
            self.version,
        )

        return {
            "schemaVersion": 1,
            "generatedAt": now,
            "latest": latest,
            "releases": releases,
        }
