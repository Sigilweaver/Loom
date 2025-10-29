# Development Scripts

Utility scripts for building, testing, and running Sigilweaver.

## Quick Reference

```bash
# Development
./scripts/dev.sh                    # Start dev servers

# Testing
./scripts/test.sh                   # Run all tests (backend + frontend)
./scripts/test_backend.sh           # Backend tests only
./scripts/test_frontend.sh          # Frontend tests only
./scripts/test_integration.sh       # Integration tests (requires backend)

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

### `test.sh`
**Purpose**: Run all tests (backend + frontend unit tests)

**Usage**:
```bash
./scripts/test.sh
```

**What it does**:
1. Runs backend tests with pytest + coverage
2. Runs frontend unit tests with vitest
3. Reports summary of both test suites

**Exit code**: 0 if all pass, 1 if any fail

---

### `test_backend.sh`
**Purpose**: Run backend tests only

**Usage**:
```bash
./scripts/test_backend.sh
```

**What it does**:
- Runs pytest with coverage
- Generates HTML coverage report at `backend/htmlcov/index.html`
- Tests API routes, domain logic, tool implementations

**Requirements**: Backend venv with dev dependencies installed

---

### `test_frontend.sh`
**Purpose**: Run frontend unit tests only

**Usage**:
```bash
./scripts/test_frontend.sh
```

**What it does**:
- Runs vitest unit tests (domain logic + components)
- Tests stores, state management, utilities
- Fast - no backend required

**Requirements**: `npm install` completed

---

### `test_integration.sh`
**Purpose**: Run integration tests that require backend API

**Usage**:
```bash
./scripts/test_integration.sh
```

**What it does**:
- Checks if backend is running, starts it if not
- Runs frontend integration tests against live API
- Auto-starts/stops backend as needed
- Tests end-to-end workflows

**Requirements**: Backend venv installed

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
./scripts/test.sh

# 3. Test integration if touching API
./scripts/test_integration.sh
```

### Pre-Commit Validation
```bash
# Run all tests before committing
./scripts/test.sh && ./scripts/test_integration.sh
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
