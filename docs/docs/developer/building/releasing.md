---
sidebar_position: 3
title: Releasing
---

# Releasing

How a release is produced. The workflow files are the source of truth: `.github/workflows/release.yml`, `.github/workflows/mirror-release.yml` and `.github/workflows/README.md`.

## Version numbers

Version fields in the repository stay at `0.0.0-dev`. CI injects the real version from the release tag with `.github/scripts/set-version.py`. It updates the Studio, Server, Hub and docs package files, the Tauri config, and the `__version__` strings in `server/app/__init__.py` and `hub/backend/app/__init__.py`. Do not bump versions by hand.

## Steps

1. Update `CHANGELOG.md`. Every user-facing change gets an entry.
2. Make sure `main` is green: `./scripts/test.py --full`.
3. Tag the release commit on `main` with a `v` prefix (for example `v0.13.0`) and push the tag.

The release workflow builds only when the tag is a semver tag (`vMAJOR.MINOR.PATCH`), the tagged commit is on `main` and that commit has a passing CI run. A tag that contains `-` (for example `v1.0.0-rc.1`) is a pre-release.

## What CI does

Pushing a `v*` tag runs `release.yml`:

1. **Server**: PyInstaller binaries for Linux, Windows, macOS on Apple silicon and macOS on Intel.
2. **Studio**: Tauri apps in two variants. Full bundles the Server; Client does not. Each variant builds an AppImage, deb and rpm (Linux x64), an NSIS installer (Windows x64) and a DMG per macOS architecture (arm64 and x64). Every build is launched once by `scripts/smoke_desktop.py` before it is uploaded.
3. **Web**: a zip of the static Studio build.
4. **Draft release**: renames the artifacts, writes `SHA256SUMS.txt` and attaches everything to a **draft** GitHub Release. Nothing is public yet.

Review the draft's assets and notes, then publish it in the GitHub UI. Publishing triggers two workflows:

- `mirror-release.yml` mirrors the assets and download manifests to Cloudflare R2 (`download.sigilweaver.app`). You can also run it by hand with a tag to re-mirror a published release.
- `docker-build.yml` builds the Hub and Server Docker images.

A pre-release is mirrored to its versioned path only. It never updates the stable download index or the `latest` Docker tag.

The Windows installer is signed with Azure Trusted Signing. macOS builds are not signed or notarized.

`build-studio-tauri.yml` can also be run by hand (Actions, Run workflow) to produce installers for a branch without tagging.

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
- [ ] Tag pushed from `main`, and its commit has a passing CI run
- [ ] Draft release has all artifacts and `SHA256SUMS.txt`
- [ ] Draft published (this starts the R2 mirror and Docker builds)
- [ ] Windows installer launches
- [ ] R2 mirror and Docker images published
