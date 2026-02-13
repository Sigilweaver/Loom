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
4. **Upload** pushes to Backblaze B2 CDN
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
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Build Server
        run: |
          cd server
            uv sync --all-extras
            uv run pyinstaller sigilweaver.spec
          cd studio
          npm ci
          npm run build
          npm run dist
      
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
            build-*/Sigilweaver*
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
│   ├── Sigilweaver.AppImage    # Generic names
│   ├── Sigilweaver-Setup.exe
│   ├── Sigilweaver.dmg
│   └── SHA256SUMS.txt
│
└── releases/
    ├── index.json              # List of all releases
    ├── v0.3.0/                 # Versioned archives
    │   ├── Sigilweaver-v0.3.0.AppImage
    │   ├── Sigilweaver-Setup-v0.3.0.exe
    │   └── manifest.json
    └── v0.2.0/
        └── ...
```

### Download Links

For download pages, use `/latest/` URLs:

```html
<a href="https://download.sigilweaver.app/latest/Sigilweaver.AppImage">
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
      "url": "Sigilweaver-0.3.0.AppImage",
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
abc123...  Sigilweaver.AppImage
def456...  Sigilweaver-Setup.exe
789abc...  Sigilweaver.dmg
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
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com Sigilweaver-Setup.exe
```

### macOS (Notarization)

Apple requires notarization for apps outside the App Store:

```bash
# Sign
codesign --deep --force --options runtime --sign "Developer ID" Sigilweaver.app

# Notarize
xcrun notarytool submit Sigilweaver.dmg --apple-id "..." --team-id "..." --password "..."

# Staple
xcrun stapler staple Sigilweaver.dmg
```

### Linux

No signing required, but AppImage signing is possible:

```bash
# Optional: sign AppImage
appimagetool --sign Sigilweaver.AppImage
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
