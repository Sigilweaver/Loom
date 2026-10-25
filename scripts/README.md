# Development Scripts

Utility scripts for building, testing, and running Sigilweaver Loom.

## Quick Reference

```bash
# Development
./scripts/dev.py                    # Start all dev servers (Server, Studio, Hub)
./scripts/dev.py --server           # Server only
./scripts/dev.py --studio           # Studio only  
./scripts/dev.py --hub              # Hub (backend + frontend)
./scripts/dev.py --studio-tauri     # All + launch Tauri desktop app

# Testing
./scripts/test.py                   # Smart mode: only test changed components
./scripts/test.py --full            # Run ALL tests (CI mode)
./scripts/test.py --server          # Server tests only
./scripts/test.py --studio          # Studio tests only
./scripts/test.py --hub             # Hub tests only
./scripts/test.py --repo            # Repo tooling checks only (ruff + release script tests)
./scripts/test.py --ci              # CI mode (XML coverage output)
./scripts/test.py -p                # Parallel execution (faster)
./scripts/test.py --dry-run         # Show what would run

# CI/CD Workflow Testing (Local)
./scripts/workflow.py               # List available workflows
./scripts/workflow.py ci --dry-run  # Preview CI workflow
./scripts/workflow.py ci            # Run CI workflow locally
./scripts/workflow.py ci --job test # Run specific job

# Building
./scripts/build.py                  # Full desktop build for this machine
./scripts/build.py --client         # Client build (no bundled server)
python3 scripts/smoke_desktop.py --app <binary>  # Launch a built app and check it
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
| `--repo`           | Run repo tooling checks (ruff, release script tests) |
| `--integration`    | Run integration tests only                          |
| `--no-integration` | Skip integration tests                              |
| `--no-coverage`    | Skip coverage reports (faster)                      |
| `--strict`         | Fail on lint/type warnings                          |
| `-p, --parallel`   | Run test suites in parallel                         |
| `-v, --verbose`    | Show all output                                     |
| `--dry-run`        | Show what would run without running                 |

**Smart Mode**:
By default, `test.py` uses git to detect changed files and only runs tests for affected components. Use `--full` for complete validation before merging.

**Repo checks** (`--repo`): ruff over `scripts/` and `.github/scripts/`, plus
the pytest suite for the release automation in `.github/scripts/tests` (R2
manifest generation, pre-release handling and the release CI gate).

**Lint policy for this directory**:
`scripts/ruff.toml` mirrors the zero-ignore policy the server and hub backends
declare (`select = ["E", "F", "I", "N", "RUF100", "W"]`, `ignore = []`,
`line-length = 100`), so the tooling that enforces that policy is held to it
too. The baseline is clean and enforced unconditionally by `--repo`: any
finding fails the build, in CI and locally.

```bash
./scripts/test.py --repo                       # via the suite
server/.venv/bin/ruff check scripts/ .github/scripts/        # directly
server/.venv/bin/ruff check scripts/ .github/scripts/ --fix   # auto-fix
```

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
**Purpose**: Build the standalone Tauri desktop app for the machine it runs on

**Usage**:
```bash
./scripts/build.py                      # Full build (bundled server)
./scripts/build.py --client             # Client build (no bundled server)
./scripts/build.py --server-only        # Build server only
./scripts/build.py --studio-only        # Build studio only (assumes server already built)
./scripts/build.py --windows-sign       # Sign the Windows exes and installer (see sign-windows.ps1)
./scripts/build.py --clean              # Clean artifacts before building
```
- Steps: build the server (PyInstaller), stage it as the Tauri sidecar, run `tauri build`
- Final packages: `studio/tauri/target/<target-triple>/release/bundle/` (AppImage, deb, rpm, NSIS installer, DMG)
- PyInstaller and Tauri build for the host, so run it on each OS and CPU you want an installer for

**Examples**:
```bash
# Full build
./scripts/build.py

# Quick server iteration
./scripts/build.py --server-only

# Rebuild studio after server change
./scripts/build.py --studio-only

# Clean build
./scripts/build.py --clean
```

### `smoke_desktop.py`
**Purpose**: Launch a built desktop app and check that it starts and shuts down cleanly

**Usage**:
```bash
xvfb-run -a python3 scripts/smoke_desktop.py --app studio/tauri/target/x86_64-unknown-linux-gnu/release/sigilweaver-loom-studio
python3 scripts/smoke_desktop.py --app <binary> --client     # Client build
python3 scripts/smoke_desktop.py --app <binary> --check basic --check kill --check second-instance --check slow-shutdown
```
- `basic`: waits for the server health check, checks port 25811 is listening, stops the app and checks the port is released
- `kill`: force-quits the app; the next launch must stop the leftover server (Windows: the job object must take it down)
- `second-instance`: a second launch must leave the first instance's server alone
- `slow-shutdown` (Linux, Full): quits the app with a request held open on the server; nothing may keep the port
- Needs a display; on headless Linux use `xvfb-run -a`

---

## Other Helper Scripts

### `r2.py`
Manage R2 bucket: list contents and download files via CDN.

**Usage**:
```bash
# List bucket contents
./scripts/r2.py list [path]          # List specific path
./scripts/r2.py list                 # List root
./scripts/r2.py list releases/loom/  # List releases
./scripts/r2.py list -r              # Recursive list all files

# Download files via CDN
./scripts/r2.py download [path]      # Download specific path
./scripts/r2.py download             # Download everything
./scripts/r2.py download releases/loom/  # Download releases only
./scripts/r2.py download --dry-run   # Show what would be downloaded
```

**Downloads to**: `.untracked/r2/sigilweaver-loom-downloads/`

**Features**:
- Uses CDN URL for downloads
- Uses S3 API for listing only
- Skips files that already exist locally with same size
- Shows download progress

**Requires**: `.env` file with R2 credentials, `boto3` Python package.

### `generate_synthetic_yxdb.py`
Generates synthetic YXDB test data (needs `sigilyx` from PyPI) for integration
testing. Run from the repo root:

```bash
python scripts/generate_synthetic_yxdb.py
```

Writes to `.untracked/data/ro/sigilweaver-synthetic-yxdb/`.

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
