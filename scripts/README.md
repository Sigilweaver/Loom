# Development Scripts

Utility scripts for building, testing, and running Sigilweaver.

## Quick Reference

```bash
# Development
./scripts/dev.sh                    # Start dev servers

# Testing
./scripts/test-full.py              # Run all tests (backend + frontend + integration)
./scripts/test-full.py --backend    # Backend tests only
./scripts/test-full.py --frontend   # Frontend tests only
./scripts/test-full.py --integration # Integration tests (requires backend)
./scripts/test-full.py --no-integration # Skip integration tests
./scripts/test-full.py --coverage   # Include coverage reports

# Building
./scripts/build.sh [platform]       # Build complete application
./scripts/build_backend.sh          # Build backend executable only
./test-standalone.sh                # Test built package
```

---

## Development Scripts

### `dev.sh`
**Purpose**: Start both backend and frontend in development mode

**Usage**:
```bash
./scripts/dev.sh
```

**What it does**:
- Starts Python backend with uvicorn (hot reload enabled)
- Starts Vite dev server for frontend
- Runs both services in parallel
- Logs are prefixed with [BACKEND] and [FRONTEND]

**Ports**:
- Backend: http://localhost:8000
- Backend API Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173

Press `Ctrl+C` to stop all services.

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

### `build.sh`
**Purpose**: Build complete standalone application for distribution

**Usage**:
```bash
./scripts/build.sh [platform]
```

**Parameters**:
- `platform` (optional): `linux`, `win`, or `mac`
  - If omitted, builds for current platform

**What it does**:
1. Builds backend executable with PyInstaller
2. Builds frontend web assets
3. Packages everything with Electron Builder
4. Creates distribution-ready installers

**Output locations**:
- Backend executable: `backend/dist/sigilweaver-backend`
- Frontend build: `frontend/dist/`
- Final packages: `frontend/dist/` (AppImage, DMG, exe, etc.)

**Examples**:
```bash
# Build for current platform
./scripts/build.sh

# Build for Linux specifically
./scripts/build.sh linux

# Build for Windows (cross-compile)
./scripts/build.sh win

# Build for macOS (on Mac only)
./scripts/build.sh mac
```

---

### `build_backend.sh`
**Purpose**: Build backend executable only (faster iteration)

**Usage**:
```bash
./scripts/build_backend.sh
```

**What it does**:
- Runs PyInstaller with `sigilweaver.spec`
- Creates standalone `sigilweaver-backend` executable
- Useful for testing backend changes without full Electron rebuild

**Output**: `backend/dist/sigilweaver-backend`

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

### `../test-standalone.sh`
Tests the built standalone package without rebuilding.

**Usage**:
```bash
./test-standalone.sh
```

**Requires**: Run `./scripts/build.sh` first.

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
./scripts/build.sh

# Test the build
./test-standalone.sh
```

### Fast Backend Testing
```bash
# Only rebuild backend
./scripts/build_backend.sh

# Test it quickly
cd backend && source .venv/bin/activate && ./dist/sigilweaver-backend
```
