#!/usr/bin/env python3
"""
Clean up .staging/ files from B2 bucket.

Usage:
    export B2_APPLICATION_KEY_ID="..."
    export B2_APPLICATION_KEY="..."
    export B2_BUCKET_NAME="sigilweaver-downloads"
    export B2_ENDPOINT_URL="s3.us-east-005.backblazeb2.com"
    
    python3 cleanup-b2-staging.py [--dry-run]
"""

import argparse
import os
import sys

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("Error: boto3 not installed. Install with: pip install boto3")
    sys.exit(1)


def cleanup_staging(dry_run=False):
    """Clean up .staging/ files from B2."""
    # Get credentials
    key_id = os.environ.get('B2_APPLICATION_KEY_ID')
    key = os.environ.get('B2_APPLICATION_KEY')
    bucket = os.environ.get('B2_BUCKET_NAME')
    endpoint = os.environ.get('B2_ENDPOINT_URL')
    
    if not all([key_id, key, bucket, endpoint]):
        print("Error: Missing environment variables:")
        print("  B2_APPLICATION_KEY_ID")
        print("  B2_APPLICATION_KEY")
        print("  B2_BUCKET_NAME")
        print("  B2_ENDPOINT_URL")
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
    print(f"Endpoint: {endpoint}")
    if dry_run:
        print("DRY-RUN MODE - No files will be deleted")
    print()
    
    try:
        # List all .staging/ files
        response = s3.list_objects_v2(
            Bucket=bucket,
            Prefix='.staging/'
        )
        
        if 'Contents' not in response:
            print("No .staging/ files found!")
            return 0
        
        files = response['Contents']
        print(f"Found {len(files)} staging files:")
        print()
        
        for obj in files:
            size = obj['Size']
            key = obj['Key']
            print(f"  {key:60} ({size:,} bytes)")
            
            if not dry_run:
                s3.delete_object(Bucket=bucket, Key=key)
        
        print()
        if dry_run:
            print(f"Would delete {len(files)} files (run without --dry-run to delete)")
        else:
            print(f"✓ Deleted {len(files)} staging files")
        
        return 0
        
    except ClientError as e:
        print(f"Error: {e}")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description='Clean up .staging/ files from B2 bucket'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='List files without deleting'
    )
    
    args = parser.parse_args()
    return cleanup_staging(dry_run=args.dry_run)


if __name__ == '__main__':
    sys.exit(main())
