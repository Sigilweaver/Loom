# CI/CD Workflow Documentation

## Workflow Structure

The CI/CD system uses a modular approach with reusable workflows for better maintainability and testing.

### Workflow Files

#### 1. ci.yml - Continuous Integration
**Trigger**: Pull requests and pushes to `main`

**Purpose**: Validates code quality and runs tests

**Jobs**:
- Backend tests (pytest, ruff, mypy)
- Frontend tests (vitest, eslint, tsc)
- Web build verification

**Usage**:
- Automatically runs on all PRs
- Blocks merging if tests fail
- Uploads coverage artifacts

---

#### 2. build-backend.yml - Backend Builds (Reusable)
**Trigger**: Called by other workflows via `workflow_call`

**Purpose**: Build Python backend executables for all platforms

**Matrix Strategy**: 
- Linux (ubuntu-latest)
- Windows (windows-latest) 
- macOS (macos-latest)

**Outputs**:
- `backend-linux` artifact
- `backend-windows` artifact
- `backend-macos` artifact

**Build Process**:
1. Sets up Python environment
2. Creates venv and installs dependencies
3. Runs PyInstaller with sigilweaver.spec
4. Uploads platform-specific executable

**Can be tested standalone**:
```bash
gh workflow run build-backend.yml
```

---

#### 3. build-frontend-full.yml - Full Version Builds (Reusable)
**Trigger**: Called by other workflows via `workflow_call`

**Purpose**: Build Electron apps with bundled backend

**Matrix Strategy**:
- Linux (AppImage + Snap with classic confinement)
- Windows (NSIS installer + Portable)
- macOS (DMG)

**Dependencies**:
- Requires backend artifacts from build-backend.yml

**Outputs**:
- `linux-full-artifacts` (AppImage, Snap)
- `windows-full-artifacts` (Setup.exe, Portable.exe)
- `macos-full-artifacts` (DMG)

**Build Process**:
1. Downloads backend-{platform} artifact
2. Copies to frontend/resources/backend/
3. Makes executable (Linux/macOS)
4. Runs npm run build:{platform}:full
5. Uses electron-builder-full.json config

**Product Name**: Sigilweaver (no suffix)

**Can be tested standalone**:
```bash
gh workflow run build-frontend-full.yml
```

---

#### 4. build-frontend-client.yml - Client Version Builds (Reusable)
**Trigger**: Called by other workflows via `workflow_call`

**Purpose**: Build Electron apps without bundled backend

**Matrix Strategy**:
- Linux (AppImage + Snap with strict confinement)
- Windows (NSIS installer + Portable)
- macOS (DMG)

**Dependencies**: None (no backend required)

**Outputs**:
- `linux-client-artifacts` (AppImage, Snap)
- `windows-client-artifacts` (Setup.exe, Portable.exe)
- `macos-client-artifacts` (DMG)

**Build Process**:
1. Installs npm dependencies
2. Runs npm run build:{platform}:client
3. Uses electron-builder-client.json config

**Product Name**: Sigilweaver-Client (with suffix)

**Can be tested standalone**:
```bash
gh workflow run build-frontend-client.yml
```

---

#### 5. build-web.yml - Web Version Build (Reusable)
**Trigger**: Called by other workflows via `workflow_call`

**Purpose**: Build static web files (no Electron wrapper)

**Platform**: Ubuntu only

**Output**:
- `web-dist-zip` artifact (dist-web.zip)

**Build Process**:
1. Runs npm ci
2. Executes npm run build:web:zip
3. Creates dist-web.zip with static files

**Can be tested standalone**:
```bash
gh workflow run build-web.yml
```

---

#### 6. release.yml - Release Orchestrator
**Trigger**: 
- Git tags matching `v*` (e.g., v1.0.0)
- Manual workflow_dispatch

**Purpose**: Coordinate all builds and publish to GitHub Releases

**Job Flow**:
```
validate-tag-on-main
    |
    +-- build-backend
    |       |
    |       +-- build-frontend-full (depends on backend)
    |
    +-- build-frontend-client (parallel to full)
    |
    +-- build-web (parallel)
    |
    +-- publish-assets (waits for all)
```

**Validation**: Only runs if tag commit is on `main` branch

