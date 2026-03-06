#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["boto3"]
# ///
"""
Migrate all assets from Backblaze B2 to Cloudflare R2.

Reads both B2 and R2 credentials from .env, then streams every object
from the B2 bucket into the R2 bucket, preserving keys and cache headers.

Usage:
    python scripts/migrate_b2_to_r2.py              # Full migration
    python scripts/migrate_b2_to_r2.py --dry-run    # Preview only
    python scripts/migrate_b2_to_r2.py --prefix releases/v0.3.0-alpha/  # Specific path
"""

import argparse
import os
import sys
import tempfile
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


def load_env():
    """Load credentials from .env file."""
    project_root = Path(__file__).parent.parent
    env_file = project_root / ".env"

    if not env_file.exists():
        print(f"ERROR: .env file not found at {env_file}")
        return False

    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key, value)

    return True


def make_b2_client():
    key_id = os.environ["B2_APPLICATION_KEY_ID"]
    key = os.environ["B2_APPLICATION_KEY"]
    endpoint = os.environ["B2_ENDPOINT_URL"]
    region = endpoint.split(".")[1] if "." in endpoint else "us-east-1"

    return boto3.client(
        "s3",
        endpoint_url=f"https://{endpoint}",
        aws_access_key_id=key_id,
        aws_secret_access_key=key,
        region_name=region,
        config=boto3.session.Config(
            signature_version="s3v4", s3={"addressing_style": "path"}
        ),
    )


def make_r2_client():
    key_id = os.environ["R2_ACCESS_KEY_ID"]
    key = os.environ["R2_SECRET_ACCESS_KEY"]
    endpoint = os.environ["R2_ENDPOINT_URL"]
    endpoint_url = (
        endpoint if endpoint.startswith("https://") else f"https://{endpoint}"
    )

    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=key_id,
        aws_secret_access_key=key,
        region_name="auto",
        config=boto3.session.Config(
            signature_version="s3v4", s3={"addressing_style": "path"}
        ),
    )


def migrate(prefix: str, dry_run: bool):
    if not load_env():
        return 1

    required_b2 = [
        "B2_APPLICATION_KEY_ID",
        "B2_APPLICATION_KEY",
        "B2_ENDPOINT_URL",
        "B2_BUCKET_NAME",
    ]
    required_r2 = [
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_ENDPOINT_URL",
        "R2_BUCKET_NAME",
    ]
    missing = [v for v in required_b2 + required_r2 if not os.environ.get(v)]
    if missing:
        print("Missing environment variables:")
        for v in missing:
            print(f"  - {v}")
        return 1

    b2_bucket = os.environ["B2_BUCKET_NAME"]
    r2_bucket = os.environ["R2_BUCKET_NAME"]

    b2 = make_b2_client()
    r2 = make_r2_client()

    print(f"Source:  B2  bucket={b2_bucket}")
    print(f"Dest:    R2  bucket={r2_bucket}")
    print(f"Prefix:  {prefix or '(all)'}")
    if dry_run:
        print("Mode:    DRY-RUN")
    print()

    # List all objects in B2
    paginator = b2.get_paginator("list_objects_v2")
    objects = []
    for page in paginator.paginate(Bucket=b2_bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            objects.append(obj)

    if not objects:
        print("No objects found to migrate.")
        return 0

    total_size = sum(o["Size"] for o in objects)
    print(f"Found {len(objects)} objects ({total_size / (1024 * 1024):.1f} MB)")
    print()

    # Check which objects already exist in R2
    existing_r2_keys = set()
    r2_paginator = r2.get_paginator("list_objects_v2")
    for page in r2_paginator.paginate(Bucket=r2_bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            existing_r2_keys.add(obj["Key"])

    skipped = 0
    copied = 0
    failed = 0

    for obj in objects:
        key = obj["Key"]
        size = obj["Size"]

        if key in existing_r2_keys:
            print(f"SKIP (exists in R2): {key}")
            skipped += 1
            continue

        size_str = (
            f"{size / (1024 * 1024):.2f} MB"
            if size > 1024 * 1024
            else f"{size / 1024:.1f} KB"
        )
        print(f"COPY: {key}  ({size_str})")

        if dry_run:
            copied += 1
            continue

        try:
            # Get metadata from B2 to preserve cache-control
            head = b2.head_object(Bucket=b2_bucket, Key=key)
            cache_control = head.get("CacheControl", "")
            content_type = head.get("ContentType", "application/octet-stream")

            # Stream through a temp file to avoid holding large objects in memory
            with tempfile.NamedTemporaryFile(delete=True) as tmp:
                b2.download_fileobj(b2_bucket, key, tmp)
                tmp.flush()
                tmp.seek(0)

                extra_args = {}
                if cache_control:
                    extra_args["CacheControl"] = cache_control
                if content_type:
                    extra_args["ContentType"] = content_type

                r2.upload_fileobj(tmp, r2_bucket, key, ExtraArgs=extra_args)

            copied += 1
        except (ClientError, Exception) as e:
            print(f"  ERROR: {e}")
            failed += 1

    print()
    print(f"Done: {copied} copied, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1


def main():
    parser = argparse.ArgumentParser(
        description="Migrate assets from Backblaze B2 to Cloudflare R2"
    )
    parser.add_argument(
        "--prefix", default="", help="Only migrate objects with this prefix"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview without copying"
    )
    args = parser.parse_args()

    return migrate(args.prefix, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
