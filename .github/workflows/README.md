# CI/CD Workflow Documentation

## Workflow Structure

The CI/CD system uses a modular approach with reusable workflows for better maintainability and testing.

### Workflow Files

#### 1. ci.yml - Continuous Integration
**Trigger**: Pull requests and pushes on any branch, excluding changes that
only touch markdown or `docs/**`

**Purpose**: Validates code quality and runs tests

**Jobs**:
- Detect desktop changes: decides whether the Windows and macOS jobs and the
  installer builds below are needed (they run when `studio/`, `server/`,
  `scripts/build.py`, `scripts/smoke_desktop.py`, `.github/scripts/` or the
  build and release workflows change). Pushes to a branch skip them and the
  pull request run covers it, so installers are built once
- Studio Tauri crate checks (`cargo fmt --check`, `cargo check`, clippy with
  and without the `bundled-server` feature, `cargo test`). Linux always runs;
  Windows and macOS run when the desktop changed
- Package Studio (desktop changes only): builds the Server on every platform,
  then builds the Full installers with `build-studio-tauri.yml` and launches
  each build with `scripts/smoke_desktop.py`
- Test & Lint: `scripts/test.py --full --ci --server --studio --hub --repo`
  (server, Studio and Hub lint, type-check and tests with coverage, plus ruff
  and the release-script tests for `scripts/` and `.github/scripts/`)
- Web build verification
- Docker build check for the Hub and Server images (build only, no push), so a
  broken Dockerfile fails here rather than when a release is published

**Usage**:
- Automatically runs on all PRs
- Blocks merging if tests fail
- Uploads coverage artifacts

---

#### 2. docs.yml - Documentation Site
**Trigger**: Pull requests and pushes that touch `docs/**`

**Purpose**: Builds the Docusaurus site so a docs-only change still gets a
build check. `ci.yml` excludes `docs/**`, so without this workflow a broken
link or invalid MDX in a docs-only PR would reach `main` with no CI signal.

