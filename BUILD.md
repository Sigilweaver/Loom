# Building Sigilweaver Standalone Application

This guide explains how to build a complete standalone Sigilweaver application with the backend bundled.

## Overview

Sigilweaver uses PyInstaller to bundle the Python backend into a standalone executable, which is then packaged with the Electron frontend. The result is a single-file application with **zero external dependencies** - no Python installation required!

## Prerequisites

### Backend
- Python 3.11+
- Virtual environment set up in `sigilweaver-backend/.venv`

### Frontend
- Node.js 18+
- npm dependencies installed

## Quick Start

### One-Command Build

```bash
# From repo root
./build-all.sh linux    # For Linux
./build-all.sh win      # For Windows (if cross-compiling)
./build-all.sh mac      # For macOS (if on Mac)
```

This will:
1. Build the backend executable with PyInstaller
2. Build the frontend with Vite
3. Package everything with electron-builder
4. Output to `sigilweaver-frontend/dist/`

## Manual Build Steps

### 1. Build Backend Executable

```bash
cd sigilweaver-backend

# First time setup
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e ".[build]"

# Build executable
./build_executable.sh
```

This creates: `sigilweaver-backend/dist/sigilweaver-backend[.exe]`

### 2. Build Frontend + Package

```bash
cd sigilweaver-frontend

# Install dependencies (first time)
npm install

# Build for your platform
npm run build:linux    # Linux AppImage/Snap
npm run build:win      # Windows NSIS/Portable
npm run build:mac      # macOS DMG/Zip
```

## Output

### Linux
- `sigilweaver-frontend/dist/Sigilweaver-<version>.AppImage`
- `sigilweaver-frontend/dist/sigilweaver_<version>_amd64.snap`

### Windows
- `sigilweaver-frontend/dist/Sigilweaver Setup <version>.exe` (installer)
- `sigilweaver-frontend/dist/Sigilweaver <version>.exe` (portable)

### macOS
- `sigilweaver-frontend/dist/Sigilweaver-<version>.dmg`
- `sigilweaver-frontend/dist/Sigilweaver-<version>-mac.zip`

## How It Works

### Backend Bundling
PyInstaller analyzes `app/main.py` and bundles:
- All Python code
- Python interpreter
- FastAPI, Uvicorn, Polars dependencies
- Native libraries (if any)

Result: Single executable ~50-100MB

### Frontend Integration
Electron main process:
1. Checks if in development mode
   - **Dev**: Spawns `python -m uvicorn` from source
   - **Prod**: Launches bundled executable from `resources/backend/`
2. Waits for backend health check (`/api/health/`)
3. Opens main window

### User Experience
- Double-click to launch
- Backend starts automatically in background
- Frontend connects to `localhost:8000`
- Backend stops when app closes
- **No Python installation needed!**

## Development Workflow

### During Development
```bash
# Terminal 1: Backend (with hot reload)
cd sigilweaver-backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload

# Terminal 2: Frontend (with hot reload)
cd sigilweaver-frontend
npm run dev
```

The dev script automatically detects development mode and uses the Python source.

### Testing Production Build Locally

```bash
# Build everything
./build-all.sh linux

# Run the packaged app
./sigilweaver-frontend/dist/linux-unpacked/sigilweaver
```

## Troubleshooting

### Backend fails to start
- Check logs in Electron console (View → Toggle Developer Tools)
- Look for `[Backend]` messages
- Verify backend executable exists: `sigilweaver-backend/dist/sigilweaver-backend`

### "Backend not found" error
- Ensure backend was built: `./sigilweaver-backend/build_executable.sh`
- Check `extraResources` in `package.json` points to correct path

### Large file size
- Normal! PyInstaller bundles entire Python runtime
- Typical size: 50-100MB
- Use UPX compression (enabled in spec file)

### Platform-specific builds
- **Linux**: Can only build Linux packages on Linux
- **Windows**: Can build on Windows, or use wine/docker on Linux
- **macOS**: Must build on macOS

## Next Steps

- [ ] Test on clean system (no Python installed)
- [ ] Set up CI/CD for automated builds
- [ ] Add code signing for Windows/macOS
- [ ] Create installer with custom branding
