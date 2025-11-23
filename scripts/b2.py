#!/usr/bin/env python3
"""
B2 bucket management script.

Lists and downloads B2 assets using CDN URL to avoid direct B2 API costs.
For uploads, use upload_to_b2.py instead.

Usage:
    # List bucket contents
    ./b2.py list [path]
    ./b2.py list latest/
    ./b2.py list -r              # Recursive
    
    # Download files
    ./b2.py download [path]      # Download everything
    ./b2.py download latest/     # Download specific path
    ./b2.py download --dry-run   # Show what would download
"""

import argparse
import hashlib
import os
import sys
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen, Request
import json

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("Warning: boto3 not installed. List command requires boto3.")
    print("Install with: pip install boto3")
    boto3 = None


def load_env():
    """Load credentials from .env file."""
    # scripts/b2.py -> project_root is one level up
    project_root = Path(__file__).parent.parent
    env_file = project_root / '.env'
    
    if not env_file.exists():
        print(f"ERROR: .env file not found at {env_file}")
        print("Please create it with your B2 credentials:")
        print("  B2_APPLICATION_KEY_ID=...")
        print("  B2_APPLICATION_KEY=...")
        print("  B2_BUCKET_NAME=...")
        print("  B2_ENDPOINT_URL=...")
        print("  B2_CDN_URL=...")
        return False
    
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value
    
    return True


def get_cdn_url():
    """Get CDN URL from environment."""
    cdn_url = os.environ.get('B2_CDN_URL')
    if not cdn_url:
        # Fallback to direct B2 endpoint
        bucket = os.environ.get('B2_BUCKET_NAME')
        endpoint = os.environ.get('B2_ENDPOINT_URL')
        if bucket and endpoint:
            cdn_url = f"https://{bucket}.{endpoint}"
    
    return cdn_url.rstrip('/') if cdn_url else None


def list_bucket(prefix='', recursive=False):
    """List bucket contents using S3 API."""
    if boto3 is None:
        print("ERROR: boto3 required for list command")
        return 1
    
    if not load_env():
        return 1
    
    key_id = os.environ.get('B2_APPLICATION_KEY_ID')
    key = os.environ.get('B2_APPLICATION_KEY')
    bucket = os.environ.get('B2_BUCKET_NAME')
    endpoint = os.environ.get('B2_ENDPOINT_URL')
    
    if not all([key_id, key, bucket, endpoint]):
        print("ERROR: Missing B2 credentials in .env")
        return 1
    
    # Extract region
    region = endpoint.split('.')[1] if '.' in endpoint else 'us-east-1'
    
    # Create S3 client
    s3 = boto3.client(
        's3',
        endpoint_url=f'https://{endpoint}',
        aws_access_key_id=key_id,
        aws_secret_access_key=key,
        region_name=region,
        config=boto3.session.Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'}
        )
    )
    
    print(f"Bucket: {bucket}")
    print(f"Path: /{prefix}")
    if recursive:
        print("Mode: Recursive")
    print()
    
    try:
        if recursive:
            # List all files recursively
            paginator = s3.get_paginator('list_objects_v2')
            total_size = 0
            total_files = 0
            
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                if 'Contents' not in page:
                    continue
                
                for obj in page['Contents']:
                    size = obj['Size']
                    key = obj['Key']
                    modified = obj['LastModified'].strftime('%Y-%m-%d %H:%M:%S')
                    
                    # Format size
                    if size < 1024:
                        size_str = f"{size} B"
                    elif size < 1024 * 1024:
                        size_str = f"{size / 1024:.1f} KB"
                    elif size < 1024 * 1024 * 1024:
                        size_str = f"{size / (1024 * 1024):.1f} MB"
                    else:
                        size_str = f"{size / (1024 * 1024 * 1024):.2f} GB"
                    
                    print(f"{modified}  {size_str:>10}  {key}")
                    total_size += size
                    total_files += 1
            
            print()
            print(f"Total: {total_files} files, {total_size / (1024 * 1024):.2f} MB")
        else:
            # List directory (common prefixes)
            response = s3.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix,
                Delimiter='/'
            )
            
            # List subdirectories
            if 'CommonPrefixes' in response:
                for prefix_obj in response['CommonPrefixes']:
                    print(f"DIR   {prefix_obj['Prefix']}")
            
            # List files in current directory
            if 'Contents' in response:
                for obj in response['Contents']:
                    if obj['Key'] == prefix:  # Skip the directory itself
                        continue
                    
                    size = obj['Size']
                    key = obj['Key']
                    modified = obj['LastModified'].strftime('%Y-%m-%d %H:%M:%S')
                    
                    # Format size
                    if size < 1024:
                        size_str = f"{size} B"
                    elif size < 1024 * 1024:
                        size_str = f"{size / 1024:.1f} KB"
                    elif size < 1024 * 1024 * 1024:
                        size_str = f"{size / (1024 * 1024):.1f} MB"
                    else:
                        size_str = f"{size / (1024 * 1024 * 1024):.2f} GB"
                    
                    print(f"{modified}  {size_str:>10}  {key}")
        
        return 0
        
    except ClientError as e:
        print(f"ERROR: {e}")
        return 1