**Artifact Naming**:
- `Sigilweaver-{VERSION}-x64.AppImage`
- `Sigilweaver-{VERSION}-x64.snap`
- `Sigilweaver-Setup-{VERSION}.exe`
- `Sigilweaver-Portable-{VERSION}.exe`
- `Sigilweaver-{VERSION}.dmg`
- `Sigilweaver-Client-{VERSION}-x64.AppImage`
- `Sigilweaver-Client-{VERSION}-x64.snap`
- `Sigilweaver-Client-Setup-{VERSION}.exe`
- `Sigilweaver-Client-Portable-{VERSION}.exe`
- `Sigilweaver-Client-{VERSION}.dmg`
- `Sigilweaver-Web-{VERSION}.zip`
- `SHA256SUMS.txt`

**Publishing**:
- Creates GitHub Release with version tag
- Uploads all artifacts
- Generates release notes automatically
- Not marked as draft or prerelease

---

## Testing Workflows

### Test Individual Workflows

Each reusable workflow has `workflow_dispatch` enabled for manual testing:

```bash
# Test backend builds
gh workflow run build-backend.yml

# Test full frontend builds
gh workflow run build-frontend-full.yml

# Test client frontend builds  
gh workflow run build-frontend-client.yml

# Test web build
gh workflow run build-web.yml

# Test complete release (without publishing)
gh workflow run release.yml
```

### Test Release Flow

1. Create a test tag locally:
```bash
git tag v0.0.1-test
```

2. Push the tag:
```bash
git push origin v0.0.1-test
```

3. Monitor in GitHub Actions tab

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
- `contents: read` (implicit)

**release.yml** (publish-assets job):
- `contents: write` (for creating releases)

### Secrets Used

**GH_TOKEN**: 
- Automatically provided by GitHub Actions
- Used by electron-builder for publishing
- No manual setup required

### External Actions

- `actions/checkout@v4` - Repository checkout
- `actions/setup-python@v5` - Python environment
- `actions/setup-node@v4` - Node.js environment  
- `actions/upload-artifact@v4` - Artifact storage
- `actions/download-artifact@v4` - Artifact retrieval
- `softprops/action-gh-release@v2` - GitHub Release creation

---

## Artifact Lifecycle

### Build Artifacts (Temporary)

**Retention**: 90 days (GitHub default)

**Purpose**: Pass build outputs between jobs

**Artifacts**:
- `backend-linux` (61MB)
- `backend-windows` (70MB)
- `backend-macos` (65MB)
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
- Test locally with `./scripts/build-{variant}.sh {platform}`
- Verify electron-builder config for that platform

**2. Backend artifact not found**:
- Ensure build-backend.yml completed successfully
- Check artifact name matches in download step
- Verify needs: dependency in release.yml

**3. Release doesn't trigger**:
- Verify tag starts with 'v' (e.g., v1.0.0)
- Check tag commit is on main branch
- Review validate-tag-on-main job output

**4. Snap build fails**:
- Snapcraft may need classic confinement for full version
- Check electron-builder-full.json has `confinement: classic`
- Client version uses strict confinement

**5. Windows build missing exe**:
- Verify npm run build:win:{variant} creates dist/ directory
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

### Updating Node Version

Update in these files:
- `.github/workflows/ci.yml` (setup-node)
- `.github/workflows/build-frontend-full.yml` (input default)
- `.github/workflows/build-frontend-client.yml` (input default)
- `.github/workflows/build-web.yml` (input default)
- `.github/workflows/release.yml` (workflow_call inputs)

### Updating Python Version

Update in these files:
- `.github/workflows/ci.yml` (setup-python)
- `.github/workflows/build-backend.yml` (input default)
- `.github/workflows/release.yml` (workflow_call inputs)

### Adding New Platforms

1. Add to matrix in build-frontend-*.yml
2. Update frontend/package.json with new build script
3. Add platform-specific config to electron-builder-*.json
4. Update release.yml asset preparation script

---

## Performance

### Typical Execution Times

**CI (Pull Request)**:
- Backend tests: ~2-3 minutes
- Frontend tests: ~2-3 minutes
- Total: ~5-6 minutes (parallel)

**Release Build**:
- Backend builds (3 platforms): ~5-7 minutes (parallel)
- Frontend full builds (3 platforms): ~15-20 minutes (parallel after backend)
- Frontend client builds (3 platforms): ~10-15 minutes (parallel)
- Web build: ~2-3 minutes (parallel)
- Publish: ~1-2 minutes
- **Total: ~25-30 minutes**

### Optimization Opportunities

- Cache npm dependencies (already enabled)
- Cache Python dependencies (could add)
- Use matrix strategies for parallelization (already done)
- Reusable workflows reduce duplication (already done)

---

## Version History

**v1.0 (Current)**: 
- Modular workflow structure with reusable workflows
- Variant-based builds (full vs client)
- Multi-platform matrix strategies
- Automatic release publishing
