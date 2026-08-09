#!/usr/bin/env python3
"""
Cross-platform build script for Sigilweaver Loom.

Builds the complete application:
1. Server executable (PyInstaller)
2. Stage the server for the chosen shell:
   - Electron: copy into studio resources (extraResources)
   - Tauri: stage as a target-triple-named sidecar (externalBin)
3. Studio + desktop shell (Electron by default, or Tauri with --tauri)

Usage:
    ./scripts/build.py                    # Electron Full build, current platform
    ./scripts/build.py --platform linux   # Build for Linux
    ./scripts/build.py --platform win     # Build for Windows
    ./scripts/build.py --platform mac     # Build for macOS
    ./scripts/build.py --server-only      # Build server only
    ./scripts/build.py --studio-only      # Build studio only (assumes server exists)
    ./scripts/build.py --tauri            # Tauri Full build (bundled server sidecar)
    ./scripts/build.py --tauri --client   # Tauri Client build (no bundled server)
    ./scripts/build.py --clean            # Clean build artifacts before building
"""

import argparse
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class BuildResult:
    """Result of a build step."""

    name: str
    success: bool
    duration: float
    error: str | None = None


def get_repo_root() -> Path:
    """Find the repository root directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent


def print_header(title: str) -> None:
    """Print a section header."""
    print()
    print("=" * 50)
    print(title)
    print("=" * 50)


def print_separator() -> None:
    """Print a separator line."""
    print("-" * 50)


def detect_platform() -> str:
    """Detect the current platform."""
    if sys.platform == "win32":
        return "win"
    elif sys.platform == "darwin":
        return "mac"
    else:
        return "linux"


def get_host_platform() -> str:
    """Get the platform we are currently running on (for PyInstaller output)."""
    return detect_platform()


def get_server_extension(platform: str) -> str:
    """Get the server executable extension for a platform."""
    return ".exe" if platform == "win" else ""


# Fallback host target triples per platform, assuming x86_64. Used only when
# `rustc -vV` is unavailable. Tauri resolves sidecars by triple suffix, so these
# must match the triple the Tauri build targets.
DEFAULT_TARGET_TRIPLES = {
    "linux": "x86_64-unknown-linux-gnu",
    "win": "x86_64-pc-windows-msvc",
    "mac": "x86_64-apple-darwin",
}


def get_target_triple(platform: str) -> str:
    """Return the Rust host target triple, for naming Tauri sidecar binaries.

    Tauri's `externalBin` resolves a sidecar by a `-<target-triple>` suffix
    (e.g. `server-x86_64-unknown-linux-gnu`). Prefer the real host triple from
    `rustc -vV` so Apple Silicon and other arches are named correctly; fall back
    to an x86_64 default only if rustc is not on PATH.
    """
    try:
        result = subprocess.run(
            ["rustc", "-vV"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if line.startswith("host:"):
                    return line.split(":", 1)[1].strip()
    except FileNotFoundError:
        pass

    return DEFAULT_TARGET_TRIPLES[platform]


def stage_server_sidecar(repo_root: Path, platform: str) -> BuildResult:
    """Stage the PyInstaller server binary as a Tauri sidecar.

    Tauri's `externalBin` names sidecars `server-<target-triple>[.exe]` under a
    directory relative to `tauri.conf.json`; the base name (`server`) and the
    dir (`binaries/`) match the `externalBin` entry in `tauri.conf.full.json`.
    This differs from Electron's `extraResources`, which just copies the binary
    into `resources/server/`, so the Tauri build needs this extra rename step.
    """
    print_header("Staging Server Sidecar (Tauri)")

    start_time = time.time()
    host = get_host_platform()

    try:
        host_ext = get_server_extension(host)
        target_ext = get_server_extension(platform)
        server_src = repo_root / "server" / "dist" / f"server{host_ext}"
        binaries_dir = repo_root / "studio" / "tauri" / "binaries"

        triple = get_target_triple(platform)
        sidecar_dest = binaries_dir / f"server-{triple}{target_ext}"

        if not server_src.exists():
            return BuildResult(
                name="Stage Sidecar",
                success=False,
                duration=time.time() - start_time,
                error=f"Server executable not found at {server_src}",
            )

        binaries_dir.mkdir(parents=True, exist_ok=True)

        print(f"Staging {server_src} -> {sidecar_dest}")
        shutil.copy2(server_src, sidecar_dest)

        if platform != "win":
            sidecar_dest.chmod(0o755)

        size_mb = sidecar_dest.stat().st_size / (1024 * 1024)
        print(f"Sidecar staged: {sidecar_dest} ({size_mb:.1f} MB)")

        return BuildResult(
            name="Stage Sidecar",
            success=True,
            duration=time.time() - start_time,
        )

    except Exception as e:
        return BuildResult(
            name="Stage Sidecar",
            success=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def clean_build_artifacts(repo_root: Path) -> None:
    """Clean previous build artifacts."""
    print("Cleaning build artifacts...")

    # Server artifacts
    server_dir = repo_root / "server"
    for path in [server_dir / "build", server_dir / "dist"]:
        if path.exists():
            print(f"  Removing {path}")
            shutil.rmtree(path)

    # Studio artifacts
    studio_dir = repo_root / "studio"
    for path in [
        studio_dir / "dist",
        studio_dir / "resources" / "server",
        studio_dir / "tauri" / "binaries",
    ]:
        if path.exists():
            print(f"  Removing {path}")
            shutil.rmtree(path)

    print("Clean complete")


def build_server(repo_root: Path, platform: str) -> BuildResult:
    """Build the server executable with PyInstaller.

    Note: PyInstaller always builds for the host platform. The platform
    argument is the *target* platform for the overall build. If host != target,
    the server binary won't have the target extension (e.g., no .exe on Linux).
    """
    print_header("Step 1/3: Building Server Executable")

    host = get_host_platform()
    if host != platform:
        print(f"  Warning: Host platform is '{host}' but target is '{platform}'.")
        print(f"  PyInstaller will produce a '{host}' binary, not '{platform}'.")
        print(
            "  For cross-platform releases, build the server on each target OS (or use CI)."
        )

    server_dir = repo_root / "server"
    lock_path = server_dir / "uv.lock"
    venv_path = server_dir / ".venv"

    if not lock_path.exists():
        return BuildResult(
            name="Server",
            success=False,
            duration=0,
            error="Server not set up with uv. Run: cd server && uv sync --all-extras",
        )

    # Determine the Python executable path
    if sys.platform == "win32":
        python_path = venv_path / "Scripts" / "python.exe"
    else:
        python_path = venv_path / "bin" / "python"

    start_time = time.time()

    try:
        # Sync dependencies including build extras using uv
        print("Syncing dependencies with uv (including build extras)...")
        result = subprocess.run(
            ["uv", "sync", "--all-extras"],
            cwd=server_dir,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return BuildResult(
                name="Server",
                success=False,
                duration=time.time() - start_time,
                error=f"Failed to sync dependencies: {result.stderr}",
            )

        # Clean previous builds
        print("Cleaning previous server builds...")
        for path in [server_dir / "build", server_dir / "dist"]:
            if path.exists():
                shutil.rmtree(path)

        # Build with PyInstaller
        print("Building executable with PyInstaller...")
        result = subprocess.run(
            [str(python_path), "-m", "PyInstaller", "sigilweaver.spec", "--clean"],
            cwd=server_dir,
            capture_output=False,
        )

        if result.returncode != 0:
            return BuildResult(
                name="Server",
                success=False,
                duration=time.time() - start_time,
                error="PyInstaller build failed",
            )

        # Verify the build - use host platform extension since PyInstaller
        # always builds for the machine it runs on.
        host_ext = get_server_extension(host)
        server_exe = server_dir / "dist" / f"server{host_ext}"

        if not server_exe.exists():
            return BuildResult(
                name="Server",
                success=False,
                duration=time.time() - start_time,
                error=f"Server executable not found at {server_exe}",
            )

        duration = time.time() - start_time
        size_mb = server_exe.stat().st_size / (1024 * 1024)
        print(f"Server built: {server_exe} ({size_mb:.1f} MB)")

        return BuildResult(
            name="Server",
            success=True,
            duration=duration,
        )

    except Exception as e:
        return BuildResult(
            name="Server",
            success=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def copy_server_to_resources(repo_root: Path, platform: str) -> BuildResult:
    """Copy the server executable to studio resources.

    The source binary uses the host platform extension (what PyInstaller built).
    The destination uses the target platform extension (what Electron expects).
    When host != target, this copies the binary but renames it to match
    the target convention - the binary itself is still a host-platform binary,
    which is fine for local dev builds. CI builds on each OS for real releases.
    """
    print_header("Step 2/3: Copying Server to Resources")

    start_time = time.time()
    host = get_host_platform()

    try:
        host_ext = get_server_extension(host)
        target_ext = get_server_extension(platform)
        server_src = repo_root / "server" / "dist" / f"server{host_ext}"
        resources_dir = repo_root / "studio" / "resources" / "server"
        server_dest = resources_dir / f"server{target_ext}"

        if not server_src.exists():
            return BuildResult(
                name="Copy Server",
                success=False,
                duration=time.time() - start_time,
                error=f"Server executable not found at {server_src}",
            )

        # Create resources directory
        resources_dir.mkdir(parents=True, exist_ok=True)

        # Copy the executable
        print(f"Copying {server_src} -> {server_dest}")
        shutil.copy2(server_src, server_dest)

        # Make executable on Unix
        if platform != "win":
            server_dest.chmod(0o755)

        size_mb = server_dest.stat().st_size / (1024 * 1024)
        print(f"Server copied: {server_dest} ({size_mb:.1f} MB)")

        return BuildResult(
            name="Copy Server",
            success=True,
            duration=time.time() - start_time,
        )

    except Exception as e:
        return BuildResult(
            name="Copy Server",
            success=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def build_studio(repo_root: Path, platform: str) -> BuildResult:
    """Build the studio + Electron application."""
    print_header("Step 3/3: Building Studio + Electron")

    studio_dir = repo_root / "studio"
    node_modules = studio_dir / "node_modules"

    if not node_modules.exists():
        return BuildResult(
            name="Studio",
            success=False,
            duration=0,
            error="node_modules not found. Run: cd studio && npm install",
        )

    # Map platform to npm script
    platform_scripts = {
        "linux": "build:linux:full",
        "win": "build:win:full",
        "mac": "build:mac:full",
    }

    if platform not in platform_scripts:
        return BuildResult(
            name="Studio",
            success=False,
            duration=0,
            error=f"Unknown platform: {platform}. Use: linux, win, or mac",
        )

    npm_script = platform_scripts[platform]
    start_time = time.time()

    try:
        print(f"Running npm run {npm_script}...")
        result = subprocess.run(
            ["npm", "run", npm_script],
            cwd=studio_dir,
            capture_output=False,
        )

        duration = time.time() - start_time

        if result.returncode != 0:
            return BuildResult(
                name="Studio",
                success=False,
                duration=duration,
                error="Studio build failed",
            )

        # List output files
        dist_dir = studio_dir / "dist"
        if dist_dir.exists():
            print()
            print("Output files:")
            for item in dist_dir.iterdir():
                if item.is_file():
                    size_mb = item.stat().st_size / (1024 * 1024)
                    print(f"  {item.name} ({size_mb:.1f} MB)")

        return BuildResult(
            name="Studio",
            success=True,
            duration=duration,
        )

    except Exception as e:
        return BuildResult(
            name="Studio",
            success=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def build_studio_tauri(repo_root: Path, platform: str, *, client: bool) -> BuildResult:
    """Build the studio + Tauri application.

    A Full build (`client=False`) bundles the staged server sidecar via the
    `build:tauri:<platform>:full` npm script, which compiles with the
    `bundled-server` feature and `tauri.conf.full.json`. A Client build
    (`client=True`) bundles no server and uses the base config.
    """
    variant = "Client" if client else "Full"
    print_header(f"Building Studio + Tauri ({variant})")

    studio_dir = repo_root / "studio"
    node_modules = studio_dir / "node_modules"

    if not node_modules.exists():
        return BuildResult(
            name="Studio (Tauri)",
            success=False,
            duration=0,
            error="node_modules not found. Run: cd studio && npm install",
        )

    suffix = "client" if client else "full"
    platform_scripts = {
        "linux": f"build:tauri:linux:{suffix}",
        "win": f"build:tauri:win:{suffix}",
        "mac": f"build:tauri:mac:{suffix}",
    }

    if platform not in platform_scripts:
        return BuildResult(
            name="Studio (Tauri)",
            success=False,
            duration=0,
            error=f"Unknown platform: {platform}. Use: linux, win, or mac",
        )

    npm_script = platform_scripts[platform]
    start_time = time.time()

    try:
        print(f"Running npm run {npm_script}...")
        result = subprocess.run(
            ["npm", "run", npm_script],
            cwd=studio_dir,
            capture_output=False,
        )

        duration = time.time() - start_time

        if result.returncode != 0:
            return BuildResult(
                name="Studio (Tauri)",
                success=False,
                duration=duration,
                error="Tauri build failed",
            )

        return BuildResult(
            name="Studio (Tauri)",
            success=True,
            duration=duration,
        )

    except Exception as e:
        return BuildResult(
            name="Studio (Tauri)",
            success=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def print_summary(results: list[BuildResult]) -> None:
    """Print build summary."""
    print_header("Build Summary")

    total_duration = sum(r.duration for r in results)
    all_success = all(r.success for r in results)

    for result in results:
        status = "OK" if result.success else "FAIL"
        print(f"  {result.name}: {status} ({result.duration:.1f}s)")
        if result.error:
            print(f"    Error: {result.error}")

    print_separator()
    print(f"Total time: {total_duration:.1f}s")
    print()

    if all_success:
        print("Build complete!")
    else:
        failed = [r.name for r in results if not r.success]
        print(f"FAILED: {', '.join(failed)}")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Build Sigilweaver Loom application")
    parser.add_argument(
        "--platform",
        choices=["linux", "win", "mac"],
        default=None,
        help="Target platform (default: auto-detect)",
    )
    parser.add_argument("--server-only", action="store_true", help="Build server only")
    parser.add_argument(
        "--studio-only",
        action="store_true",
        help="Build studio only (assumes server already built)",
    )
    parser.add_argument(
        "--tauri",
        action="store_true",
        help="Build the Tauri shell instead of Electron (stages the server as a sidecar)",
    )
    parser.add_argument(
        "--client",
        action="store_true",
        help="Tauri only: build the Client variant (no bundled server)",
    )
    parser.add_argument(
        "--clean", action="store_true", help="Clean build artifacts before building"
    )

    args = parser.parse_args()

    if args.client and not args.tauri:
        parser.error("--client is only valid together with --tauri")

    # Determine platform
    platform = args.platform or detect_platform()

    # Determine what to build. A Tauri Client build bundles no server, so it
    # skips the server build and the sidecar/resource staging entirely.
    tauri_client = args.tauri and args.client
    build_server_step = not tauri_client
    stage_server_step = not tauri_client
    build_studio_step = True

    if args.server_only:
        build_studio_step = False
        stage_server_step = False
    elif args.studio_only:
        build_server_step = False

    repo_root = get_repo_root()
    results: list[BuildResult] = []

    shell = "Tauri" if args.tauri else "Electron"
    variant = "Client" if tauri_client else "Full"
    print_header("Sigilweaver Loom Build")
    print(f"Repository: {repo_root}")
    print(f"Platform: {platform}")
    print(f"Shell: {shell} ({variant})")

    # Clean if requested
    if args.clean:
        clean_build_artifacts(repo_root)

    # Build steps
    if build_server_step:
        result = build_server(repo_root, platform)
        results.append(result)
        if not result.success:
            print_summary(results)
            return 1

    if stage_server_step:
        # Tauri consumes the server as a target-triple-named sidecar; Electron
        # consumes it as a plain resource copy.
        if args.tauri:
            result = stage_server_sidecar(repo_root, platform)
        else:
            result = copy_server_to_resources(repo_root, platform)
        results.append(result)
        if not result.success:
            print_summary(results)
            return 1

    if build_studio_step:
        if args.tauri:
            result = build_studio_tauri(repo_root, platform, client=args.client)
        else:
            result = build_studio(repo_root, platform)
        results.append(result)

    # Print summary
    print_summary(results)

    # Return appropriate exit code
    return 0 if all(r.success for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