def download_file(url, local_path, dry_run=False):
    """Download a file from URL."""
    if dry_run:
        print(f"[DRY-RUN] Would download: {url} -> {local_path}")
        return True
    
    local_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        req = Request(url)
        with urlopen(req) as response:
            total_size = int(response.headers.get('Content-Length', 0))
            
            # Download with progress
            downloaded = 0
            chunk_size = 8192
            
            with open(local_path, 'wb') as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    if total_size > 0:
                        pct = (downloaded / total_size) * 100
                        print(f"\r  {pct:.1f}% ({downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB)", end='')
            
            if total_size > 0:
                print()  # New line after progress
            
        return True
    except Exception as e:
        print(f"\nERROR downloading {url}: {e}")
        return False


def download_bucket(prefix='', dry_run=False):
    """Download bucket contents using CDN URL."""
    if not load_env():
        return 1
    
    cdn_url = get_cdn_url()
    if not cdn_url:
        print("ERROR: B2_CDN_URL not set in .env")
        return 1
    
    bucket = os.environ.get('B2_BUCKET_NAME', 'sigilweaver-downloads')
    
    # Download directory (scripts/b2.py -> project_root is one level up)
    project_root = Path(__file__).parent.parent
    download_dir = project_root / '.untracked' / 'b2' / bucket
    
    print(f"CDN URL: {cdn_url}")
    print(f"Path: /{prefix}")
    print(f"Local: {download_dir / prefix}")
    if dry_run:
        print("Mode: DRY-RUN")
    print()
    
    # Get file list from manifest or list command
    # For now, we'll use S3 list to get files, then download via CDN
    if boto3 is None:
        print("ERROR: boto3 required to list files for download")
        return 1
    
    key_id = os.environ.get('B2_APPLICATION_KEY_ID')
    key = os.environ.get('B2_APPLICATION_KEY')
    endpoint = os.environ.get('B2_ENDPOINT_URL')
    
    if not all([key_id, key, bucket, endpoint]):
        print("ERROR: Missing B2 credentials in .env")
        return 1
    
    region = endpoint.split('.')[1] if '.' in endpoint else 'us-east-1'
    
    s3 = boto3.client(
        's3',
        endpoint_url=f'https://{endpoint}',
        aws_access_key_id=key_id,
        aws_secret_access_key=key,
        region_name=region,
        config=boto3.session.Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'}
        )
    )
    
    try:
        # List all files recursively
        paginator = s3.get_paginator('list_objects_v2')
        files_to_download = []
        
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            if 'Contents' not in page:
                continue
            
            for obj in page['Contents']:
                files_to_download.append({
                    'key': obj['Key'],
                    'size': obj['Size']
                })
        
        if not files_to_download:
            print("No files to download")
            return 0
        
        print(f"Found {len(files_to_download)} files")
        print()
        
        success = 0
        failed = 0
        
        for file_info in files_to_download:
            key = file_info['key']
            size = file_info['size']
            
            # Build CDN URL
            file_url = f"{cdn_url}/{key}"
            
            # Local path
            local_path = download_dir / key
            
            # Skip if exists and same size
            if local_path.exists() and local_path.stat().st_size == size and not dry_run:
                print(f"SKIP (already exists): {key}")
                success += 1
                continue
            
            print(f"Downloading: {key} ({size / (1024*1024):.2f} MB)")
            
            if download_file(file_url, local_path, dry_run):
                success += 1
            else:
                failed += 1
        
        print()
        print(f"Downloaded: {success} files")
        if failed > 0:
            print(f"Failed: {failed} files")
        
        if not dry_run:
            print()
            print(f"Files saved to: {download_dir}")
        
        return 0 if failed == 0 else 1
        
    except Exception as e:
        print(f"ERROR: {e}")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description='B2 bucket management (list and download via CDN)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List bucket contents')
    list_parser.add_argument('path', nargs='?', default='', help='Path to list')
    list_parser.add_argument('-r', '--recursive', action='store_true', help='Recursive listing')
    
    # Download command
    dl_parser = subparsers.add_parser('download', help='Download files via CDN')
    dl_parser.add_argument('path', nargs='?', default='', help='Path to download')
    dl_parser.add_argument('--dry-run', action='store_true', help='Show what would be downloaded')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    if args.command == 'list':
        return list_bucket(args.path, args.recursive)
    elif args.command == 'download':
        return download_bucket(args.path, args.dry_run)
    else:
        parser.print_help()
        return 1


if __name__ == '__main__':
    sys.exit(main())
