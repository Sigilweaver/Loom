---
sidebar_position: 2
---

# Packaging

Building distributable releases of Sigilweaver Loom.

## Overview

Sigilweaver Loom is distributed as a standalone desktop application. The build process:

1. **Server**: PyInstaller bundles Python code + interpreter into a single executable
2. **Studio**: Vite builds the React app, Electron packages everything

The result is a single application with **zero external dependencies**. Users don't need Python or Node.js installed.

## Quick Build

```bash
# From repo root
./scripts/build.py
```

This builds for your current platform. Output goes to `studio/dist/`.

### Platform-Specific

```bash
# Linux
cd studio && bun run build:linux

# Windows
cd studio && bun run build:win

# macOS
cd studio && bun run build:mac
```

**Note**: You can only build for your current platform. Cross-compilation is limited.

## Build Process Details

### Step 1: Server Executable

```bash
cd server
uv sync --all-extras  # Includes PyInstaller
../scripts/build_server.sh
```

PyInstaller analyzes `app/main.py` and bundles:
- All Python code in `app/`
- Python interpreter
- All dependencies (FastAPI, Uvicorn, Polars)
- Native libraries

Result: `server/dist/server` (~50-100MB)

### Step 2: Studio + Electron

```bash
cd studio
bun run build
bun run dist:linux  # or dist:win, dist:mac
```

This:
1. Vite builds the React app to `studio/dist/`
2. electron-builder packages everything
3. Includes the Server executable from `server/dist/`

## Output Artifacts

### Linux

| File | Description |
|------|-------------|
| `Sigilweaver Loom-<version>.AppImage` | Single-file, runs anywhere |
| `sigilweaver-loom_<version>_amd64.snap` | Snap package |

### Windows

| File | Description |
|------|-------------|
| `Sigilweaver Loom Setup <version>.exe` | NSIS installer |
| `Sigilweaver Loom <version>.exe` | Portable (no install) |

### macOS

| File | Description |
|------|-------------|
| `Sigilweaver Loom-<version>.dmg` | Standard Mac installer |
| `Sigilweaver Loom-<version>-mac.zip` | Zipped app bundle |

## Build Configurations

### Full vs Client

Two build variants exist:

- **Full**: Includes embedded Server (standalone)
- **Client**: Studio only (requires external Server)

```bash
# Full version (default)
bun run build:linux

# Client version
bun run build:linux:client
```

Client builds are smaller (~100MB vs ~200MB) but require a separate backend installation.

### electron-builder Config

Configuration lives in `package.json` and `electron-builder*.json`:

```json
{
  "build": {
    "appId": "app.sigilweaver.loom",
    "productName": "Sigilweaver Loom",
    "directories": {
      "output": "dist"
    },
    "extraResources": [
      {
        "from": "../server/dist",
        "to": "server"
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

### Tauri Shell (Sidecar Server)

The Tauri shell is packaged in parallel with Electron and reuses the same
PyInstaller server. Where Electron ships the server via `extraResources`, Tauri
ships it as a **sidecar** declared under `externalBin`, resolved by
target-triple suffix.

```bash
# Full Tauri build (bundled server sidecar)
./scripts/build.py --tauri

# Client Tauri build (no bundled server)
./scripts/build.py --tauri --client
```

`--tauri` runs three steps: build the server, stage it as a sidecar, then build
the Tauri app.

- **Staging**: `scripts/build.py` copies `server/dist/server[.exe]` to
  `studio/tauri/binaries/server-<target-triple>[.exe]` (for example,
  `server-x86_64-unknown-linux-gnu`). This rename is the key difference from
  Electron's `extraResources` copy, and is the most common source of
  "works on my platform" breakage if the triple is wrong.
- **Full vs Client**: the Full build compiles with the `bundled-server` Cargo
  feature and merges `studio/tauri/tauri.conf.full.json` (which sets
  `externalBin`); the Client build uses the base config, which declares no
  sidecar. The Rust dispatch keys off the `bundled-server` feature, so
  client-vs-full is a compile-time decision, matching how Tauri embeds its
  config.
- **Runtime**: on launch, a Full build spawns the sidecar, injects the
  `SESSION_TOKEN` and writable `*_PATH` environment, polls `/api/health/` until
  ready, and terminates the process on exit (including abnormal exit). Dev and
  Client builds never spawn.

Underlying npm scripts: `build:tauri:<platform>:full` and
`build:tauri:<platform>:client`.

### PyInstaller Spec

Server bundling is configured in `server/sigilweaver.spec`:

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

1. User launches Sigilweaver Loom
2. Electron main process starts
3. Spawns Server executable from `resources/server/`
4. Waits for Server health check (`/api/health/`)
5. Opens main window pointing to bundled Studio
6. On quit, terminates Server process

The Tauri Full build follows the same lifecycle, spawning the server as a
sidecar rather than from `resources/server/` and reaping it on the app's
`ExitRequested`/`Exit` events.

### Development Mode

1. Developer runs `./scripts/dev.py`
2. Server runs from Python source with hot reload
3. Studio runs from Vite dev server with hot reload
4. Electron (optional) connects to dev server

The app detects development mode and adjusts behavior automatically.

## File Size

Typical sizes:

| Component | Size |
|-----------|------|
| Server executable | 50-100 MB |
| Studio bundle | 5-10 MB |
| Electron runtime | 80-100 MB |
| **Total (full)** | **~200 MB** |
| **Total (client)** | **~100 MB** |

The Server is large because it includes the entire Python runtime and Polars (which is written in Rust and fairly hefty).

## Testing Builds

After building, test on a clean system:

```bash
# Linux
./studio/dist/Sigilweaver-Loom-*.AppImage

# Or unpack and run
./studio/dist/linux-unpacked/sigilweaver-loom
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
# Build server first
cd server && ./build_executable.sh

# Then build studio
cd studio && bun run build:linux
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
