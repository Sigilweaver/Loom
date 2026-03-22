# Development Scripts

Utility scripts for building, testing, and running Sigilweaver Loom.

## Quick Reference

```bash
# Development
./scripts/dev.py                    # Start all dev servers (Server, Studio, Hub)
./scripts/dev.py --server           # Server only
./scripts/dev.py --studio           # Studio only  
./scripts/dev.py --hub              # Hub (backend + frontend)
./scripts/dev.py --studio-electron  # All + launch Electron desktop app
./scripts/dev.py --studio-tauri     # All + launch Tauri desktop app

# Testing
./scripts/test.py                   # Smart mode: only test changed components
./scripts/test.py --full            # Run ALL tests (CI mode)
./scripts/test.py --server          # Server tests only
./scripts/test.py --studio          # Studio tests only
./scripts/test.py --hub             # Hub tests only
./scripts/test.py --ci              # CI mode (XML coverage output)
./scripts/test.py -p                # Parallel execution (faster)
./scripts/test.py --dry-run         # Show what would run

# CI/CD Workflow Testing (Local)
./scripts/workflow.py               # List available workflows
./scripts/workflow.py ci --dry-run  # Preview CI workflow
./scripts/workflow.py ci            # Run CI workflow locally
./scripts/workflow.py ci --job test # Run specific job

# Building
./scripts/build.py                  # Build for current platform
./scripts/build.py --platform linux # Build for Linux
./scripts/build.py --platform win   # Build for Windows
./scripts/build.py --platform mac   # Build for macOS
```

---

## Development Scripts

### `dev.py`
**Purpose**: Start development servers for all components

**Usage**:
```bash
./scripts/dev.py                    # Start all (Server, Studio, Hub)
./scripts/dev.py --all              # Same as above (explicit)
./scripts/dev.py --server           # Server only
./scripts/dev.py --studio           # Studio only
./scripts/dev.py --hub              # Hub (backend + frontend)
./scripts/dev.py --docs             # Documentation site (Docusaurus)
./scripts/dev.py --site             # Marketing website (Vite)
./scripts/dev.py --studio-electron  # All + launch Electron desktop app
./scripts/dev.py --studio-tauri     # All + launch Tauri desktop app
./scripts/dev.py --hub-auth         # All with Hub authentication enabled
./scripts/dev.py --install          # Force reinstall dependencies (then exit)
```

**Ports**:
| Service      | Port                   |
| ------------ | ---------------------- |
| PostgreSQL   | localhost:25801        |
| Server       | http://localhost:25811 |
| Studio       | http://localhost:25810 |
| Hub Backend  | http://localhost:25802 |
| Hub Frontend | http://localhost:25803 |
| Docs         | http://localhost:25809 |
| Site         | http://localhost:25808 |

Press `Ctrl+C` to stop all services.

---

## Testing Scripts

### `test.py`
**Purpose**: Unified test runner for all components with smart change detection

**Usage**:
```bash
# Smart mode (default): only test changed components
./scripts/test.py

# Full mode: run all tests
./scripts/test.py --full

# Specific components
./scripts/test.py --server          # Server tests only
./scripts/test.py --studio          # Studio tests only
./scripts/test.py --hub             # Hub tests only
./scripts/test.py --docs            # Docs build check
./scripts/test.py --site            # Site build check
./scripts/test.py --integration     # Integration tests only

# CI mode (for GitHub Actions)
./scripts/test.py --ci              # Full tests with XML coverage

# Performance options
./scripts/test.py -p                # Parallel execution (faster)
./scripts/test.py --no-coverage     # Skip coverage (even faster)
./scripts/test.py -v                # Verbose output
./scripts/test.py --dry-run         # Preview what would run
```

**Flags**:
| Flag               | Description                                         |
| ------------------ | --------------------------------------------------- |
| `--full`           | Run full test suite (bypass smart mode)             |
| `--ci`             | CI mode: XML coverage, optimized for GitHub Actions |
| `--server`         | Run server checks (ruff + mypy + pytest)            |
| `--studio`         | Run studio checks (tsc + eslint + vitest)           |
| `--hub`            | Run hub checks (backend + frontend)                 |
| `--docs`           | Run docs build check                                |
| `--site`           | Run site build check                                |
| `--integration`    | Run integration tests only                          |
| `--no-integration` | Skip integration tests                              |
| `--no-coverage`    | Skip coverage reports (faster)                      |
| `--strict`         | Fail on lint/type warnings                          |
| `-p, --parallel`   | Run test suites in parallel                         |
| `-v, --verbose`    | Show all output                                     |
| `--dry-run`        | Show what would run without running                 |

