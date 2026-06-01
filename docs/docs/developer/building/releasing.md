---
sidebar_position: 3
---

# Releasing

CI/CD pipeline and distribution workflow.

## Release Process

### 1. Version Bump

Update version in:
- `server/app/__init__.py`
- `studio/package.json`

```bash
# server/app/__init__.py
__version__ = "0.3.0"

# studio/package.json
{
  "version": "0.3.0"
}
```

### 2. Create Release

```bash
git add -A
git commit -m "Release v0.3.0"
git tag v0.3.0
git push origin main --tags
```

The tag triggers the GitHub Actions release workflow.

### 3. CI/CD Pipeline

When a version tag is pushed:

1. **Build** runs on all platforms (Linux, Windows, macOS)
2. **Test** runs full test suite
3. **Package** creates distributable artifacts
4. **Upload** pushes to Cloudflare R2 CDN
5. **Release** creates GitHub release with assets

## GitHub Actions Workflow

```yaml
# .github/workflows/release.yml

name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Setup bun
        uses: oven-sh/setup-bun@v2
      
      - name: Build Server
        run: |
          cd server
            uv sync --all-extras
            uv run pyinstaller sigilweaver.spec
          cd studio
          bun install --frozen-lockfile
          bun run build
          bun run dist
      
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-${{ matrix.os }}
          path: studio/dist/
  
  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download Artifacts
        uses: actions/download-artifact@v4
      
      - name: Upload to B2
        run: ./scripts/upload-release.sh
        env:
          B2_KEY_ID: ${{ secrets.B2_KEY_ID }}
          B2_APPLICATION_KEY: ${{ secrets.B2_APPLICATION_KEY }}
      
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            build-*/Sigilweaver Loom*
          generate_release_notes: true
```

## Distribution

Releases are distributed via Backblaze B2 CDN:

```
https://download.sigilweaver.app/
```

### URL Structure

```
download.sigilweaver.app/
├── latest/                     # Always points to newest
│   ├── Sigilweaver-Loom.AppImage    # Generic names
│   ├── Sigilweaver-Loom-Setup.exe
│   ├── Sigilweaver-Loom.dmg
│   └── SHA256SUMS.txt
│
└── releases/
    ├── index.json              # List of all releases
    ├── v0.3.0/                 # Versioned archives
    │   ├── Sigilweaver-Loom-v0.3.0.AppImage
    │   ├── Sigilweaver-Loom-Setup-v0.3.0.exe
    │   └── manifest.json
    └── v0.2.0/
        └── ...
```

### Download Links

For download pages, use `/latest/` URLs:

```html
<a href="https://download.sigilweaver.app/latest/Sigilweaver-Loom.AppImage">
  Download for Linux
</a>
```

These always point to the newest version without changing the URL.

### Auto-Updates

electron-updater checks the manifest for updates:

```json
// latest/stable/manifest.json
{
  "version": "0.3.0",
  "files": [
    {
      "url": "Sigilweaver-Loom-0.3.0.AppImage",
      "sha512": "...",
      "size": 200000000
    }
  ],
  "releaseDate": "2025-01-15T00:00:00Z"
}
```

### Cache Headers

- `/latest/`: 5-minute cache (frequent updates)
- `/releases/{version}/`: 1-year cache, immutable
- Manifests: 1-minute cache (auto-update checks)

## Checksums

Every release includes `SHA256SUMS.txt`:

```
abc123...  Sigilweaver-Loom.AppImage
def456...  Sigilweaver-Loom-Setup.exe
789abc...  Sigilweaver-Loom.dmg
```

Users can verify downloads:

```bash
curl -O https://download.sigilweaver.app/latest/SHA256SUMS.txt
sha256sum -c SHA256SUMS.txt
```

## Code Signing

### Windows (Authenticode)

Signing reduces SmartScreen warnings:

```bash
# Using SignTool (requires certificate)
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com Sigilweaver-Loom-Setup.exe
```

### macOS (Notarization)

Apple requires notarization for apps outside the App Store:

```bash
# Sign
codesign --deep --force --options runtime --sign "Developer ID" Sigilweaver-Loom.app

# Notarize
xcrun notarytool submit Sigilweaver-Loom.dmg --apple-id "..." --team-id "..." --password "..."

# Staple
xcrun stapler staple Sigilweaver-Loom.dmg
```

### Linux

No signing required, but AppImage signing is possible:

```bash
# Optional: sign AppImage
appimagetool --sign Sigilweaver-Loom.AppImage
```

## Pre-Release Testing

Before tagging a release:

1. Run full test suite: `./scripts/test.sh`
2. Build locally: `./scripts/build.sh`
3. Test on clean system (VM without dev tools)
4. Verify:
   - App launches
   - Backend starts
   - Can load files
   - Can execute workflows
   - Output is correct

## Rollback

If a release is broken:

1. Upload previous version to `/latest/`
2. Update manifest version
3. Users will auto-update back

Versioned releases in `/releases/{version}/` are never deleted, so historical versions remain available.

## Release Checklist

- [ ] Version bumped in both frontend and backend
- [ ] Changelog updated
- [ ] All tests passing
- [ ] Local build tested
- [ ] Tag pushed
- [ ] CI/CD completed successfully
- [ ] Download links verified
- [ ] Checksums match

---

Next: [API Reference](../reference/api-endpoints) for backend endpoint documentation.
