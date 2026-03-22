#!/usr/bin/env python3
"""
Clean up old file versions from R2 bucket.

R2 can keep old versions when files are re-uploaded.
This script deletes old versions to reduce storage costs.

Usage:
    export R2_ACCESS_KEY_ID="..."
    export R2_SECRET_ACCESS_KEY="..."
    export R2_BUCKET_NAME="sigilweaver-loom-downloads"
    export R2_ENDPOINT_URL="https://<account_id>.r2.cloudflarestorage.com"

    # Dry-run to see what would be deleted
    python3 cleanup-r2-versions.py --dry-run

    # Actually delete old versions
    python3 cleanup-r2-versions.py

    # Clean up only specific prefix
    python3 cleanup-r2-versions.py --prefix latest/
"""

import argparse
import os
import sys

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("Error: boto3 not installed. Install with: uv add boto3")
    sys.exit(1)


def cleanup_old_versions(prefix="", dry_run=False):
    """Clean up old file versions from R2."""
    key_id = os.environ.get("R2_ACCESS_KEY_ID")
    key = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket = os.environ.get("R2_BUCKET_NAME")
    endpoint = os.environ.get("R2_ENDPOINT_URL")

    if not all([key_id, key, bucket, endpoint]):
        print("Error: Missing environment variables:")
        print("  R2_ACCESS_KEY_ID")
        print("  R2_SECRET_ACCESS_KEY")
        print("  R2_BUCKET_NAME")
        print("  R2_ENDPOINT_URL")
        return 1

    # R2 endpoint is already a full URL
    endpoint_url = (
        endpoint if endpoint.startswith("https://") else f"https://{endpoint}"
    )

    # Create S3 client
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=key_id,
        aws_secret_access_key=key,
        region_name="auto",
        config=boto3.session.Config(
            signature_version="s3v4", s3={"addressing_style": "path"}
        ),
    )

    print(f"Bucket: {bucket}")
    print(f"Endpoint: {endpoint_url}")
    if prefix:
        print(f"Prefix: {prefix}")
    if dry_run:
        print("DRY-RUN MODE - No versions will be deleted")
    print()

    try:
        # List all object versions
        paginator = s3.get_paginator("list_object_versions")

        total_versions = 0
        total_deleted = 0
        files_with_multiple_versions = {}

        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            # Process non-current versions
            if "Versions" in page:
                for version in page["Versions"]:
                    key_name = version["Key"]
                    version_id = version["VersionId"]
                    is_latest = version.get("IsLatest", False)
                    size = version["Size"]
                    last_modified = version["LastModified"]

                    # Track all versions
                    if key_name not in files_with_multiple_versions:
                        files_with_multiple_versions[key_name] = []
                    files_with_multiple_versions[key_name].append(
                        {
                            "version_id": version_id,
                            "is_latest": is_latest,
                            "size": size,
                            "modified": last_modified,
                        }
                    )

                    total_versions += 1

            # Process delete markers
            if "DeleteMarkers" in page:
                for marker in page["DeleteMarkers"]:
                    key_name = marker["Key"]
                    version_id = marker["VersionId"]

                    if key_name not in files_with_multiple_versions:
                        files_with_multiple_versions[key_name] = []
                    files_with_multiple_versions[key_name].append(
                        {
                            "version_id": version_id,
                            "is_latest": marker.get("IsLatest", False),
                            "size": 0,
                            "modified": marker["LastModified"],
                            "delete_marker": True,
                        }
                    )

                    total_versions += 1

        # Find files with multiple versions
        print(f"Total objects scanned: {len(files_with_multiple_versions)}")
        print(f"Total versions found: {total_versions}")
        print()

        files_to_clean = {
            k: v for k, v in files_with_multiple_versions.items() if len(v) > 1
        }

        if not files_to_clean:
            print("No files with multiple versions found!")
            return 0

        print(f"Found {len(files_to_clean)} files with multiple versions:")
        print()

        for key_name, versions in sorted(files_to_clean.items()):
            versions_sorted = sorted(
                versions, key=lambda x: x["modified"], reverse=True
            )
            latest = versions_sorted[0]
            old_versions = versions_sorted[1:]

            print(f"{key_name}")
            print(f"  Latest:  {latest['modified']} ({latest['size']:,} bytes)")
            print(f"  Old versions: {len(old_versions)}")

            for old in old_versions:
                is_delete_marker = old.get("delete_marker", False)
                marker_text = " [DELETE MARKER]" if is_delete_marker else ""
                print(f"    - {old['modified']} ({old['size']:,} bytes){marker_text}")

                if not dry_run:
                    s3.delete_object(
                        Bucket=bucket, Key=key_name, VersionId=old["version_id"]
                    )
                    total_deleted += 1
            print()

        if dry_run:
            total_old = sum(len(v) - 1 for v in files_to_clean.values())
            print(
                f"Would delete {total_old} old versions from {len(files_to_clean)} files"
            )
            print("Run without --dry-run to actually delete")
        else:
            print(
                f"Deleted {total_deleted} old versions from {len(files_to_clean)} files"
            )

        return 0

    except ClientError as e:
        print(f"Error: {e}")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Clean up old file versions from R2 bucket",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="List versions without deleting"
    )
    parser.add_argument(
        "--prefix",
        default="",
        help='Only clean up files with this prefix (e.g., "latest/")',
    )

    args = parser.parse_args()
    return cleanup_old_versions(prefix=args.prefix, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