**Smart Mode**:
By default, `test.py` uses git to detect changed files and only runs tests for affected components. Use `--full` for complete validation before merging.

---

## CI/CD Workflow Testing

### `workflow.py`
**Purpose**: Test GitHub Actions workflows locally using `act`

**Usage**:
```bash
# List available workflows
./scripts/workflow.py

# Dry run (validate YAML, preview steps)
./scripts/workflow.py ci --dry-run
./scripts/workflow.py release --dry-run

# Run workflows locally
./scripts/workflow.py ci                    # Run CI workflow
./scripts/workflow.py ci --job test         # Run specific job
./scripts/workflow.py build-server          # Run server build

# Setup
./scripts/workflow.py --init-secrets        # Create secrets template
```

**Flags**:
| Flag             | Description                                 |
| ---------------- | ------------------------------------------- |
| `--dry-run, -n`  | Preview without execution                   |
| `--job, -j`      | Run specific job within workflow            |
| `--verbose, -v`  | Verbose output                              |
| `--event, -e`    | Event type to simulate (push, pull_request) |
| `--init-secrets` | Create `.act.secrets` template              |

**Requirements**:
- Docker must be running
- `act` is installed automatically if not present

**Secrets**:
Create `.act.secrets` (gitignored) with your secrets for local testing:
```
GITHUB_TOKEN=ghp_xxxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
```

---

## Build Scripts

### `build.py`
**Purpose**: Build complete standalone application for distribution

**Usage**:
```bash
./scripts/build.py                      # Build for current platform
./scripts/build.py --platform linux     # Build for Linux
./scripts/build.py --platform win       # Build for Windows
./scripts/build.py --platform mac       # Build for macOS
./scripts/build.py --server-only       # Build server only
./scripts/build.py --studio-only       # Build studio only (assumes server already built)
./scripts/build.py --clean              # Clean artifacts before building
```
- Final packages: `studio/dist/` (AppImage, DMG, exe, etc.)

**Examples**:
```bash
# Build for current platform
./scripts/build.py

# Build for Linux specifically
./scripts/build.py --platform linux

# Build for Windows (cross-compile)
./scripts/build.py --platform win

# Build for macOS (on Mac only)
./scripts/build.py --platform mac

# Quick server iteration
./scripts/build.py --server-only

# Rebuild studio after server change
./scripts/build.py --studio-only

# Clean build
./scripts/build.py --clean
```

---

## Other Helper Scripts

### `r2.py`
Manage R2 bucket: list contents and download files via CDN.

**Usage**:
```bash
# List bucket contents
./scripts/r2.py list [path]          # List specific path
./scripts/r2.py list                 # List root
./scripts/r2.py list latest/         # List /latest/
./scripts/r2.py list -r              # Recursive list all files

# Download files via CDN
./scripts/r2.py download [path]      # Download specific path
./scripts/r2.py download             # Download everything
./scripts/r2.py download latest/     # Download /latest/ only
./scripts/r2.py download --dry-run   # Show what would be downloaded
```

**Downloads to**: `.untracked/r2/sigilweaver-loom-downloads/`

**Features**:
- Uses CDN URL for downloads
- Uses S3 API for listing only
- Skips files that already exist locally with same size
- Shows download progress

**Requires**: `.env` file with R2 credentials, `boto3` Python package.

---

## Typical Workflows

### Development Cycle
```bash
# 1. Start dev servers
./scripts/dev.py

# 2. Make changes, then test (smart mode auto-detects changes)
./scripts/test.py

# 3. Run full tests before PR
./scripts/test.py --full
```

### Pre-Commit Validation
```bash
# Run smart tests (fast)
./scripts/test.py

# Or full validation
./scripts/test.py --full -p
```

### CI Workflow Development
```bash
# 1. Make changes to .github/workflows/ci.yml
# 2. Validate YAML and preview
./scripts/workflow.py ci --dry-run

# 3. Test locally before pushing
./scripts/workflow.py ci

# 4. Push when ready
git push
```

### Production Build
```bash
# Full build for release
./scripts/build.py

# Clean build
./scripts/build.py --clean
