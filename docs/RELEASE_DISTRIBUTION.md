# Release Distribution Strategy

## Overview

Sigilweaver uses a two-tier distribution system on Backblaze B2:
1. **`/latest/`** - Generic filenames, always pointing to the newest version
2. **`/releases/{version}/`** - Versioned archives for historical access

## Directory Structure

```
sigilweaver-downloads/
├── latest/
│   ├── Sigilweaver.AppImage              # Full version - Linux AppImage
│   ├── Sigilweaver.snap                  # Full version - Linux Snap
│   ├── Sigilweaver-Setup.exe             # Full version - Windows Installer
│   ├── Sigilweaver-Portable.exe          # Full version - Windows Portable
│   ├── Sigilweaver-Client.AppImage       # Client only - Linux AppImage
│   ├── Sigilweaver-Client.snap           # Client only - Linux Snap
│   ├── Sigilweaver-Client-Setup.exe      # Client only - Windows Installer
│   ├── Sigilweaver-Client-Portable.exe   # Client only - Windows Portable
│   ├── Sigilweaver-Web.zip               # Web version
│   ├── SHA256SUMS.txt                    # Checksums for all files
│   └── stable/
│       └── manifest.json                 # Auto-update manifest
│
├── releases/
│   ├── index.json                        # List of all releases
│   ├── v0.2.1-alpha/
│   │   ├── Sigilweaver-v0.2.1-alpha-x64.AppImage
│   │   ├── Sigilweaver-v0.2.1-alpha-x64.snap
│   │   ├── Sigilweaver-Setup-v0.2.1-alpha.exe
│   │   ├── Sigilweaver-Portable-v0.2.1-alpha.exe
│   │   ├── Sigilweaver-Client-v0.2.1-alpha-x64.AppImage
│   │   ├── Sigilweaver-Client-v0.2.1-alpha-x64.snap
│   │   ├── Sigilweaver-Client-Setup-v0.2.1-alpha.exe
│   │   ├── Sigilweaver-Client-Portable-v0.2.1-alpha.exe
│   │   ├── Sigilweaver-Web-v0.2.1-alpha.zip
│   │   ├── SHA256SUMS.txt
│   │   └── manifest.json
│   │
│   └── v0.2.0/
│       └── ... (previous release)
```

## Version Types

### Full Version vs Client Version

- **Full (`Sigilweaver`)**: Includes embedded Python backend + frontend
  - Standalone application
  - No Python installation required
  - Larger download size (~200MB)

- **Client (`Sigilweaver-Client`)**: Frontend only
  - Requires separate backend installation
  - Smaller download size (~100MB)
  - For users with existing Python environments

### Installer vs Portable

- **Setup/Installer (`.exe`, AppImage, Snap)**:
  - Installs to system (Program Files on Windows)
  - Creates start menu shortcuts
  - Supports auto-updates
  - Requires admin rights (Windows)

- **Portable (`.exe`)**:
  - Run from any location (USB drive, cloud storage)
  - No installation required
  - No admin rights needed
  - No auto-updates
  - Windows only

## Usage Patterns

### For Download Pages

Use `/latest/` URLs for "Download Latest" buttons:
```
https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/latest/Sigilweaver-Setup.exe
```

Benefits:
- URLs never change
- Always point to newest version
- Easy to maintain documentation

### For Auto-Updates

Use the stable channel manifest:
```
https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/latest/stable/manifest.json
```

### For Historical Access

Use versioned URLs:
```
https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/releases/v0.2.1-alpha/Sigilweaver-Setup-v0.2.1-alpha.exe
```

Benefits:
- Permanent links
- Rollback capability
- Archive for older versions

### For Release Index

List all releases:
```
https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/releases/index.json
```

Format:
```json
{
  "schemaVersion": 1,
  "generatedAt": "2025-10-30T00:00:00Z",
  "latest": "v0.2.1-alpha",
  "releases": [
    {
      "version": "v0.2.1-alpha",
      "date": "2025-10-30T00:00:00Z",
      "manifestUrl": "https://..."
    }
  ]
}
```

## Cache Strategy

- **`/latest/`**: `max-age=300` (5 minutes) - Frequent updates
- **`/releases/{version}/`**: `max-age=31536000,immutable` (1 year) - Never changes
- **Manifests**: `max-age=60` (1 minute) - Auto-update checks

## Workflow Behavior

When a new version is tagged and built:

1. **Versioned files** uploaded to `/releases/{version}/` (permanent)
2. **Generic files** uploaded to `/latest/` (overwrites previous version)
3. **Manifests** updated:
   - `/latest/stable/manifest.json` (points to latest)
   - `/releases/{version}/manifest.json` (version-specific)
4. **Index** updated at `/releases/index.json`

## Examples

### Download Latest Version (Any Platform)
```bash
# Windows Installer
curl -O https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/latest/Sigilweaver-Setup.exe

# Linux AppImage
curl -O https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/latest/Sigilweaver.AppImage
chmod +x Sigilweaver.AppImage
./Sigilweaver.AppImage

# Web Version
curl -O https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/latest/Sigilweaver-Web.zip
unzip Sigilweaver-Web.zip
```

### Download Specific Version
```bash
# Specific version
curl -O https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/releases/v0.2.1-alpha/Sigilweaver-Setup-v0.2.1-alpha.exe
```

### Verify Downloads
```bash
# Download checksums
curl -O https://sigilweaver-downloads.s3.us-east-005.backblazeb2.com/latest/SHA256SUMS.txt

# Verify
sha256sum -c SHA256SUMS.txt
```

## Benefits of This Approach

1. **Simple Download Links**: Users always use the same URL
2. **Historical Access**: All versions remain available
3. **Auto-Update Support**: Manifest-based update checking
4. **Bandwidth Efficient**: CDN-friendly cache headers
5. **Rollback Capability**: Easy to revert to previous versions
6. **Multiple Platforms**: Single system handles all OS/package types
