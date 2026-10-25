#!/usr/bin/env python3
"""
Build script for Sigilweaver Loom Studio (Tauri desktop app).

Builds the complete application for the machine it runs on:
1. Server executable (PyInstaller)
2. Stage the server as a target-triple-named Tauri sidecar (externalBin)
3. Studio + Tauri desktop shell

PyInstaller and Tauri both build for the host, so run this on each OS (and
each CPU architecture) you want an installer for; CI does exactly that.

Usage:
    ./scripts/build.py                    # Full build (bundled server sidecar)
    ./scripts/build.py --client           # Client build (no bundled server)
    ./scripts/build.py --server-only      # Build server only
    ./scripts/build.py --studio-only      # Build studio only (assumes server exists)
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


def get_host_target_triple() -> str:
    """Return the Rust target triple of this machine (`rustc -vV`)."""
    out = subprocess.run(["rustc", "-vV"], capture_output=True, text=True, check=True).stdout
    for line in out.splitlines():
        if line.startswith("host:"):
            return line.split(":", 1)[1].strip()
    raise RuntimeError("Could not read the host target triple from `rustc -vV`")


def platform_of_triple(triple: str) -> str:
    """Map a Rust target triple to linux, win or mac."""
    if "windows" in triple:
        return "win"
    if "apple" in triple:
        return "mac"
    return "linux"


def _stage_server_binary(
    server_src: Path, dest: Path, platform: str, result_name: str
) -> BuildResult:
    """Copy the built server executable to `dest`, making it executable."""
    start_time = time.time()

    try:
        if not server_src.exists():
            return BuildResult(
                name=result_name,
                success=False,
                duration=time.time() - start_time,
                error=f"Server executable not found at {server_src}",
            )

        dest.parent.mkdir(parents=True, exist_ok=True)

        print(f"Staging {server_src} -> {dest}")
        shutil.copy2(server_src, dest)

        if platform != "win":
            dest.chmod(0o755)

        size_mb = dest.stat().st_size / (1024 * 1024)
        print(f"Staged: {dest} ({size_mb:.1f} MB)")

        return BuildResult(
            name=result_name,
            success=True,
            duration=time.time() - start_time,
        )

    except Exception as e:
        return BuildResult(
            name=result_name,
            success=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def stage_server_sidecar(repo_root: Path, triple: str) -> BuildResult:
    """Stage the PyInstaller server binary as a Tauri sidecar.

    Tauri's `externalBin` names sidecars `loom-server-<target-triple>[.exe]`
    under a directory relative to `tauri.conf.json`; the base name and the dir
    (`binaries/`) match the `externalBin` entry in `tauri.conf.full.json`. The
    bundler strips the triple again when it copies the binary next to the app.
    """
    print_header("Staging Server Sidecar")

    platform = platform_of_triple(triple)
    ext = get_server_extension(platform)
    server_src = repo_root / "server" / "dist" / f"server{ext}"
    sidecar_dest = repo_root / "studio" / "tauri" / "binaries" / f"loom-server-{triple}{ext}"

    return _stage_server_binary(server_src, sidecar_dest, platform, "Stage Sidecar")


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
    print_header("Building Server Executable")

    host = get_host_platform()
    if host != platform:
        print(f"  Warning: Host platform is '{host}' but target is '{platform}'.")
        print(f"  PyInstaller will produce a '{host}' binary, not '{platform}'.")
        print("  For cross-platform releases, build the server on each target OS (or use CI).")

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


def build_studio_tauri(repo_root: Path, triple: str, *, client: bool) -> BuildResult:
    """Build the studio + Tauri application.

    A Full build (`client=False`) bundles the staged server sidecar via the
    `build:tauri:full` script, which compiles with the `bundled-server` feature
    and `tauri.conf.full.json`. A Client build (`client=True`) bundles no
    server and uses the base config.
    """
    variant = "Client" if client else "Full"
    print_header(f"Building Studio + Tauri ({variant})")

    studio_dir = repo_root / "studio"
    if not (studio_dir / "node_modules").exists():
        return BuildResult(
            name="Studio",
            success=False,
            duration=0,
            error="node_modules not found. Run: cd studio && bun install",
        )

    script = "build:tauri" if client else "build:tauri:full"
    start_time = time.time()

    try:
        print(f"Running bun run {script} --target {triple}...")
        result = subprocess.run(
            ["bun", "run", script, "--target", triple],
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

        bundle_dir = repo_root / "studio" / "tauri" / "target" / triple / "release" / "bundle"
        if bundle_dir.exists():
            print()
            print(f"Bundles in {bundle_dir}:")
            for item in sorted(bundle_dir.rglob("*")):
                if item.is_file() and item.suffix in {
                    ".deb",
                    ".rpm",
                    ".AppImage",
                    ".exe",
                    ".dmg",
                    ".gz",
                }:
                    size_mb = item.stat().st_size / (1024 * 1024)
                    print(f"  {item.relative_to(bundle_dir)} ({size_mb:.1f} MB)")

        return BuildResult(name="Studio", success=True, duration=duration)

    except Exception as e:
        return BuildResult(
            name="Studio",
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
    parser = argparse.ArgumentParser(description="Build Sigilweaver Loom Studio")
    parser.add_argument("--server-only", action="store_true", help="Build server only")
    parser.add_argument(
        "--studio-only",
        action="store_true",
        help="Build studio only (assumes server already built)",
    )
    parser.add_argument(
        "--client",
        action="store_true",
        help="Build the Client variant (no bundled server)",
    )
    parser.add_argument(
        "--clean", action="store_true", help="Clean build artifacts before building"
    )

    args = parser.parse_args()

    triple = get_host_target_triple()
    platform = platform_of_triple(triple)

    # A Client build bundles no server, so it skips the server build and the
    # sidecar staging entirely.
    build_server_step = not args.client
    stage_server_step = not args.client
    build_studio_step = True

    if args.server_only:
        build_studio_step = False
        stage_server_step = False
    elif args.studio_only:
        build_server_step = False

    if not (build_server_step or stage_server_step or build_studio_step):
        parser.error(
            "--client combined with --server-only leaves nothing to build "
            "(a Client build has no server to build or stage)"
        )

    repo_root = get_repo_root()
    results: list[BuildResult] = []

    variant = "Client" if args.client else "Full"
    print_header("Sigilweaver Loom Build")
    print(f"Repository: {repo_root}")
    print(f"Target: {triple}")
    print(f"Variant: {variant}")

    if args.clean:
        clean_build_artifacts(repo_root)

    if build_server_step:
        result = build_server(repo_root, platform)
        results.append(result)
        if not result.success:
            print_summary(results)
            return 1

    if stage_server_step:
        result = stage_server_sidecar(repo_root, triple)
        results.append(result)
        if not result.success:
            print_summary(results)
            return 1

    if build_studio_step:
        results.append(build_studio_tauri(repo_root, triple, client=args.client))

    print_summary(results)
    return 0 if all(r.success for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
