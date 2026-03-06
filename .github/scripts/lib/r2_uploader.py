"""
Cloudflare R2 uploader using boto3 S3-compatible API.

Handles atomic uploads with staging and manifest management.
"""

import json
import os
from pathlib import Path
from typing import Dict, Optional

import boto3
from botocore.exceptions import ClientError


class R2Uploader:
    """Upload release assets to Cloudflare R2."""

    def __init__(self, dry_run: bool = False):
        """
        Initialize R2 uploader.

        Args:
            dry_run: If True, print actions without executing
        """
        self.dry_run = dry_run
        self.s3 = None
        self.bucket = None
        self.endpoint_url = None

        if not dry_run:
            self._configure_client()

    def _configure_client(self):
        """Configure boto3 S3 client for Cloudflare R2."""
        key_id = os.environ.get("R2_ACCESS_KEY_ID")
        key = os.environ.get("R2_SECRET_ACCESS_KEY")
        self.bucket = os.environ.get("R2_BUCKET_NAME")
        endpoint = os.environ.get("R2_ENDPOINT_URL")

        if not all([key_id, key, self.bucket, endpoint]):
            raise ValueError(
                "Missing required R2 environment variables: "
                "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "
                "R2_BUCKET_NAME, R2_ENDPOINT_URL"
            )

        # R2 endpoint is already a full URL (https://<account_id>.r2.cloudflarestorage.com)
        self.endpoint_url = (
            endpoint if endpoint.startswith("https://") else f"https://{endpoint}"
        )

        # Create S3 client configured for R2
        self.s3 = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=key_id,
            aws_secret_access_key=key,
            region_name="auto",
            config=boto3.session.Config(
                signature_version="s3v4", s3={"addressing_style": "path"}
            ),
        )

    def upload_assets(self, assets_dir: Path, version: str):
        """
        Upload release assets to releases/{version}/.

        Args:
            assets_dir: Directory containing release assets
            version: Release version (e.g., 'v0.2.5-alpha')
        """
        assets_dir = Path(assets_dir)

        for file in assets_dir.iterdir():
            if not file.is_file():
                continue

            # Skip checksums and manifests (uploaded separately)
            if file.name in ("SHA256SUMS.txt", "downloads.json"):
                continue

            # Upload to versioned location
            self._upload_file(
                file,
                f"releases/{version}/{file.name}",
                cache_control="max-age=31536000,public,immutable",  # 1 year - versioned is immutable
            )

    def upload_manifest_atomic(
        self, manifest_data: Dict, key: str, cache_control: str = "max-age=60,public"
    ):
        """
        Upload manifest with atomic staging pattern.

        Uploads to .staging/ first, then copies to final location.
        This ensures clients never see partial/corrupted manifests.

        Args:
            manifest_data: Manifest dictionary to serialize as JSON
            key: S3 key for final location (e.g., 'latest/stable/manifest.json')
            cache_control: Cache-Control header value
        """
        json_content = json.dumps(manifest_data, indent=2)
        staging_key = f".staging/{key}"

        if self.dry_run:
            print(f"[DRY-RUN] Upload manifest to {staging_key}")
            print(f"[DRY-RUN] Copy {staging_key} -> {key}")
            return

        # Upload to staging
        self.s3.put_object(
            Bucket=self.bucket,
            Key=staging_key,
            Body=json_content.encode("utf-8"),
            ContentType="application/json",
            CacheControl=cache_control,
        )

        # Atomic copy to final location
        self.s3.copy_object(
            Bucket=self.bucket,
            CopySource={"Bucket": self.bucket, "Key": staging_key},
            Key=key,
            CacheControl=cache_control,
            ContentType="application/json",
            MetadataDirective="REPLACE",
        )

        # Clean up staging file
        self.s3.delete_object(Bucket=self.bucket, Key=staging_key)

        print(f"Uploaded manifest: {key}")

    def download_json(self, key: str) -> Optional[Dict]:
        """
        Download and parse JSON file from B2.

        Args:
            key: S3 key to download

        Returns:
            Parsed JSON dictionary or None if not found
        """
        if self.dry_run:
            print(f"[DRY-RUN] Download {key}")
            return None

        try:
            response = self.s3.get_object(Bucket=self.bucket, Key=key)
            content = response["Body"].read().decode("utf-8")
            return json.loads(content)
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                print(f"File not found: {key}")
                return None
            raise

    def _upload_file(self, local_path: Path, key: str, cache_control: str):
        """
        Upload a single file to R2.

        Args:
            local_path: Local file path
            key: S3 key (path in bucket)
            cache_control: Cache-Control header value
        """
        if self.dry_run:
            print(f"[DRY-RUN] Upload {local_path.name} -> s3://{self.bucket}/{key}")
            return

        print(f"Uploading {local_path.name} -> {key}")

        self.s3.upload_file(
            str(local_path), self.bucket, key, ExtraArgs={"CacheControl": cache_control}
        )

    def cleanup_staging_files(self):
        """
        Clean up any leftover .staging/ files from previous uploads.
        This is a safety measure in case cleanup failed during upload.
        """
        if self.dry_run:
            print("[DRY-RUN] Clean up .staging/ files")
            return

        try:
            # List all objects in .staging/
            response = self.s3.list_objects_v2(Bucket=self.bucket, Prefix=".staging/")

            if "Contents" in response:
                for obj in response["Contents"]:
                    print(f"Cleaning up: {obj['Key']}")
                    self.s3.delete_object(Bucket=self.bucket, Key=obj["Key"])
                print(f"Cleaned up {len(response['Contents'])} staging files")
            else:
                print("No staging files to clean up")
        except Exception as e:
            print(f"Warning: Failed to clean up staging files: {e}")

    def get_base_url(self) -> str:
        """
        Get base URL for accessing uploaded files.

        Prefers R2_CDN_URL if set (custom domain), otherwise uses direct R2 endpoint.

        Returns:
            Base URL (e.g., 'https://download.sigilweaver.app')
        """
        if self.dry_run:
            return "https://example.com"

        # Prefer CDN URL if configured (R2 custom domain)
        cdn_url = os.environ.get("R2_CDN_URL")
        if cdn_url:
            return cdn_url.rstrip("/")

        # Fall back to direct R2 endpoint
        return f"{self.endpoint_url}/{self.bucket}"
