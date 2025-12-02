---
sidebar_position: 2
---

# Packaging

Building distributable releases of Sigilweaver.

## Overview

Sigilweaver is distributed as a standalone desktop application. The build process:

1. **Backend**: PyInstaller bundles Python code + interpreter into a single executable
2. **Frontend**: Vite builds the React app, Electron packages everything

The result is a single application with **zero external dependencies**. Users don't need Python or Node.js installed.

## Quick Build

```bash
# From repo root
./scripts/build.sh
```

This builds for your current platform. Output goes to `frontend/dist/`.

### Platform-Specific

```bash
# Linux
cd frontend && npm run build:linux

# Windows
cd frontend && npm run build:win

# macOS
cd frontend && npm run build:mac
```

**Note**: You can only build for your current platform. Cross-compilation is limited.

## Build Process Details

### Step 1: Backend Executable

```bash
cd backend
source .venv/bin/activate
pip install -e ".[build]"  # Includes PyInstaller
../scripts/build_backend.sh
```

PyInstaller analyzes `app/main.py` and bundles:
- All Python code in `app/`
- Python interpreter
- All dependencies (FastAPI, Uvicorn, Polars)
- Native libraries

Result: `backend/dist/backend` (~50-100MB)

### Step 2: Frontend + Electron

```bash
cd frontend
npm run build
npm run dist:linux  # or dist:win, dist:mac
```

This:
1. Vite builds the React app to `frontend/dist/`
2. electron-builder packages everything
3. Includes the backend executable from `backend/dist/`

## Output Artifacts

### Linux

| File | Description |
|------|-------------|
| `Sigilweaver-<version>.AppImage` | Single-file, runs anywhere |
| `sigilweaver_<version>_amd64.snap` | Snap package |

### Windows

| File | Description |
|------|-------------|
| `Sigilweaver Setup <version>.exe` | NSIS installer |
| `Sigilweaver <version>.exe` | Portable (no install) |

### macOS

| File | Description |
|------|-------------|
| `Sigilweaver-<version>.dmg` | Standard Mac installer |
| `Sigilweaver-<version>-mac.zip` | Zipped app bundle |

## Build Configurations

### Full vs Client

Two build variants exist:

- **Full**: Includes embedded backend (standalone)
- **Client**: Frontend only (requires external backend)

```bash
# Full version (default)
npm run build:linux

# Client version
npm run build:linux:client
```

Client builds are smaller (~100MB vs ~200MB) but require a separate backend installation.

### electron-builder Config

Configuration lives in `package.json` and `electron-builder*.json`:

```json
{
  "build": {
    "appId": "app.sigilweaver",
    "productName": "Sigilweaver",
    "directories": {
      "output": "dist"
    },
    "extraResources": [
      {
        "from": "../backend/dist",
        "to": "backend"
      }
    ],
    "linux": {
      "target": ["AppImage", "snap"],
      "category": "Development"
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.developer-tools"
    }
  }
}
```

### PyInstaller Spec

Backend bundling is configured in `backend/sigilweaver.spec`:

```python
a = Analysis(
    ['app/main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['uvicorn.logging', 'uvicorn.loops', ...],
    hookspath=[],
    ...
)
```

Hidden imports are manually specified because PyInstaller can't detect dynamic imports.

## How It Works at Runtime

### Production Mode

1. User launches Sigilweaver
2. Electron main process starts
3. Spawns backend executable from `resources/backend/`
4. Waits for backend health check (`/api/health/`)
5. Opens main window pointing to bundled frontend
6. On quit, terminates backend process

### Development Mode

1. Developer runs `./scripts/dev.sh`
2. Backend runs from Python source with hot reload
3. Frontend runs from Vite dev server with hot reload
4. Electron (optional) connects to dev server

The app detects development mode and adjusts behavior automatically.

## File Size

Typical sizes:

| Component | Size |
|-----------|------|
| Backend executable | 50-100 MB |
| Frontend bundle | 5-10 MB |
| Electron runtime | 80-100 MB |
| **Total (full)** | **~200 MB** |
| **Total (client)** | **~100 MB** |

The backend is large because it includes the entire Python runtime and Polars (which is written in Rust and fairly hefty).

## Testing Builds

After building, test on a clean system:

```bash
# Linux
./frontend/dist/Sigilweaver-*.AppImage

# Or unpack and run
./frontend/dist/linux-unpacked/sigilweaver
```

Verify:
- [ ] App launches without errors
- [ ] Backend starts (check Developer Tools console)
- [ ] Can load a CSV file
- [ ] Can execute a workflow
- [ ] Output files are written correctly

## Troubleshooting

### Backend not found

The backend executable must exist at build time:

```bash
# Build backend first
cd backend && ./build_executable.sh

# Then build frontend
cd frontend && npm run build:linux
```

### Large build size

Normal. PyInstaller bundles the entire Python runtime. UPX compression is enabled by default.

### Missing Python modules

Add to `hiddenimports` in `sigilweaver.spec`:

```python
hiddenimports=[
    'uvicorn.logging',
    'your.missing.module',
]
```

### Platform-specific issues

- **Linux**: Builds AppImage and Snap on any Linux distro
- **Windows**: NSIS installer only builds on Windows (or with Wine)
- **macOS**: Must build on macOS; code signing requires Developer ID

## Code Signing

For production releases:

### Windows

Authenticode signing reduces SmartScreen warnings:

```bash
# In electron-builder config
"win": {
  "sign": "./sign.js",
  "certificateFile": "./cert.pfx",
  "certificatePassword": "${env.CERT_PASSWORD}"
}
```

### macOS

Apple notarization is required for Gatekeeper:

```bash
# In electron-builder config
"mac": {
  "hardenedRuntime": true,
  "entitlements": "./entitlements.plist",
  "notarize": {
    "teamId": "${env.APPLE_TEAM_ID}"
  }
}
```

---

Next: [Releasing](./releasing) for CI/CD and distribution.