Note this covers the documentation site only. Markdown outside `docs/`
(`README.md`, `SECURITY.md`, `docker/README.md` and so on) is not part of the
Docusaurus build and is checked by neither workflow. The orphaned
`scripts/lint_repo.py` was removed instead of wired in (#140): its empty-file
and non-ASCII checks flag legitimate content (empty `__init__.py` files, UI
glyphs in source).

**Jobs**:
- Typecheck (`bun run typecheck`)
- Build (`bun run build:cloudflare`, which validates broken links)

---

#### 3. build-server.yml - Server Builds (Reusable)
**Trigger**: Called by other workflows via `workflow_call`

**Purpose**: Build Python server executables for all platforms

**Matrix Strategy**:
- Linux (ubuntu-latest)
- Windows (windows-latest)
- macOS on Apple silicon (macos-latest)
- macOS on Intel (macos-15-intel)

PyInstaller builds for the CPU it runs on, so each macOS architecture builds
its own Server.

**Outputs**:
- `server-linux` artifact
- `server-win` artifact
- `server-mac-arm64` artifact
- `server-mac-x64` artifact

**Build Process**:
1. Sets up Python environment
2. Creates venv and installs dependencies
3. Runs PyInstaller with sigilweaver.spec
4. Uploads platform-specific executable

**Can be tested standalone**:
```bash
gh workflow run build-server.yml
```

---

#### 4. build-studio-tauri.yml - Studio Installers (Reusable)
**Trigger**: Called by `ci.yml` and `release.yml` via `workflow_call`, or run
by hand (Actions > Build Studio > Run workflow)

**Purpose**: Build the Tauri desktop installers, Full (bundled server sidecar)
and Client (no server)

**Inputs**: `variant` (`both`, `full` or `client`) and `sign` (sign the Windows
installer with Azure Trusted Signing; releases set it)

**Matrix Strategy** (per variant):
- Linux x64: AppImage, deb, rpm
- Windows x64: NSIS installer
- macOS arm64 and macOS x64: one DMG each

**Dependencies**:
- Full builds need the `server-*` artifacts from build-server.yml in the same
  run

**Outputs**: `studio-{variant}-{platform}-{arch}` artifacts, for example
`studio-full-linux-x64` and `studio-client-macos-arm64`

**Build Process**:
1. Downloads the matching server artifact (Full only)
2. Runs `python scripts/build.py --studio-only [--client]`, which stages the
   server as `studio/tauri/binaries/loom-server-<target-triple>` and runs
   `tauri build --target <target-triple>`
3. Launches the built binary with `scripts/smoke_desktop.py`: normal stop,
   force-quit recovery, a second launch, and (Linux, Full) shutdown with a
   request in flight
4. Launches each installed layout: the AppImage, the deb in an Ubuntu
   container, the app inside the mounted dmg, and the silently installed NSIS
   installer (then uninstalls it)
5. Uploads the installers

**Windows signing** (when `sign` is set): the job uses the `windows-signing`
environment and the `AZURE_*` secrets. `scripts/build.py --windows-sign` signs
the staged `loom-server` exe and passes `scripts/sign-windows.ps1` to Tauri as
`bundle.windows.signCommand`, so Tauri signs the app exe after bundling has
patched it, then the installer. The job then verifies every signature with
`Get-AuthenticodeSignature` (including the installed files in step 4).

**macOS signing** (when `sign` is set): the job uses the `macos-signing`
environment (main and `v*` tags only) and its `APPLE_*` secrets: the Developer
ID Application certificate as a base64 `.p12` (`APPLE_CERTIFICATE`, with
`APPLE_CERTIFICATE_PASSWORD` and `APPLE_SIGNING_IDENTITY`) and an App Store
Connect API key for notarization (`APPLE_API_ISSUER`, `APPLE_API_KEY`, and the
`.p8` contents in `APPLE_API_KEY_P8`). Tauri signs the app and the server
sidecar with the hardened runtime and `studio/tauri/entitlements.plist`, then
notarizes and staples the app. A follow-up step re-staples with retries (and
rewrites the dmg if its app is unstapled), and step 4 checks `codesign`, the
stapled ticket and Gatekeeper (`spctl`) on the app inside the dmg. The
Developer ID certificate expires Nov 24, 2027; renew it before then and replace
the three certificate secrets.

**Standalone server signing** (Build Server with `sign`, set by release.yml):
the macOS servers get a Developer ID signature with the hardened runtime and
`studio/tauri/entitlements.plist`, then notarization (a bare binary cannot hold
a stapled ticket, so Gatekeeper checks it online on first run). `server.exe`
is signed with `scripts/sign-windows.ps1`. The jobs use the same `macos-signing`
and `windows-signing` environments.

**Standalone Full builds**: a manual run has no server artifacts of its own.
Run Build Server first and pass its run id as `server-run-id`.

**Pre-release versions**: the tag's full version is written to the app. On
Linux `scripts/build.py` packages the rpm of a pre-release as `X.Y.Z-0.rc.N`
because rpm versions cannot contain `-`.

**Can be tested standalone**:
```bash
gh workflow run build-studio-tauri.yml -f variant=client
```

---

#### 5. build-web.yml - Web Version Build (Reusable)
**Trigger**: Called by other workflows via `workflow_call`

**Purpose**: Build static web files (no desktop wrapper)

**Platform**: Ubuntu only

**Output**:
- `web-dist-zip` artifact (dist-web.zip)

**Build Process**:
1. Runs bun install --frozen-lockfile
2. Executes bun run build:web:zip
3. Creates dist-web.zip with static files

**Can be tested standalone**:
```bash
gh workflow run build-web.yml
```

---

#### 6. release.yml - Release Orchestrator
**Trigger**:
- Git tags matching `v*` (e.g., v1.0.0 or v1.0.0-rc.1)
- Manual workflow_dispatch (does nothing unless dispatched on a tag ref)

**Purpose**: Coordinate all builds and create a DRAFT GitHub Release

**Job Flow**:
```
validate-tag-on-main
    |
    +-- build-server
    |       |
    |       +-- build-studio (Full and Client; Full needs the server)
    |
    +-- build-web (parallel)
    |
    +-- publish-assets (waits for all)
```

**Validation** (`validate-tag-on-main`, all before anything is built):
- The tag must be semver: `vMAJOR.MINOR.PATCH` with an optional `-prerelease`
  suffix. Anything else fails the run.
- The tagged commit must be on `main`, otherwise the run is skipped.
- The tagged commit must have a passing CI run (`ci.yml`, `push` or
  `workflow_dispatch` event). `.github/scripts/check_ci_status.py` waits for a
  run that is still in progress and fails if CI failed or never ran. CI skips
  documentation-only pushes, so if the tagged commit only touched markdown or
  `docs/`, or its run was cancelled by a newer push, start CI by hand
  (Actions > CI > Run workflow on main) and re-run the release workflow.

**Artifact Naming**:
- `Sigilweaver-Loom-{VERSION}-x64.AppImage`, `.deb` and `.rpm`
- `Sigilweaver-Loom-Setup-{VERSION}.exe`
- `Sigilweaver-Loom-{VERSION}-arm64.dmg` and `-x64.dmg`
- The same six with `Sigilweaver-Loom-Client-` in place of `Sigilweaver-Loom-`
- `Sigilweaver-Loom-Web-{VERSION}.zip`
- `SHA256SUMS.txt`

Each installer is staged by name and the run fails if one is missing (or
matches more than one file), so a draft release is never created with a
platform missing.

**Publishing**:
- Creates the GitHub Release as a **draft** with all artifacts and generated
  release notes. Nothing is public until a maintainer publishes the draft.
- Tags with a `-` suffix are marked as **pre-release** automatically.
- Publishing the draft in the GitHub UI is what triggers `mirror-release.yml`
  and `docker-build.yml` (see below).

---

#### 7. mirror-release.yml - R2 Mirror
**Trigger**: A release is published (draft -> published), or manual
`workflow_dispatch` with a `tag` input to re-mirror an existing release.

**Purpose**: Download the published release's assets and mirror them to
Cloudflare R2 with the download manifests, using
`.github/scripts/upload_to_r2.py`. Doing this on publish rather than at build
time means the download site never serves a build that has not been reviewed.

**Pre-releases** (tag with a `-` suffix, or a release marked as pre-release):
assets and manifests go to `releases/loom/{tag}/` only. The stable
`releases/loom/index.json`, which the website reads to find the latest
download, is not touched and its `latest` pointer never moves to a pre-release.

**Secrets**: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
`R2_ENDPOINT_URL`, `R2_CDN_URL` (optional).

---

#### 8. docker-build.yml - Container Images
**Trigger**: A release is published, or manual `workflow_dispatch` with a
`version` (and optional `tag_latest`) input.

**Purpose**: Build the Hub (`hub/Dockerfile`) and Server (`server/Dockerfile`)
images for linux/amd64 and push them to `ghcr.io`.

**Tags**: a stable release pushes `X.Y.Z`, `X.Y` and `latest`. A pre-release
pushes only its exact version tag. Manual dispatch pushes `latest` only when
`tag_latest` is set and the version is not a pre-release.

---

#### 9. audit.yml - Dependency Audit
**Trigger**: Pushes and PRs that touch a lockfile or manifest, a weekly
schedule (Mondays 06:00 UTC), and manual dispatch.

**Jobs**: `pip-audit` (server, hub/backend), `bun audit` (hub/frontend,
studio) and `cargo audit` (studio/tauri).

**Policy**: fix advisories with an in-range lockfile bump or an `overrides`
entry in `package.json`. An `--ignore` is only acceptable when no fixed
release exists, and it needs a comment in the workflow saying why and when it
can be removed. No advisory IDs are currently ignored. JavaScript audit jobs enforce high/critical severity;
run `bun audit` locally to inspect findings at every severity.

---

---

## Testing Workflows

### Test Individual Workflows

Each reusable workflow has `workflow_dispatch` enabled for manual testing:

```bash
# Test server builds
gh workflow run build-server.yml

# Test studio installers (Full needs server artifacts from the same run, so
# run build-server first or use variant=client)
gh workflow run build-studio-tauri.yml -f variant=client

# Test web build
gh workflow run build-web.yml

# Test the full release flow: push a pre-release tag (see below)
```

### Test Release Flow

Releases are created as drafts, so a test tag never publishes anything and
the `-` suffix makes it a pre-release. The tagged commit must be on `main` and
have a passing CI run.

1. Create a test tag locally:
```bash
git tag v0.0.1-test
```

2. Push the tag:
```bash
git push origin v0.0.1-test
```

3. Monitor in GitHub Actions tab, then inspect the draft release. Publishing
it also exercises the R2 mirror and Docker images (as a pre-release, so the
stable index and `latest` tags are untouched).

4. Clean up:
```bash
git tag -d v0.0.1-test
git push origin :refs/tags/v0.0.1-test
gh release delete v0.0.1-test --yes
```

---

## Workflow Dependencies

### Permissions Required

**All workflows**:
- `contents: read` unless stated otherwise

**release.yml**:
- `contents: write` (publish-assets job creates the release)
- `actions: read` (validate-tag-on-main job queries CI runs)

**docker-build.yml** (build jobs):
- `packages: write` (push to ghcr.io)

### Secrets Used

**GITHUB_TOKEN**:
- Automatically provided by GitHub Actions
- Used to create the release, push images to ghcr.io and query CI runs

**R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT_URL, R2_CDN_URL**:
- Repository secrets used by `mirror-release.yml`

### External Actions

Versions are kept current by Dependabot (`.github/dependabot.yml`); check the
workflow files for the exact pins. In use:

- `actions/checkout` - Repository checkout
- `actions/setup-python` and `astral-sh/setup-uv` - Python environment
- `oven-sh/setup-bun` - bun environment
- `actions/upload-artifact` and `actions/download-artifact` - Artifact storage
- `softprops/action-gh-release` - GitHub Release creation
- `docker/setup-buildx-action`, `docker/login-action`,
  `docker/build-push-action` - Container images (pinned by commit SHA)
- `dtolnay/rust-toolchain`, `swatinem/rust-cache`, `taiki-e/install-action` -
  Rust builds and `cargo audit`
- `azure/trusted-signing-action` - Windows code signing

---

## Artifact Lifecycle

### Build Artifacts (Temporary)

**Retention**: 90 days (GitHub default)

**Purpose**: Pass build outputs between jobs

**Artifacts**:
- `server-linux`, `server-win`, `server-mac-arm64`, `server-mac-x64`
  (one PyInstaller executable each)
- `studio-full-{linux-x64,windows-x64,macos-arm64,macos-x64}`
- `studio-client-{linux-x64,windows-x64,macos-arm64,macos-x64}`
- `web-dist-zip` (~5MB)

### Release Assets (Permanent)

**Retention**: Indefinite (attached to GitHub Release)

**Location**: GitHub Releases page

**Downloads**: Public via GitHub UI or direct URLs

---

## Troubleshooting

### Common Issues

**1. Build fails on specific platform**:
- Check platform-specific job logs
- Reproduce locally with `./scripts/build.py` (see `scripts/README.md`)
- Check the `tauri build` output in the Build Studio step

**2. Server artifact not found**:
- Ensure build-server.yml completed successfully
- Check artifact name matches in download step
- Verify needs: dependency in release.yml

**3. Release doesn't trigger, or stops at validation**:
- Verify the tag is semver and starts with 'v' (e.g., v1.0.0 or v1.0.0-rc.1)
- Check tag commit is on main branch (otherwise the run is skipped)
- Check the tagged commit has a passing CI run; see the CI gate notes above
- Review validate-tag-on-main job output

**4. Sidecar not found**:
- A Full build needs `studio/tauri/binaries/loom-server-<target-triple>`.
  `scripts/build.py --studio-only` stages it from `server/dist/`
- Check the server artifact was downloaded to `server/dist/`

**5. Smoke test fails**:
- The log shows the app's own output. Look for the `[Backend]` lines
- "port 25811 is already in use" means a previous run left a server behind

**6. Windows installer missing**:
- Check the Build Studio step produced `bundle/nsis/*-setup.exe`
- Review the signing step if `sign` was set

### Debug Mode

Enable debug logging in any workflow:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

---

## Maintenance

### Updating bun Version

bun is installed via `oven-sh/setup-bun@v2` (latest by default). To pin a
specific version, add `bun-version:` to the setup-bun step in these files:
- `.github/workflows/ci.yml`
- `.github/workflows/build-studio-tauri.yml`
- `.github/workflows/build-web.yml`

### Updating Python Version

The server build and CI read the version from `server/.python-version`.
Also update the base images in `server/Dockerfile` and `hub/Dockerfile`, and
`python-version` in `.github/workflows/mirror-release.yml`.

### Adding New Platforms

1. Add to the matrix in build-server.yml and build-studio-tauri.yml
2. Add the bundle target to `bundle.targets` in studio/tauri/tauri.conf.json
3. Update the asset preparation and validation steps in release.yml, and the
   asset detection in `.github/scripts/lib/asset_detector.py`

---

## Performance

### Typical Execution Times

**CI (Pull Request)**:
- Test & Lint job (server, Studio, Hub): several minutes; the Hub backend
  suite is the longest
- Docker build check and Tauri check run in parallel

**Release Build**:
- Server builds (4 targets): ~5-7 minutes (parallel)
- Studio builds (Full and Client, 4 targets each): parallel; Full waits for
  the server
- Web build: ~2-3 minutes (parallel)
- Publish: ~1-2 minutes
- **Total: ~25-30 minutes**

### Optimization Opportunities

- Cache bun dependencies (already enabled)
- Cache Python dependencies (could add)
- Use matrix strategies for parallelization (already done)
- Reusable workflows reduce duplication (already done)

---

## Version History

**Current**:
- Modular workflow structure with reusable workflows
- Variant-based builds (full vs client)
- Multi-platform matrix strategies
- Draft releases with a CI gate, publish-time R2 mirror and Docker images
