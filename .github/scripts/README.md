# GitHub Actions Release Scripts

Python-based release automation for Sigilweaver Loom: the R2 upload and manifest
generation, and the CI gate that `release.yml` runs before building.

## Overview

This directory contains modular Python scripts for uploading release assets to Cloudflare R2 (S3-compatible storage). The scripts handle:

- Asset upload to versioned `releases/loom/{version}/` paths
- Manifest generation for stable channel and downloads page
- Atomic updates via staging pattern (prevents clients seeing partial uploads)
- SHA256 checksum handling
- Release index maintenance (stable releases only; pre-releases never touch it)
- A gate that requires a passing CI run for the tagged commit

## Structure

```
.github/scripts/
├── upload_to_r2.py          # Main CLI entry point (run by mirror-release.yml)
├── check_ci_status.py       # Release gate: tagged commit must have passing CI
├── generate-checksums.py    # SHA256SUMS.txt for release assets
├── set-version.py           # Stamp the tag version into package manifests
├── lib/
│   ├── asset_detector.py    # File type detection (exe -> windows, etc.)
│   ├── manifest_builder.py  # JSON manifest generation
│   └── r2_uploader.py       # boto3 S3/R2 upload logic
├── cleanup-r2-versions.py   # Manual maintenance: prune old object versions
├── tests/
│   ├── conftest.py          # pytest fixtures
│   ├── test_asset_detector.py
│   ├── test_check_ci_status.py
│   ├── test_manifest_builder.py
│   └── test_upload_to_r2.py
└── run-tests.sh             # Test runner
```

## Usage

### In GitHub Actions

`mirror-release.yml` runs the upload when a release is published (releases are
created as drafts by `release.yml`, so nothing reaches R2 before a maintainer
reviews the assets). It downloads the release assets and runs:

```yaml
- name: Upload to R2
  run: |
    python .github/scripts/upload_to_r2.py \
      "${TAG}" \
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

python .github/scripts/upload_to_r2.py v0.13.0-test release-assets/ --dry-run
```

### Pre-releases

A tag with a `-` suffix (for example `v1.0.0-rc.1`), or the `--prerelease` flag,
makes the upload a pre-release: assets and the per-version manifests are
uploaded to `releases/loom/{version}/`, but `releases/loom/index.json` (which the
website reads to find the latest stable download) is left untouched. The
per-version manifest reports `"channel": "prerelease"`.

### Run Tests

The tests run in CI as part of `./scripts/test.py --repo`, which also runs ruff
over this directory. Locally:

```bash
./scripts/test.py --repo

# Or with pytest directly (needs pytest and boto3)
cd .github/scripts
./run-tests.sh
```

### CI gate

```bash
GH_TOKEN=... python3 .github/scripts/check_ci_status.py \
  --repo Sigilweaver/Loom --sha <commit>
```

Exits 0 only when a `push` or `workflow_dispatch` run of `ci.yml` succeeded for
the commit, waiting for runs that are still in progress.

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
├── releases/
│   ├── loom/
│   │   ├── index.json                             # All releases index
│   │   ├── v0.13.0/                          # Versioned files (immutable)
│   │   │   ├── Sigilweaver-Loom-Setup-v0.13.0.exe
│   │   │   ├── manifest.json
│   │   │   └── downloads.json
│   │   └── v0.2.6/
│   │       └── ...
└── .staging/                                  # Temporary staging (not public)
    └── ...
```

## Manifest Schemas

### Release Manifest (`releases/loom/{version}/manifest.json`)

`channel` is `"stable"`, or `"prerelease"` for pre-releases.

```json
{
  "schemaVersion": 1,
  "channel": "stable",
  "version": "v0.13.0",
  "date": "2025-11-22T12:00:00Z",
  "commit": "abc123",
  "assets": [
    {
      "id": "windowsSetup",
      "os": "windows",
      "arch": "x64",
      "kind": "installer",
      "fileName": "Sigilweaver-Loom-Setup-v0.13.0.exe",
      "url": "https://download.sigilweaver.app/releases/loom/v0.13.0/Sigilweaver-Loom-Setup-v0.13.0.exe",
      "size": 207000000,
      "sha256": "abc123..."
    }
  ]
}
```

### Downloads Manifest (`releases/loom/{version}/downloads.json`)

```json
{
  "schemaVersion": 1,
  "version": "v0.13.0",
  "date": "2025-11-22T12:00:00Z",
  "variants": {
    "full": [/* full app assets */],
    "client": [/* client-only assets */],
    "web": [/* web build assets */]
  }
}
```

### Releases Index (`releases/loom/index.json`)

Lists stable releases only. `latest` is always the highest stable version in
the index, so neither a pre-release nor a re-upload of an older release can
change it.

```json
{
  "schemaVersion": 1,
  "generatedAt": "2025-11-22T12:00:00Z",
  "latest": "v0.13.0",
  "releases": [
    {
      "version": "v0.13.0",
      "date": "2025-11-22T12:00:00Z",
      "manifestUrl": "https://.../releases/loom/v0.13.0/manifest.json"
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
- `is_prerelease(version)` - True for tags with a `-` suffix
- `ManifestBuilder.build_stable_manifest(commit_sha)` - Per-version manifest
- `ManifestBuilder.build_downloads_manifest()` - Downloads page manifest
- `ManifestBuilder.update_releases_index(existing)` - Update releases index
  (raises `ValueError` for a pre-release)

### `check_ci_status.py`

- `evaluate_runs(runs)` - Reduce workflow runs for a commit to
  `success` / `pending` / `failed` / `missing`
- `wait_for_ci(fetch, ...)` - Poll until a final verdict or a timeout

### `r2_uploader.py`

Handles R2 uploads via boto3:
- `R2Uploader.upload_assets(assets_dir, version)` - Upload files
- `R2Uploader.upload_manifest_atomic(data, key)` - Atomic manifest upload with staging
- `R2Uploader.download_json(key)` - Download and parse JSON from R2

## Dependencies

- Python 3.11+
- `boto3` - AWS SDK for Python (S3-compatible API); `mirror-release.yml`
  installs it with pip
- `pytest` - Testing framework (development; `scripts/test.py --repo` supplies
  it through `uv run --with`)
- The `gh` CLI (preinstalled on GitHub runners) for `check_ci_status.py`

## Testing

Unit tests cover:
- Asset type detection for all file types (exe, AppImage, snap, dmg, zip)
- Manifest generation and structure validation
- Variant categorization (full vs client vs web)
- Index updates, deduplication and pre-release handling
- The upload entry point, with the R2 client faked
- The CI gate verdict and polling logic

Run tests locally with `./scripts/test.py --repo`.

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
python3 .github/scripts/cleanup-r2-versions.py --prefix releases/loom/
```

### Dry-run for debugging

Always test with `--dry-run` first:
```bash
python upload_to_r2.py v0.13.0-test release-assets/ --dry-run
```

This shows what would be uploaded without making actual changes.

## Cache Control Headers

- **Assets**: `max-age=31536000,public,immutable` for versioned `releases/loom/{version}/`
- **Manifests**: `max-age=31536000,public,immutable` for versioned, `max-age=300,public` for index

## Future Improvements

- [ ] Progress bars for large uploads (tqdm)
- [ ] Parallel uploads for faster releases
- [ ] Automatic cleanup of old releases
- [ ] GitHub release creation integration
- [ ] Artifact signature verification
