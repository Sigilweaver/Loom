# GitHub Actions Release Scripts

Python-based release upload automation for Sigilweaver.

## Overview

This directory contains modular Python scripts for uploading release assets to Backblaze B2 (S3-compatible storage). The scripts handle:

- Asset upload to both `latest/` and versioned `releases/{version}/` paths
- Manifest generation for stable channel and downloads page
- Atomic updates via staging pattern (prevents clients seeing partial uploads)
- SHA256 checksum handling
- Release index maintenance

## Structure

```
.github/scripts/
├── upload_to_b2.py          # Main CLI entry point
├── lib/
│   ├── asset_detector.py    # File type detection (exe -> windows, etc.)
│   ├── manifest_builder.py  # JSON manifest generation
│   └── b2_uploader.py       # boto3 S3/B2 upload logic
├── tests/
│   ├── conftest.py          # pytest fixtures
│   ├── test_asset_detector.py
│   └── test_manifest_builder.py
└── run-tests.sh             # Test runner
```

## Usage

### In GitHub Actions

```yaml
- name: Upload to B2
  run: |
    python .github/scripts/upload_to_b2.py \
      "${{ github.ref_name }}" \
      release-assets/
  env:
    B2_APPLICATION_KEY_ID: ${{ secrets.B2_APPLICATION_KEY_ID }}
    B2_APPLICATION_KEY: ${{ secrets.B2_APPLICATION_KEY }}
    B2_BUCKET_NAME: ${{ secrets.B2_BUCKET_NAME }}
    B2_ENDPOINT_URL: ${{ secrets.B2_ENDPOINT_URL }}
    GITHUB_SHA: ${{ github.sha }}
```

### Local Testing

```bash
# Dry-run mode (prints actions without uploading)
export B2_APPLICATION_KEY_ID="your-key-id"
export B2_APPLICATION_KEY="your-key"
export B2_BUCKET_NAME="sigilweaver-downloads"
export B2_ENDPOINT_URL="s3.us-east-005.backblazeb2.com"
export GITHUB_SHA="abc123"

python .github/scripts/upload_to_b2.py v0.2.5-test release-assets/ --dry-run
```

### Run Tests

```bash
cd .github/scripts
./run-tests.sh

# Or with pytest directly
python3 -m pytest tests/ -v
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `B2_APPLICATION_KEY_ID` | B2 application key ID | `00512345678abcdef` |
| `B2_APPLICATION_KEY` | B2 application key (secret) | `K005...` |
| `B2_BUCKET_NAME` | B2 bucket name | `sigilweaver-downloads` |
| `B2_ENDPOINT_URL` | B2 S3-compatible endpoint | `s3.us-east-005.backblazeb2.com` |
| `GITHUB_SHA` | Git commit SHA (optional) | `abc123def456...` |

## B2 Bucket Layout

After upload, the bucket structure is:

```
sigilweaver-downloads/
├── latest/                                    # Latest stable release
│   ├── Sigilweaver-Setup-{version}.exe
│   ├── Sigilweaver-{version}-x64.AppImage
│   ├── SHA256SUMS.txt
│   ├── downloads.json                         # Downloads page manifest
│   └── stable/
│       └── manifest.json                      # Stable channel manifest
├── releases/
│   ├── index.json                             # All releases index
│   ├── v0.2.5-alpha/
│   │   ├── Sigilweaver-Setup-v0.2.5-alpha.exe
│   │   ├── manifest.json
│   │   └── downloads.json
│   └── v0.2.6/
│       └── ...
└── .staging/                                  # Temporary staging (not public)
    └── ...
```

## Manifest Schemas

### Stable Channel Manifest (`latest/stable/manifest.json`)

```json
{
  "schemaVersion": 1,
  "channel": "stable",
  "version": "v0.2.5-alpha",
  "date": "2025-11-22T12:00:00Z",
  "commit": "abc123",
  "assets": [
    {
      "id": "windowsSetup",
      "os": "windows",
      "arch": "x64",
      "kind": "installer",
      "fileName": "Sigilweaver-Setup-v0.2.5-alpha.exe",
      "url": "https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/latest/Sigilweaver-Setup-v0.2.5-alpha.exe",
      "size": 207000000,
      "sha256": "abc123..."
    }
  ]
}
```

### Downloads Manifest (`latest/downloads.json`)

```json
{
  "schemaVersion": 1,
  "version": "v0.2.5-alpha",
  "date": "2025-11-22T12:00:00Z",
  "variants": {
    "full": [/* full app assets */],
    "client": [/* client-only assets */],
    "web": [/* web build assets */]
  }
}
```

### Releases Index (`releases/index.json`)

```json
{
  "schemaVersion": 1,
  "generatedAt": "2025-11-22T12:00:00Z",
  "latest": "v0.2.5-alpha",
  "releases": [
    {
      "version": "v0.2.5-alpha",
      "date": "2025-11-22T12:00:00Z",
      "manifestUrl": "https://.../releases/v0.2.5-alpha/manifest.json"
    }
  ]
}
```

## Module Documentation

### `asset_detector.py`

Maps filenames to asset metadata:
- `detect_asset_type(filename)` - Returns `{os, id, kind}` dict
- `is_variant(filename, variant)` - Check if file matches variant (e.g., "Client")
- `extract_version(filename)` - Extract version string from filename

### `manifest_builder.py`

Generates JSON manifests:
- `ManifestBuilder.build_stable_manifest(commit_sha)` - Stable channel manifest
- `ManifestBuilder.build_downloads_manifest()` - Downloads page manifest
- `ManifestBuilder.update_releases_index(existing)` - Update releases index

### `b2_uploader.py`

Handles B2 uploads via boto3:
- `B2Uploader.upload_assets(assets_dir, version)` - Upload files
- `B2Uploader.upload_manifest_atomic(data, key)` - Atomic manifest upload with staging
- `B2Uploader.download_json(key)` - Download and parse JSON from B2

## Dependencies

All dependencies are pre-installed on GitHub Actions runners:
- Python 3.11+
- `boto3` - AWS SDK for Python (S3-compatible API)
- `pytest` - Testing framework (for development)

No additional `pip install` required in CI/CD.

## Testing

Unit tests cover:
- Asset type detection for all file types (exe, AppImage, snap, dmg, zip)
- Manifest generation and structure validation
- Variant categorization (full vs client vs web)
- Index updates and deduplication

Run tests locally:
```bash
cd .github/scripts
./run-tests.sh
```

## Troubleshooting

### "Missing required environment variables"

Ensure all B2 credentials are set in GitHub Secrets and passed as `env:` in the workflow.

### "NoSuchKey" errors

The script creates missing manifests automatically. This is normal for first-time uploads.

### Dry-run for debugging

Always test with `--dry-run` first:
```bash
python upload_to_b2.py v0.2.5-test release-assets/ --dry-run
```

This shows what would be uploaded without making actual changes.

## Cache Control Headers

- **Assets**: `max-age=300,public` (5 minutes) for `latest/`, `max-age=31536000,public,immutable` for versioned
- **Manifests**: `max-age=60,public` (1 minute) for `latest/`, `max-age=31536000,public,immutable` for versioned
- **Index**: `max-age=300,public` (5 minutes)

## Future Improvements

- [ ] Progress bars for large uploads (tqdm)
- [ ] Parallel uploads for faster releases
- [ ] Automatic cleanup of old releases
- [ ] GitHub release creation integration
- [ ] Artifact signature verification
