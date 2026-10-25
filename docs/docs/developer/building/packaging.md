---
sidebar_position: 2
---

# Packaging

Building distributable releases of Sigilweaver Loom.

## Overview

Sigilweaver Loom is distributed as a standalone desktop application built with [Tauri](https://tauri.app). The build process:

1. **Server**: PyInstaller bundles Python code + interpreter into a single executable
2. **Studio**: Vite builds the React app, Tauri wraps it in a Rust shell that uses the operating system's webview and packages everything

The result is a single application with **zero external dependencies**. Users don't need Python or Node.js installed.

## Quick Build

```bash
# From repo root
./scripts/build.py            # Full: bundled Server
./scripts/build.py --client   # Client: Studio only
```

This builds for your current platform and CPU. `scripts/build.py` runs the three steps below in order. Installers are written to `studio/tauri/target/<target-triple>/release/bundle/`.

**Note**: PyInstaller and Tauri build for the machine they run on. Build on each OS and architecture you want to ship; CI does this (see [Releasing](./releasing)).

### Prerequisites

- Rust (stable) and the [Tauri system dependencies](https://tauri.app/start/prerequisites/)
- On Linux: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `libssl-dev`, `libdbus-1-dev`, `patchelf` and `pkg-config`
- bun and uv, as for development

## Build Process Details

### Step 1: Server Executable

```bash
cd server
uv sync --all-extras  # Includes PyInstaller
uv run pyinstaller sigilweaver.spec
```

PyInstaller analyzes `app/main.py` and bundles:
- All Python code in `app/`
- Python interpreter
- All dependencies (FastAPI, Uvicorn, Polars)
- Native libraries

Result: `server/dist/server` (about 200 MB)

### Step 2: Stage the sidecar

Tauri ships the server as a **sidecar**, declared under `externalBin` in `studio/tauri/tauri.conf.full.json` and resolved by target-triple suffix. `scripts/build.py` copies `server/dist/server[.exe]` to `studio/tauri/binaries/loom-server-<target-triple>[.exe]` (for example `loom-server-x86_64-unknown-linux-gnu`). If the triple is wrong, Tauri cannot find the sidecar. The bundler strips the triple again and installs the file next to the app as `loom-server`, so it does not collide with other programs in `/usr/bin`.

### Step 3: Studio + Tauri

```bash
cd studio
bun run build:tauri:full --target x86_64-unknown-linux-gnu
```

This:
1. Runs `bun run build:web` (Vite builds the React app to `studio/dist/`)
2. Compiles the Rust shell in release mode
3. Bundles the installers for the current OS

## Output Artifacts

File names below are the Tauri output names. The release workflow renames them (see [Releasing](./releasing)).

### Linux

| File | Description |
|------|-------------|
| `Sigilweaver Loom_<version>_amd64.AppImage` | Single-file, runs anywhere with a recent glibc |
| `Sigilweaver Loom_<version>_amd64.deb` | Debian and Ubuntu package |
| `Sigilweaver Loom-<version>-1.x86_64.rpm` | Fedora and openSUSE package |

### Windows

| File | Description |
|------|-------------|
| `Sigilweaver Loom_<version>_x64-setup.exe` | NSIS installer (per-user, no admin prompt) |

### macOS

| File | Description |
|------|-------------|
| `Sigilweaver Loom_<version>_aarch64.dmg` | Apple silicon |
| `Sigilweaver Loom_<version>_x64.dmg` | Intel |

macOS ships as two separate disk images, one per architecture, rather than one universal binary. The bundled Server is a PyInstaller executable and PyInstaller cannot produce a universal binary, so a universal app would still need a separate Server per architecture. Two native builds keep each download smaller and each Server native.

## Build Configurations

### Full vs Client

Two build variants exist:

- **Full**: Includes embedded Server (standalone)
- **Client**: Studio only (requires external Server)

The Full build compiles with the `bundled-server` Cargo feature and merges `studio/tauri/tauri.conf.full.json` (which sets `externalBin`). The Client build uses the base config, which declares no sidecar. The shell refuses to start if the feature and the config disagree, so a mismatched build fails loudly instead of shipping without a server.

```bash
cd studio
bun run build:tauri:full   # Full
bun run build:tauri        # Client
```

Client builds are smaller but require a separate backend installation.

### Tauri configuration

`studio/tauri/tauri.conf.json` holds the app identifier (`com.sigilweaver.loom-studio`), window settings, the content security policy, the icons and the bundle targets (`deb`, `rpm`, `appimage`, `nsis`, `dmg`). `studio/tauri/capabilities/main.json` lists what the renderer may call. The renderer gets no file, shell or store permissions; those run in Rust behind the app's own commands.

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
2. The Tauri shell starts and creates the main window hidden
3. A Full build spawns the `loom-server` sidecar with a launch-scoped session token and writable data paths under the app data directory
4. The shell waits for the Server health check (`/api/health/`)
5. The window is shown, loading the bundled Studio
6. On quit (window close, `SIGTERM`, `SIGINT`, `SIGHUP` or Ctrl+C), the shell stops the Server process tree

If the Server does not become healthy, or the sidecar is missing from the install, the shell shows an error dialog and exits. Dev and Client builds never spawn a Server.

A force-kill of the shell (`SIGKILL`, a crash) cannot run the exit handlers and leaves the Server running. The next launch then reports that port 25811 is in use. Stop the leftover `loom-server` process and start the app again.

### Development Mode

1. Developer runs `./scripts/dev.py`
2. Server runs from Python source with hot reload
3. Studio runs from Vite dev server with hot reload
4. Tauri (optional, `--studio-tauri`) connects to the dev server

The app detects development mode and adjusts behavior automatically.

## File Size

Typical sizes:

| Package | Client | Full |
|---------|--------|------|
| deb, rpm | about 6 MB | about 205 MB |
| AppImage | about 105 MB | about 305 MB |

The Server executable (about 200 MB) accounts for nearly all of the difference. It is large because it includes the entire Python runtime and Polars (which is written in Rust and fairly hefty). The Tauri shell itself is a few megabytes because it uses the operating system's webview (WebKitGTK, WebView2, WKWebView). The AppImage bundles WebKitGTK so it runs on any distro, which is why it is larger than the deb and rpm.

## Testing Builds

`scripts/smoke_desktop.py` launches a built app and checks that it starts and shuts down cleanly. CI runs it on every platform.

```bash
# Linux, headless
xvfb-run -a python3 scripts/smoke_desktop.py \
  --app studio/tauri/target/x86_64-unknown-linux-gnu/release/sigilweaver-loom-studio

# Client build
python3 scripts/smoke_desktop.py --app <binary> --client
```

For a Full build it waits for the Server health check, confirms the Server is listening on port 25811, stops the app and confirms the port is released.

Then test an installer by hand on a clean system:
- [ ] App launches without errors
- [ ] Backend starts
- [ ] Can load a CSV file
- [ ] Can execute a workflow
- [ ] Output files are written correctly

## Troubleshooting

### Sidecar not found

`tauri build` fails if `studio/tauri/binaries/loom-server-<target-triple>` is missing. Build and stage the Server first:

```bash
./scripts/build.py              # all three steps
./scripts/build.py --studio-only   # Server already built in server/dist
```

### Port 25811 is already in use

Another Loom instance or a leftover Server holds the port. Close the other instance, or stop the stray `loom-server` process.

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

- **Linux**: Builds AppImage, deb and rpm on any distro with the Tauri dependencies installed
- **Windows**: The NSIS installer builds on Windows (or with Wine)
- **macOS**: Must build on macOS, once per architecture

## Code Signing

### Windows

Release installers are signed with Azure Trusted Signing, which reduces SmartScreen warnings. The release workflow signs the NSIS installer after the build (`.github/workflows/build-studio-tauri.yml`). The signing secrets live in the `windows-signing` environment.

### macOS

macOS builds are not signed or notarized. Gatekeeper blocks them until the user opens them from the context menu. Notarization needs an Apple Developer ID and is configured under `bundle.macOS` in `tauri.conf.json`.

---

Next: [Releasing](./releasing) for CI/CD and distribution.
