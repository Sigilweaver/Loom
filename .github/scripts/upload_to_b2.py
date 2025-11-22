#!/usr/bin/env python3
"""
Upload Sigilweaver release to Backblaze B2.

This script handles:
- Uploading release assets to B2
- Generating and uploading manifests (stable channel, downloads, index)
- Atomic updates via staging pattern
- Both latest/ and versioned releases/{version}/ paths

Usage:
    ./upload_to_b2.py v0.2.5-alpha release-assets/
    ./upload_to_b2.py v0.2.5-alpha release-assets/ --dry-run

Environment variables required:
    B2_APPLICATION_KEY_ID: B2 application key ID
    B2_APPLICATION_KEY: B2 application key
    B2_BUCKET_NAME: B2 bucket name (e.g., sigilweaver-downloads)
    B2_ENDPOINT_URL: B2 S3 endpoint for uploads (e.g., s3.us-east-005.backblazeb2.com)
    B2_CDN_URL: Public CDN URL for downloads (optional, e.g., https://download.sigilweaver.app)
    GITHUB_SHA: Git commit SHA (optional, defaults to 'unknown')
"""

import argparse
import os
import sys
from pathlib import Path

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.b2_uploader import B2Uploader
from lib.manifest_builder import ManifestBuilder


def main():
    parser = argparse.ArgumentParser(
        description='Upload Sigilweaver release to Backblaze B2',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        'version',
        help='Release version (e.g., v0.2.5-alpha)'
    )
    parser.add_argument(
        'assets_dir',
        type=Path,
        help='Directory containing release assets'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print actions without executing uploads'
    )
    
    args = parser.parse_args()
    
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
            'B2_APPLICATION_KEY_ID',
            'B2_APPLICATION_KEY',
            'B2_BUCKET_NAME',
            'B2_ENDPOINT_URL'
        ]
        missing = [var for var in required_env if not os.environ.get(var)]
        if missing:
            print("Error: Missing required environment variables:")
            for var in missing:
                print(f"  - {var}")
            return 1
    
    print(f"Uploading Sigilweaver {args.version}")
    print(f"Assets directory: {args.assets_dir}")
    if args.dry_run:
        print("DRY-RUN MODE - No uploads will be performed")
    print()
    
    try:
        # Initialize uploader
        uploader = B2Uploader(dry_run=args.dry_run)
        base_url = uploader.get_base_url()
        
        # Initialize manifest builder
        commit_sha = os.environ.get('GITHUB_SHA', 'unknown')
        builder = ManifestBuilder(args.assets_dir, args.version, base_url)
        
        # Step 1: Upload release assets
        print("Step 1: Uploading release assets...")
        uploader.upload_assets(args.assets_dir, args.version)
        print()
        
        # Step 2: Upload checksums
        print("Step 2: Uploading checksums...")
        checksums_file = args.assets_dir / 'SHA256SUMS.txt'
        if checksums_file.exists():
            uploader.upload_checksums(checksums_file)
        else:
            print("Warning: SHA256SUMS.txt not found, skipping")
        print()
        
        # Step 3: Generate and upload stable manifest
        print("Step 3: Uploading stable channel manifest...")
        stable_manifest = builder.build_stable_manifest(commit_sha)
        
        # Upload to latest/stable/manifest.json (atomic)
        uploader.upload_manifest_atomic(
            stable_manifest,
            'latest/stable/manifest.json',
            cache_control='max-age=60,public'
        )
        
        # Upload to versioned location (immutable)
        uploader.upload_manifest_atomic(
            stable_manifest,
            f'releases/{args.version}/manifest.json',
            cache_control='max-age=31536000,public,immutable'
        )
        print()
        
        # Step 4: Generate and upload downloads manifest
        print("Step 4: Uploading downloads manifest...")
        downloads_manifest = builder.build_downloads_manifest()
        
        # Upload to latest/downloads.json
        uploader.upload_manifest_atomic(
            downloads_manifest,
            'latest/downloads.json',
            cache_control='max-age=60,public'
        )
        
        # Upload to versioned location
        uploader.upload_manifest_atomic(
            downloads_manifest,
            f'releases/{args.version}/downloads.json',
            cache_control='max-age=31536000,public,immutable'
        )
        print()
        
        # Step 5: Update releases index
        print("Step 5: Updating releases index...")
        existing_index = uploader.download_json('releases/index.json')
        updated_index = builder.update_releases_index(existing_index)
        
        uploader.upload_manifest_atomic(
            updated_index,
            'releases/index.json',
            cache_control='max-age=300,public'
        )
        print()
        
        # Step 6: Clean up staging files
        print("Step 6: Cleaning up staging files...")
        uploader.cleanup_staging_files()
        print()
        
        print(f"SUCCESS: Release {args.version} uploaded successfully!")
        print()
        print("Download URLs:")
        print(f"  Latest: {base_url}/latest/")
        print(f"  Versioned: {base_url}/releases/{args.version}/")
        print(f"  Stable manifest: {base_url}/latest/stable/manifest.json")
        print(f"  Downloads manifest: {base_url}/latest/downloads.json")
        print(f"  Releases index: {base_url}/releases/index.json")
        
        return 0
        
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        if args.dry_run:
            print("(Error occurred in dry-run mode - actual execution may differ)")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
