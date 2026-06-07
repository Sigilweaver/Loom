#!/usr/bin/env python3
"""Generate downloads.json manifest for R2 bucket"""

import hashlib
import json
import os
import sys
from pathlib import Path

# Add lib directory to path for strip_version_from_filename
sys.path.insert(0, str(Path(__file__).parent))
from lib.manifest_builder import strip_version_from_filename


def main():
    version = os.environ["GITHUB_REF_NAME"]
    date = os.environ.get("NOW_ISO", "")
    commit = os.environ["GITHUB_SHA"]
    bucket = os.environ["R2_BUCKET_NAME"]
    endpoint = os.environ["R2_ENDPOINT_URL"]

    # Collect file info
    files_info = {}
    assets_dir = Path("release-assets")

    for f in assets_dir.glob("*"):
        if (
            f.is_file()
            and f.name not in ["SHA256SUMS.txt"]
            and not f.name.startswith(".")
        ):
            # Strip version from filename to get generic name (use shared library)
            generic = strip_version_from_filename(f.name)

            size = f.stat().st_size
            sha256 = hashlib.sha256(f.read_bytes()).hexdigest()
            files_info[generic] = {"size": size, "sha256": sha256}

    def add_file(type_val, label, filename):
        """Helper to create file entry if it exists"""
        if filename not in files_info:
            return None
        info = files_info[filename]
        return {
            "type": type_val,
            "label": label,
            "fileName": filename,
            "url": f"{os.environ.get('R2_CDN_URL', f'https://{bucket}.{endpoint}')}/releases/loom/latest/{filename}",
            "size": info["size"],
            "sha256": info["sha256"],
        }

    # Build downloads manifest
    downloads = {
        "schemaVersion": 1,
        "version": version,
        "date": date,
        "commit": commit,
        "downloads": {
            "full": {
                "name": "Sigilweaver Loom",
                "description": "Complete application with embedded server",
                "windows": list(
                    filter(
                        None,
                        [
                            add_file(
                                "installer",
                                "Windows Installer",
                                "Sigilweaver-Loom-Setup.exe",
                            ),
                            add_file(
                                "portable",
                                "Windows Portable",
                                "Sigilweaver-Loom-Portable.exe",
                            ),
                        ],
                    )
                ),
                "linux": list(
                    filter(
                        None,
                        [
                            add_file(
                                "appimage", "AppImage", "Sigilweaver-Loom-x64.AppImage"
                            ),
                            add_file("snap", "Snap Package", "Sigilweaver-Loom-x64.snap"),
                        ],
                    )
                ),
                "macos": list(
                    filter(
                        None,
                        [
                            add_file("dmg", "macOS Disk Image", "Sigilweaver-Loom.dmg"),
                        ],
                    )
                ),
            },
            "client": {
                "name": "Sigilweaver Loom Client",
                "description": "Studio only (requires separate server)",
                "windows": list(
                    filter(
                        None,
                        [
                            add_file(
                                "installer",
                                "Windows Installer",
                                "Sigilweaver-Loom-Client-Setup.exe",
                            ),
                            add_file(
                                "portable",
                                "Windows Portable",
                                "Sigilweaver-Loom-Client-Portable.exe",
                            ),
                        ],
                    )
                ),
                "linux": list(
                    filter(
                        None,
                        [
                            add_file(
                                "appimage",
                                "AppImage",
                                "Sigilweaver-Loom-Client-x64.AppImage",
                            ),
                            add_file(
                                "snap", "Snap Package", "Sigilweaver-Loom-Client-x64.snap"
                            ),
                        ],
                    )
                ),
                "macos": list(
                    filter(
                        None,
                        [
                            add_file(
                                "dmg", "macOS Disk Image", "Sigilweaver-Loom-Client.dmg"
                            ),
                        ],
                    )
                ),
            },
            "web": {
                "name": "Sigilweaver Loom Web",
                "description": "Self-hosted web application",
                "archive": list(
                    filter(
                        None,
                        [
                            add_file("zip", "Web Archive", "Sigilweaver-Loom-Web.zip"),
                        ],
                    )
                ),
            },
        },
    }

    # Write to file
    output_file = assets_dir / "manifests" / "downloads.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w") as f:
        json.dump(downloads, f, indent=2)

    print(f"Generated {output_file}")
    print(f"Version: {version}")
    print(
        f"Files included: {len([f for files in [d.get('windows', []) + d.get('linux', []) + d.get('macos', []) + d.get('archive', []) for d in downloads['downloads'].values()] for f in files])}"
    )


if __name__ == "__main__":
    main()
