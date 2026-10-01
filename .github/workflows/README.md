# CI/CD Workflow Documentation

## Workflow Structure

The CI/CD system uses a modular approach with reusable workflows for better maintainability and testing.

### Workflow Files

#### 1. ci.yml - Continuous Integration
**Trigger**: Pull requests and pushes on any branch, excluding changes that
only touch markdown or `docs/**`

**Purpose**: Validates code quality and runs tests

**Jobs**:
- Tauri crate check (`cargo check --locked`, clippy)
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
- macOS (macos-latest)

**Outputs**:
- `server-linux` artifact
- `server-windows` artifact
- `server-macos` artifact

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

#### 4. build-studio-full.yml - Full Version Builds (Reusable)
**Trigger**: Called by other workflows via `workflow_call`

**Purpose**: Build Electron apps with bundled server

**Matrix Strategy**:
- Linux (AppImage + Snap with classic confinement)
- Windows (NSIS installer + Portable)
- macOS (DMG)

**Dependencies**:
- Requires server artifacts from build-server.yml

**Outputs**:
- `linux-full-artifacts` (AppImage, Snap)
- `windows-full-artifacts` (Setup.exe, Portable.exe)
- `macos-full-artifacts` (DMG)

**Build Process**:
1. Downloads server-{platform} artifact
2. Copies to studio/resources/server/
3. Makes executable (Linux/macOS)
4. Runs bun run build:{platform}:full
5. Uses electron-builder-full.json config

**Product Name**: Sigilweaver Loom (no suffix)

**Can be tested standalone**:
```bash
gh workflow run build-studio-full.yml
```

---

#### 5. build-studio-client.yml - Client Version Builds (Reusable)
**Trigger**: Called by other workflows via `workflow_call`

**Purpose**: Build Electron apps without bundled server

**Matrix Strategy**:
- Linux (AppImage + Snap with strict confinement)
- Windows (NSIS installer + Portable)
- macOS (DMG)

**Dependencies**: None (no server required)

**Outputs**:
- `linux-client-artifacts` (AppImage, Snap)
- `windows-client-artifacts` (Setup.exe, Portable.exe)
- `macos-client-artifacts` (DMG)

**Build Process**:
1. Installs bun dependencies
2. Runs bun run build:{platform}:client
3. Uses electron-builder-client.json config

**Product Name**: Sigilweaver-Loom-Client (with suffix)

**Can be tested standalone**:
```bash
gh workflow run build-studio-client.yml
```

---

#### 6. build-web.yml - Web Version Build (Reusable)
**Trigger**: Called by other workflows via `workflow_call`

**Purpose**: Build static web files (no Electron wrapper)

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

#### 7. release.yml - Release Orchestrator
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
    |       +-- build-studio-full (depends on server)
    |
    +-- build-studio-client (parallel to full)
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
- `Sigilweaver-Loom-{VERSION}-x64.AppImage`
- `Sigilweaver-Loom-{VERSION}-x64.snap`
- `Sigilweaver-Loom-Setup-{VERSION}.exe`
- `Sigilweaver-Loom-Portable-{VERSION}.exe`
- `Sigilweaver-Loom-{VERSION}.dmg`
- `Sigilweaver-Loom-Client-{VERSION}-x64.AppImage`
- `Sigilweaver-Loom-Client-{VERSION}-x64.snap`
- `Sigilweaver-Loom-Client-Setup-{VERSION}.exe`
- `Sigilweaver-Loom-Client-Portable-{VERSION}.exe`
- `Sigilweaver-Loom-Client-{VERSION}.dmg`
- `Sigilweaver-Loom-Web-{VERSION}.zip`
- `SHA256SUMS.txt`

Missing expected assets are reported as warnings and in the run summary but do
not fail the run (snap builds can be flaky); check the draft before publishing.

**Publishing**:
- Creates the GitHub Release as a **draft** with all artifacts and generated
  release notes. Nothing is public until a maintainer publishes the draft.
- Tags with a `-` suffix are marked as **pre-release** automatically.
- Publishing the draft in the GitHub UI is what triggers `mirror-release.yml`
  and `docker-build.yml` (see below).
