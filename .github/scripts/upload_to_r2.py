#!/usr/bin/env python3
"""
Upload Sigilweaver Loom release to Cloudflare R2.

This script handles:
- Uploading release assets to R2
- Generating and uploading manifests (per-version manifest, downloads, index)
- Atomic updates via staging pattern
- All assets uploaded to versioned releases/loom/{version}/ paths

Pre-releases (a tag with a '-' suffix such as v1.0.0-rc.1, or --prerelease) are
uploaded to their versioned path only. The releases index, which the website
reads to find the latest stable download, is left untouched.

Usage:
    ./upload_to_r2.py v0.2.5-alpha release-assets/
    ./upload_to_r2.py v0.2.5-alpha release-assets/ --dry-run
    ./upload_to_r2.py v0.13.0 release-assets/ --prerelease

Environment variables required:
    R2_ACCESS_KEY_ID: R2 access key ID
    R2_SECRET_ACCESS_KEY: R2 secret access key
    R2_BUCKET_NAME: R2 bucket name (e.g., sigilweaver-loom-downloads)
    R2_ENDPOINT_URL: R2 S3 endpoint (e.g., https://<account_id>.r2.cloudflarestorage.com)
    R2_CDN_URL: Public CDN URL for downloads (optional, e.g., https://download.sigilweaver.app)
    GITHUB_SHA: Git commit SHA (optional, defaults to 'unknown')
"""

import argparse
import os
import sys
from pathlib import Path

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.manifest_builder import ManifestBuilder, is_prerelease
from lib.r2_uploader import R2Uploader


def main():
    parser = argparse.ArgumentParser(
        description="Upload Sigilweaver Loom release to Cloudflare R2",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("version", help="Release version (e.g., v0.2.5-alpha)")
    parser.add_argument(
        "assets_dir", type=Path, help="Directory containing release assets"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Print actions without executing uploads"
    )

    parser.add_argument(
        "--prerelease",
        action="store_true",
        help=(
            "Treat the release as a pre-release even if the tag has no '-' suffix "
            "(tags with a '-' suffix are always pre-releases)"
        ),
    )

    args = parser.parse_args()
    prerelease = args.prerelease or is_prerelease(args.version)

    # Validate assets directory
    if not args.assets_dir.exists():
        print(f"Error: Assets directory not found: {args.assets_dir}")
        return 1

    if not args.assets_dir.is_dir():
        print(f"Error: Not a directory: {args.assets_dir}")
        return 1

    # Check for required environment variables (unless dry-run)
    if not args.dry_run:
        required_env = [
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_BUCKET_NAME",
            "R2_ENDPOINT_URL",
        ]
        missing = [var for var in required_env if not os.environ.get(var)]
        if missing:
            print("Error: Missing required environment variables:")
            for var in missing:
                print(f"  - {var}")
            return 1

    print(f"Uploading Sigilweaver Loom {args.version}")
    print(f"Assets directory: {args.assets_dir}")
    if prerelease:
        print("Pre-release: the releases index will NOT be updated")
    if args.dry_run:
        print("DRY-RUN MODE - No uploads will be performed")
    print()

    try:
        # Initialize uploader
        uploader = R2Uploader(dry_run=args.dry_run)
        base_url = uploader.get_base_url()

        # Initialize manifest builder
        commit_sha = os.environ.get("GITHUB_SHA", "unknown")
        builder = ManifestBuilder(
            args.assets_dir, args.version, base_url, prerelease=prerelease
        )

        # Step 1: Upload release assets
        print("Step 1: Uploading release assets...")
        uploader.upload_assets(args.assets_dir, args.version)
        print()

        # Step 2: Generate and upload the per-version manifest
        print("Step 2: Uploading release manifest...")
        stable_manifest = builder.build_stable_manifest(commit_sha)

        # Upload to versioned location (immutable)
        uploader.upload_manifest_atomic(
            stable_manifest,
            f"releases/loom/{args.version}/manifest.json",
            cache_control="max-age=31536000,public,immutable",
        )
        print()

        # Step 3: Generate and upload downloads manifest
        print("Step 3: Uploading downloads manifest...")
        downloads_manifest = builder.build_downloads_manifest()

        # Upload to versioned location
        uploader.upload_manifest_atomic(
            downloads_manifest,
            f"releases/loom/{args.version}/downloads.json",
            cache_control="max-age=31536000,public,immutable",
        )
        print()

        # Step 4: Update releases index (stable releases only)
        if prerelease:
            print("Step 4: Skipping releases index update (pre-release)")
        else:
            print("Step 4: Updating releases index...")
            existing_index = uploader.download_json("releases/loom/index.json")
            updated_index = builder.update_releases_index(existing_index)

            uploader.upload_manifest_atomic(
                updated_index,
                "releases/loom/index.json",
                cache_control="max-age=300,public",
            )
        print()

        # Step 5: Clean up staging files
        print("Step 5: Cleaning up staging files...")
        uploader.cleanup_staging_files()
        print()

        print(f"SUCCESS: Release {args.version} uploaded successfully!")
        print()
        print("Download URLs:")
        print(f"  Release assets: {base_url}/releases/loom/{args.version}/")
        print(f"  Release manifest: {base_url}/releases/loom/{args.version}/manifest.json")
        print(
            f"  Downloads manifest: {base_url}/releases/loom/{args.version}/downloads.json"
        )
        if not prerelease:
            print(f"  Releases index: {base_url}/releases/loom/index.json")

        return 0

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        if args.dry_run:
            print("(Error occurred in dry-run mode - actual execution may differ)")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
