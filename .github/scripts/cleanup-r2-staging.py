#!/usr/bin/env python3
"""
Clean up .staging/ files from R2 bucket.

Usage:
    export R2_ACCESS_KEY_ID="..."
    export R2_SECRET_ACCESS_KEY="..."
    export R2_BUCKET_NAME="sigilweaver-downloads"
    export R2_ENDPOINT_URL="https://<account_id>.r2.cloudflarestorage.com"

    python3 cleanup-r2-staging.py [--dry-run]
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


def cleanup_staging(dry_run=False):
    """Clean up .staging/ files from R2."""
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
    if dry_run:
        print("DRY-RUN MODE - No files will be deleted")
    print()

    try:
        # List all .staging/ files
        response = s3.list_objects_v2(Bucket=bucket, Prefix=".staging/")

        if "Contents" not in response:
            print("No .staging/ files found!")
            return 0

        files = response["Contents"]
        print(f"Found {len(files)} staging files:")
        print()

        for obj in files:
            size = obj["Size"]
            key = obj["Key"]
            print(f"  {key:60} ({size:,} bytes)")

            if not dry_run:
                s3.delete_object(Bucket=bucket, Key=key)

        print()
        if dry_run:
            print(f"Would delete {len(files)} files (run without --dry-run to delete)")
        else:
            print(f"Deleted {len(files)} staging files")

        return 0

    except ClientError as e:
        print(f"Error: {e}")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Clean up .staging/ files from R2 bucket"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="List files without deleting"
    )

    args = parser.parse_args()
    return cleanup_staging(dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