- The Tauri build (`build-studio-tauri.yml`) is not part of the release yet
  (see Loom#107).

---

#### 8. mirror-release.yml - R2 Mirror
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

#### 9. docker-build.yml - Container Images
**Trigger**: A release is published, or manual `workflow_dispatch` with a
`version` (and optional `tag_latest`) input.

**Purpose**: Build the Hub (`hub/Dockerfile`) and Server (`server/Dockerfile`)
images for linux/amd64 and push them to `ghcr.io`.

**Tags**: a stable release pushes `X.Y.Z`, `X.Y` and `latest`. A pre-release
pushes only its exact version tag. Manual dispatch pushes `latest` only when
`tag_latest` is set and the version is not a pre-release.

---

#### 10. audit.yml - Dependency Audit
**Trigger**: Pushes and PRs that touch a lockfile or manifest, a weekly
schedule (Mondays 06:00 UTC), and manual dispatch.

**Jobs**: `pip-audit` (server, hub/backend), `bun audit` (hub/frontend,
studio) and `cargo audit` (studio/tauri).

**Policy**: fix advisories with an in-range lockfile bump or an `overrides`
entry in `package.json`. An `--ignore` is only acceptable when no fixed
release exists, and it needs a comment in the workflow saying why and when it
can be removed. No advisory IDs are currently ignored. Electron now uses
`@electron-internal/extract-zip`, so Studio's former extract-zip exceptions
were removed (Loom#148). JavaScript audit jobs enforce high/critical severity;
run `bun audit` locally to inspect findings at every severity.

---

#### 11. build-studio-tauri.yml - Tauri Build (Reusable, not yet released)
**Trigger**: `workflow_dispatch` or `workflow_call`

**Purpose**: Build the Tauri desktop app (Linux, Windows, macOS arm64).

Not called by `release.yml`: it has no bundled-server ("full") variant, no
macOS x64 build, produces artifacts that `release.yml` and the R2 asset
detection do not name or list, and has never run as part of a release. Tracked
in Loom#107.

---

## Testing Workflows

### Test Individual Workflows

Each reusable workflow has `workflow_dispatch` enabled for manual testing:

```bash
# Test server builds
gh workflow run build-server.yml

# Test full studio builds
gh workflow run build-studio-full.yml

# Test client studio builds
gh workflow run build-studio-client.yml

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
- The Electron build workflows also pass it to electron-builder as `GH_TOKEN`

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
- `server-linux` (61MB)
- `server-windows` (70MB)
- `server-macos` (65MB)
- `linux-full-artifacts` (~150-200MB)
- `windows-full-artifacts` (~150-200MB)
- `macos-full-artifacts` (~150-200MB)
- `linux-client-artifacts` (~100MB)
- `windows-client-artifacts` (~100MB)
- `macos-client-artifacts` (~100MB)
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
- Verify electron-builder config for that platform

**2. Server artifact not found**:
- Ensure build-server.yml completed successfully
- Check artifact name matches in download step
- Verify needs: dependency in release.yml

**3. Release doesn't trigger, or stops at validation**:
- Verify the tag is semver and starts with 'v' (e.g., v1.0.0 or v1.0.0-rc.1)
- Check tag commit is on main branch (otherwise the run is skipped)
- Check the tagged commit has a passing CI run; see the CI gate notes above
- Review validate-tag-on-main job output

**4. Snap build fails**:
- Snapcraft may need classic confinement for full version
- Check electron-builder-full.json has `confinement: classic`
- Client version uses strict confinement

**5. Windows build missing exe**:
- Verify bun run build:win:{variant} creates dist/ directory
- Check electron-builder config has correct targets (nsis, portable)
- Review Windows runner logs for electron-builder errors

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
- `.github/workflows/build-studio-full.yml`
- `.github/workflows/build-studio-client.yml`
- `.github/workflows/build-studio-tauri.yml`
- `.github/workflows/build-web.yml`

### Updating Python Version

The server build and CI read the version from `server/.python-version`.
Also update the base images in `server/Dockerfile` and `hub/Dockerfile`, and
`python-version` in `.github/workflows/mirror-release.yml`.

### Adding New Platforms

1. Add to matrix in build-studio-*.yml
2. Update studio/package.json with new build script
3. Add platform-specific config to electron-builder-*.json
4. Update the asset preparation and validation steps in release.yml, and the
   asset detection in `.github/scripts/lib/asset_detector.py`

---

## Performance

### Typical Execution Times

**CI (Pull Request)**:
- Test & Lint job (server, Studio, Hub): several minutes; the Hub backend
  suite is the longest
- Docker build check and Tauri check run in parallel

**Release Build**:
- Server builds (3 platforms): ~5-7 minutes (parallel)
- Studio full builds (3 platforms): ~15-20 minutes (parallel after server)
- Studio client builds (3 platforms): ~10-15 minutes (parallel)
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
