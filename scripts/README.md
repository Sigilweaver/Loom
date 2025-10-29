# Development Scripts

Utility scripts for building and running Sigilweaver.

## Available Scripts

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

### `build-all.sh`
**Purpose**: Build complete standalone application for distribution

**Usage**:
```bash
./scripts/build-all.sh [platform]
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
./scripts/build-all.sh

# Build for Linux specifically
./scripts/build-all.sh linux

# Build for Windows (cross-compile)
./scripts/build-all.sh win

# Build for macOS (on Mac only)
./scripts/build-all.sh mac
```

---

## Other Helper Scripts

### `../test-standalone.sh`
Tests the built standalone package without rebuilding.

**Usage**:
```bash
./test-standalone.sh
```

Requires: Run `./scripts/build-all.sh` first.

---

## Quick Start

**Development**:
```bash
./scripts/dev.sh
```

**Production Build**:
```bash
./scripts/build-all.sh
```

**Test Build**:
```bash
./test-standalone.sh
```
