# GitHub Actions Release Scripts

Python-based release upload automation for Sigilweaver Loom.

## Overview

This directory contains modular Python scripts for uploading release assets to Cloudflare R2 (S3-compatible storage). The scripts handle:

- Asset upload to both `latest/` and versioned `releases/{version}/` paths
- Manifest generation for stable channel and downloads page
- Atomic updates via staging pattern (prevents clients seeing partial uploads)
- SHA256 checksum handling
- Release index maintenance

## Structure

```
.github/scripts/
├── upload_to_r2.py          # Main CLI entry point
├── lib/
│   ├── asset_detector.py    # File type detection (exe -> windows, etc.)
│   ├── manifest_builder.py  # JSON manifest generation
│   └── r2_uploader.py       # boto3 S3/R2 upload logic
├── tests/
│   ├── conftest.py          # pytest fixtures
│   ├── test_asset_detector.py
│   └── test_manifest_builder.py
└── run-tests.sh             # Test runner
```

## Usage

### In GitHub Actions

```yaml
- name: Upload to R2
  run: |
    python .github/scripts/upload_to_r2.py \
      "${{ github.ref_name }}" \
      release-assets/
  env:
    R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
    R2_ENDPOINT_URL: ${{ secrets.R2_ENDPOINT_URL }}
    GITHUB_SHA: ${{ github.sha }}
```

### Local Testing

```bash
# Dry-run mode (prints actions without uploading)
export R2_ACCESS_KEY_ID="your-access-key-id"
export R2_SECRET_ACCESS_KEY="your-secret-access-key"
export R2_BUCKET_NAME="sigilweaver-loom-downloads"
export R2_ENDPOINT_URL="https://<account_id>.r2.cloudflarestorage.com"
export GITHUB_SHA="abc123"

python .github/scripts/upload_to_r2.py v0.2.5-test release-assets/ --dry-run
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
| `R2_ACCESS_KEY_ID` | R2 access key ID | `1e6732c65ccfe9...` |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key | `37d33e37ca8ea2...` |
| `R2_BUCKET_NAME` | R2 bucket name | `sigilweaver-loom-downloads` |
| `R2_ENDPOINT_URL` | R2 S3-compatible endpoint | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_CDN_URL` | Public CDN URL for downloads (optional) | `https://download.sigilweaver.app` |
| `GITHUB_SHA` | Git commit SHA (optional) | `abc123def456...` |

**Note:** If `R2_CDN_URL` is set, it will be used in manifests for public download URLs instead of the direct R2 endpoint.

## R2 Bucket Layout

After upload, the bucket structure is:

```
sigilweaver-loom-downloads/
├── latest/                                    # Latest stable release (generic names)
│   ├── Sigilweaver-Loom-Setup.exe                  # No version in filename
│   ├── Sigilweaver-Loom-Portable.exe
│   ├── Sigilweaver-Loom-x64.AppImage
│   ├── Sigilweaver-Loom-x64.snap
│   ├── Sigilweaver-Loom-Client-Setup.exe
│   ├── Sigilweaver-Loom-Client-x64.AppImage
│   ├── Sigilweaver-Loom-Web.zip
│   ├── SHA256SUMS.txt
│   ├── downloads.json                         # Downloads page manifest
│   └── stable/
│       └── manifest.json                      # Stable channel manifest
├── releases/
│   ├── index.json                             # All releases index
│   ├── v0.2.5-alpha/                          # Versioned files (immutable)
│   │   ├── Sigilweaver-Loom-Setup-v0.2.5-alpha.exe
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
      "fileName": "Sigilweaver-Loom-Setup-v0.2.5-alpha.exe",
      "url": "https://download.sigilweaver.app/latest/Sigilweaver-Loom-Setup-v0.2.5-alpha.exe",
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

### `r2_uploader.py`

Handles R2 uploads via boto3:
- `R2Uploader.upload_assets(assets_dir, version)` - Upload files
- `R2Uploader.upload_manifest_atomic(data, key)` - Atomic manifest upload with staging
- `R2Uploader.download_json(key)` - Download and parse JSON from R2

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

Ensure all R2 credentials are set in GitHub Secrets and passed as `env:` in the workflow.

### "NoSuchKey" errors

The script creates missing manifests automatically. This is normal for first-time uploads.

### R2 Version Management

If you need to clean up existing old versions:

```bash
# See what versions exist
python3 .github/scripts/cleanup-r2-versions.py --dry-run

# Clean up all old versions
python3 .github/scripts/cleanup-r2-versions.py

# Clean up only specific prefix
python3 .github/scripts/cleanup-r2-versions.py --prefix latest/
```

### Dry-run for debugging

Always test with `--dry-run` first:
```bash
python upload_to_r2.py v0.2.5-test release-assets/ --dry-run
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
