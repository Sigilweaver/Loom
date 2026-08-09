---
sidebar_position: 3
---

# Releasing

CI/CD pipeline and distribution workflow.

## Release Process

### 1. Tag and Push

There is no manual version-bump step. Version numbers across every
component (`studio/package.json`, `server/pyproject.toml`,
`hub/backend/pyproject.toml`, `hub/frontend/package.json`,
`docs/package.json`, `studio/tauri/tauri.conf.json`,
`studio/tauri/Cargo.toml`, `server/app/__init__.py`,
`hub/backend/app/__init__.py`) are derived from the git tag itself and
written by `.github/scripts/set-version.py`, which each build job runs
before compiling.

```bash
git tag v0.3.0
git push origin v0.3.0
```

The tag triggers `.github/workflows/release.yml` (`Build Release`), but
only if the tagged commit is reachable from `main` -
`validate-tag-on-main` gates the rest of the workflow on this.

### 2. CI/CD Pipeline

When a valid version tag is pushed, `release.yml` fans out into:

1. `build-server` - PyInstaller executables for Linux/Windows/macOS (calls the reusable `build-server.yml`)
2. `build-studio-full` - Electron builds with the server bundled in (depends on `build-server`)
3. `build-studio-client` - Electron builds without a bundled server
4. `build-web` - static web build zip
5. `publish-assets` - downloads all artifacts, computes checksums, uploads to the GitHub Release, and mirrors everything to Cloudflare R2

Note the Tauri desktop build (`build-studio-tauri.yml`) is not part of
this chain yet - see the workflow's own README for details.

## Distribution

Releases are distributed via Cloudflare R2 CDN:

```
https://download.sigilweaver.app/
```

### URL Structure

```
download.sigilweaver.app/
└── releases/
    └── loom/
        ├── index.json              # List of all releases
        ├── v0.3.0/                 # Versioned archives
        │   ├── Sigilweaver-Loom-v0.3.0.AppImage
        │   ├── Sigilweaver-Loom-Setup-v0.3.0.exe
        │   └── manifest.json
        └── v0.2.0/
            └── ...
```

### Download Links

For download pages, use versioned URLs:

```html
<a href="https://download.sigilweaver.app/releases/loom/v0.3.0/Sigilweaver-Loom-v0.3.0.AppImage">
  Download for Linux
</a>
```

The releases index at `releases/loom/index.json` lists all available versions.

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
- `/releases/loom/{version}/`: 1-year cache, immutable
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
curl -O https://download.sigilweaver.app/releases/loom/latest/SHA256SUMS.txt
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

1. Run full test suite: `./scripts/test.py --full`
2. Build locally: `./scripts/build.py`
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

Versioned releases in `/releases/loom/{version}/` are never deleted, so historical versions remain available.

## Release Checklist

- [ ] Changelog updated
- [ ] All tests passing
- [ ] Local build tested
- [ ] Tag pushed
- [ ] CI/CD completed successfully
- [ ] Download links verified
- [ ] Checksums match

---

Next: [API Reference](../reference/api-endpoints) for backend endpoint documentation.
