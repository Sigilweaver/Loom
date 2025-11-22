"""
Backblaze B2 uploader using boto3 S3-compatible API.

Handles atomic uploads with staging and manifest management.
"""

import json
import os
from pathlib import Path
from typing import Dict, Optional

import boto3
from botocore.exceptions import ClientError


class B2Uploader:
    """Upload release assets to Backblaze B2."""
    
    def __init__(self, dry_run: bool = False):
        """
        Initialize B2 uploader.
        
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
        """Configure boto3 S3 client for B2."""
        # Read credentials from environment
        key_id = os.environ.get('B2_APPLICATION_KEY_ID')
        key = os.environ.get('B2_APPLICATION_KEY')
        self.bucket = os.environ.get('B2_BUCKET_NAME')
        endpoint = os.environ.get('B2_ENDPOINT_URL')
        
        if not all([key_id, key, self.bucket, endpoint]):
            raise ValueError(
                "Missing required B2 environment variables: "
                "B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, "
                "B2_BUCKET_NAME, B2_ENDPOINT_URL"
            )
        
        self.endpoint_url = f"https://{endpoint}"
        
        # Extract region from endpoint (e.g., s3.us-east-005.backblazeb2.com -> us-east-005)
        region = endpoint.split('.')[1] if '.' in endpoint else 'us-east-1'
        
        # Create S3 client configured for B2
        self.s3 = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=key_id,
            aws_secret_access_key=key,
            region_name=region,
            config=boto3.session.Config(
                signature_version='s3v4',
                s3={'addressing_style': 'path'}
            )
        )
    
    def upload_assets(self, assets_dir: Path, version: str):
        """
        Upload release assets to both latest/ and releases/{version}/.
        
        Args:
            assets_dir: Directory containing release assets
            version: Release version (e.g., 'v0.2.5-alpha')
        """
        assets_dir = Path(assets_dir)
        
        for file in assets_dir.iterdir():
            if not file.is_file():
                continue
            
            # Skip checksums and manifests (uploaded separately)
            if file.name in ('SHA256SUMS.txt', 'downloads.json'):
                continue
            
            # Upload to latest/
            self._upload_file(
                file,
                f"latest/{file.name}",
                cache_control="max-age=300,public"
            )
            
            # Upload to versioned location
            self._upload_file(
                file,
                f"releases/{version}/{file.name}",
                cache_control="max-age=31536000,public,immutable"  # 1 year - versioned is immutable
            )
    
    def upload_checksums(self, checksums_file: Path):
        """
        Upload SHA256SUMS.txt to latest/.
        
        Args:
            checksums_file: Path to SHA256SUMS.txt
        """
        if not checksums_file.exists():
            print(f"Warning: Checksums file not found: {checksums_file}")
            return
        
        self._upload_file(
            checksums_file,
            f"latest/{checksums_file.name}",
            cache_control="max-age=300,public"
        )
    
    def upload_manifest_atomic(self, manifest_data: Dict, key: str, cache_control: str = "max-age=60,public"):
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
            Body=json_content.encode('utf-8'),
            ContentType='application/json',
            CacheControl=cache_control
        )
        
        # Atomic copy to final location
        self.s3.copy_object(
            Bucket=self.bucket,
            CopySource={'Bucket': self.bucket, 'Key': staging_key},
            Key=key,
            CacheControl=cache_control,
            ContentType='application/json',
            MetadataDirective='REPLACE'
        )
        
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
            content = response['Body'].read().decode('utf-8')
            return json.loads(content)
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                print(f"File not found: {key}")
                return None
            raise
    
    def _upload_file(self, local_path: Path, key: str, cache_control: str):
        """
        Upload a single file to B2.
        
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
            str(local_path),
            self.bucket,
            key,
            ExtraArgs={
                'CacheControl': cache_control
            }
        )
    
    def get_base_url(self) -> str:
        """
        Get base URL for accessing uploaded files.
        
        Returns:
            Base URL (e.g., 'https://bucket.s3.endpoint.com')
        """
        if self.dry_run:
            return "https://example.com"
        
        endpoint = os.environ.get('B2_ENDPOINT_URL', '')
        return f"https://{self.bucket}.{endpoint}"
