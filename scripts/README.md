# Development Scripts

Utility scripts for building, testing, and running Sigilweaver.

## Quick Reference

```bash
# Development
./scripts/dev.py                    # Start dev servers (cross-platform)
./scripts/dev.py --backend          # Backend only
./scripts/dev.py --frontend         # Frontend only
./scripts/dev.py --electron         # Start all including Electron

# Testing
./scripts/test.py                   # Run all tests (backend + frontend + integration)
./scripts/test.py --backend         # Backend tests only
./scripts/test.py --frontend        # Frontend tests only
./scripts/test.py --integration     # Integration tests (requires backend)
./scripts/test.py --no-integration  # Skip integration tests
./scripts/test.py --coverage        # Include coverage reports

# Building
./scripts/build.py                  # Build for current platform (cross-platform)
./scripts/build.py --platform linux # Build for Linux
./scripts/build.py --platform win   # Build for Windows
./scripts/build.py --platform mac   # Build for macOS
./scripts/build.py --backend-only   # Build backend only
./scripts/build.py --frontend-only  # Build frontend only
./scripts/build.py --clean          # Clean before building
```

---

## Development Scripts

### `dev.py`
**Purpose**: Start backend and/or frontend in development mode (cross-platform)

**Usage**:
```bash
./scripts/dev.py                    # Start backend + frontend
./scripts/dev.py --backend          # Backend only
./scripts/dev.py --frontend         # Frontend only
./scripts/dev.py --electron         # Start all including Electron
```

**Flags**:
| Flag | Description |
|------|-------------|
| `--backend` | Start backend only |
| `--frontend` | Start frontend only |
| `--electron` | Also launch Electron (implies frontend) |

**What it does**:
- Starts Python backend with uvicorn (hot reload enabled)
- Starts Vite dev server for frontend
- Optionally launches Electron app
- Runs services in parallel with prefixed output
- Logs are prefixed with [BACKEND], [FRONTEND], and [ELECTRON]
- Cross-platform: works on Linux, macOS, and Windows

**Ports**:
- Backend: http://localhost:8000
- Backend API Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173

Press `Ctrl+C` to stop all services.

### `dev.sh` (deprecated)
**Note**: Use `dev.py` instead for cross-platform compatibility. This bash script is kept for backwards compatibility but may be removed in a future release.

---

## Testing Scripts

### `test-full.py`
**Purpose**: Unified test runner for all test suites

**Usage**:
```bash
# Run all tests
./scripts/test-full.py

# Run specific test suites
./scripts/test-full.py --backend      # Backend tests only
./scripts/test-full.py --frontend     # Frontend tests only
./scripts/test-full.py --integration  # Integration tests only

# Common combinations
./scripts/test-full.py --no-integration  # Backend + frontend (fast)
./scripts/test-full.py --backend --coverage  # Backend with coverage report

# Multiple flags
./scripts/test-full.py --backend --frontend  # Backend + frontend only
```

**Flags**:
| Flag | Description |
|------|-------------|
| `--backend` | Run backend tests (pytest) |
| `--frontend` | Run frontend tests (vitest) |
| `--integration` | Run integration tests (requires backend) |
| `--no-integration` | Skip integration tests |
| `--coverage` | Generate HTML coverage report for backend |

**What it does**:
- Runs pytest for backend tests
- Runs vitest for frontend unit tests
- Runs integration tests against live backend API
- Auto-starts backend for integration tests if not running
- Reports summary with pass/fail status and duration
- Generates coverage report at `backend/htmlcov/index.html` (with `--coverage`)

**Exit code**: 0 if all pass, 1 if any fail

---

## Build Scripts

### `build.py`
**Purpose**: Build complete standalone application for distribution (cross-platform)

**Usage**:
```bash
./scripts/build.py                      # Build for current platform
./scripts/build.py --platform linux     # Build for Linux
./scripts/build.py --platform win       # Build for Windows
./scripts/build.py --platform mac       # Build for macOS
./scripts/build.py --backend-only       # Build backend only
./scripts/build.py --frontend-only      # Build frontend only (assumes backend exists)
./scripts/build.py --clean              # Clean artifacts before building
```

**Flags**:
| Flag | Description |
|------|-------------|
| `--platform` | Target platform: `linux`, `win`, or `mac` (auto-detects if omitted) |
| `--backend-only` | Build backend executable only |
| `--frontend-only` | Build frontend only (assumes backend already built) |
| `--clean` | Clean build artifacts before building |

**What it does**:
1. Builds backend executable with PyInstaller
2. Copies backend to frontend resources
3. Builds frontend web assets
4. Packages everything with Electron Builder
5. Creates distribution-ready installers

**Output locations**:
- Backend executable: `backend/dist/backend`
- Frontend resources: `frontend/resources/backend/backend`
- Final packages: `frontend/dist/` (AppImage, DMG, exe, etc.)

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

# Quick backend iteration
./scripts/build.py --backend-only

# Rebuild frontend after backend change
./scripts/build.py --frontend-only

# Clean build
./scripts/build.py --clean
```

---

## Other Helper Scripts

### `b2.py`
Manage B2 bucket: list contents and download files via CDN.

**Usage**:
```bash
# List bucket contents
./scripts/b2.py list [path]          # List specific path
./scripts/b2.py list                 # List root
./scripts/b2.py list latest/         # List /latest/
./scripts/b2.py list -r              # Recursive list all files

# Download files via CDN
./scripts/b2.py download [path]      # Download specific path
./scripts/b2.py download             # Download everything
./scripts/b2.py download latest/     # Download /latest/ only
./scripts/b2.py download --dry-run   # Show what would be downloaded
```

**Downloads to**: `.untracked/b2/sigilweaver-downloads/`

**Features**:
- Uses CDN URL for downloads (no B2 egress fees)
- Uses S3 API for listing only
- Skips files that already exist locally with same size
- Shows download progress

**Requires**: `.env` file with B2 credentials, `boto3` Python package.

---

## Typical Workflows

### Development Cycle
```bash
# 1. Start dev servers
./scripts/dev.sh

# 2. Make changes, then test
./scripts/test-full.py --no-integration

# 3. Test integration if touching API
./scripts/test-full.py --integration
```

### Pre-Commit Validation
```bash
# Run all tests before committing
./scripts/test-full.py
```

### Production Build
```bash
# Full build for release
./scripts/build.py

# Clean build
./scripts/build.py --clean

### Fast Backend Testing
```bash
# Only rebuild backend
./scripts/build.py --backend-only

# Test it quickly
cd backend && source .venv/bin/activate && ./dist/backend
```
