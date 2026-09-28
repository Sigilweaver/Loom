---
sidebar_position: 3
title: Releasing
---

# Releasing

How a release is produced. The workflow files are the source of truth: `.github/workflows/release.yml` and `.github/workflows/README.md`.

## Version numbers

Version fields in the repository stay at `0.0.0-dev`. CI injects the real version from the release tag with `.github/scripts/set-version.py`. It updates the Studio, Server, Hub and docs package files, the Tauri config, and the `__version__` strings in `server/app/__init__.py` and `hub/backend/app/__init__.py`. Do not bump versions by hand.

## Steps

1. Update `CHANGELOG.md`. Every user-facing change gets an entry.
2. Make sure `main` is green: `./scripts/test.py --full`.
3. Tag the release commit on `main` with a `v` prefix (for example `v0.13.0`) and push the tag.

The release workflow builds only when the tagged commit is on `main`.

## What CI does

Pushing a `v*` tag runs `release.yml`:

1. **Server**: PyInstaller binaries for Linux, Windows and macOS.
2. **Studio Full**: Electron apps with the bundled Server (AppImage and Snap, NSIS installer and portable exe, DMG).
3. **Studio Client**: Electron apps without a Server.
4. **Web**: a zip of the static Studio build.
5. **Publish**: renames the artifacts, writes `SHA256SUMS.txt`, attaches everything to a GitHub Release and mirrors the assets and manifests to Cloudflare R2 (`download.sigilweaver.app`).

Windows executables are signed with Azure Trusted Signing. macOS builds are not notarized. Docker images for Hub and Server are built by `docker-build.yml` when a GitHub release is published.

Tauri builds come from the manually triggered `build-studio-tauri.yml` and are not part of the release yet. How the GitHub Release is published (draft or final) is defined in `release.yml`, so read it before you tag.

## Checking a release

Download an artifact on a clean machine. Verify that it launches, that the bundled Server starts, that you can read a file and run a workflow, and that the output is correct. Verify checksums:

```bash
sha256sum -c SHA256SUMS.txt
```

## Rolling back

Versioned assets are kept. To roll back, publish a fixed version and update the stable manifest as described in `.github/scripts/README.md`.

## Checklist

- [ ] `CHANGELOG.md` updated
- [ ] CI green on `main`
- [ ] Tag pushed from `main`
- [ ] All artifacts and `SHA256SUMS.txt` present on the release
- [ ] Windows installer launches
- [ ] Docker images published
