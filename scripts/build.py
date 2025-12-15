#!/usr/bin/env python3
"""
Cross-platform build script for Sigilweaver.

Builds the complete application:
1. Backend executable (PyInstaller)
2. Copy backend to frontend resources
3. Frontend + Electron app

Usage:
    ./scripts/build.py                # Build for current platform
    ./scripts/build.py --platform linux   # Build for Linux
    ./scripts/build.py --platform win     # Build for Windows
    ./scripts/build.py --platform mac     # Build for macOS
    ./scripts/build.py --backend-only     # Build backend only
    ./scripts/build.py --frontend-only    # Build frontend only (assumes backend exists)
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


def get_backend_extension(platform: str) -> str:
    """Get the backend executable extension for a platform."""
    return ".exe" if platform == "win" else ""


def clean_build_artifacts(repo_root: Path) -> None:
    """Clean previous build artifacts."""
    print("Cleaning build artifacts...")
    
    # Backend artifacts
    backend_dir = repo_root / "backend"
    for path in [backend_dir / "build", backend_dir / "dist"]:
        if path.exists():
            print(f"  Removing {path}")
            shutil.rmtree(path)
    
    # Frontend artifacts
    frontend_dir = repo_root / "frontend"
    for path in [frontend_dir / "dist", frontend_dir / "resources" / "backend"]:
        if path.exists():
            print(f"  Removing {path}")
            shutil.rmtree(path)
    
    print("Clean complete")


def build_backend(repo_root: Path, platform: str) -> BuildResult:
    """Build the backend executable with PyInstaller."""
    print_header("Step 1/3: Building Backend Executable")
    
    backend_dir = repo_root / "backend"
    lock_path = backend_dir / "uv.lock"
    venv_path = backend_dir / ".venv"
    
    if not lock_path.exists():
        return BuildResult(
            name="Backend",
            success=False,
            duration=0,
            error="Backend not set up with uv. Run: cd backend && uv sync --all-extras"
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
            cwd=backend_dir,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return BuildResult(
                name="Backend",
                success=False,
                duration=time.time() - start_time,
                error=f"Failed to sync dependencies: {result.stderr}"
            )
        
        # Clean previous builds
        print("Cleaning previous backend builds...")
        for path in [backend_dir / "build", backend_dir / "dist"]:
            if path.exists():
                shutil.rmtree(path)
        
        # Build with PyInstaller
        print("Building executable with PyInstaller...")
        result = subprocess.run(
            [str(python_path), "-m", "PyInstaller", "sigilweaver.spec", "--clean"],
            cwd=backend_dir,
            capture_output=False,
        )
        
        if result.returncode != 0:
            return BuildResult(
                name="Backend",
                success=False,
                duration=time.time() - start_time,
                error="PyInstaller build failed"
            )
        
        # Verify the build
        ext = get_backend_extension(platform)
        backend_exe = backend_dir / "dist" / f"backend{ext}"
        
        if not backend_exe.exists():
            return BuildResult(
                name="Backend",
                success=False,
                duration=time.time() - start_time,
                error=f"Backend executable not found at {backend_exe}"
            )
        
        duration = time.time() - start_time
        size_mb = backend_exe.stat().st_size / (1024 * 1024)
        print(f"Backend built: {backend_exe} ({size_mb:.1f} MB)")
        
        return BuildResult(
            name="Backend",
            success=True,
            duration=duration,
        )
        
    except Exception as e:
        return BuildResult(
            name="Backend",
            success=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def copy_backend_to_resources(repo_root: Path, platform: str) -> BuildResult:
    """Copy the backend executable to frontend resources."""
    print_header("Step 2/3: Copying Backend to Resources")
    
    start_time = time.time()
    
    try:
        ext = get_backend_extension(platform)
        backend_src = repo_root / "backend" / "dist" / f"backend{ext}"
        resources_dir = repo_root / "frontend" / "resources" / "backend"
        backend_dest = resources_dir / f"backend{ext}"
        
        if not backend_src.exists():
            return BuildResult(
                name="Copy Backend",
                success=False,
                duration=time.time() - start_time,
                error=f"Backend executable not found at {backend_src}"
            )
        
        # Create resources directory
        resources_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy the executable
        print(f"Copying {backend_src} -> {backend_dest}")
        shutil.copy2(backend_src, backend_dest)
        
        # Make executable on Unix
        if platform != "win":
            backend_dest.chmod(0o755)
        
        size_mb = backend_dest.stat().st_size / (1024 * 1024)
        print(f"Backend copied: {backend_dest} ({size_mb:.1f} MB)")
        
        return BuildResult(
            name="Copy Backend",
            success=True,
            duration=time.time() - start_time,
        )
        
    except Exception as e:
        return BuildResult(
            name="Copy Backend",
            success=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def build_frontend(repo_root: Path, platform: str) -> BuildResult:
    """Build the frontend + Electron application."""
    print_header("Step 3/3: Building Frontend + Electron")
    
    frontend_dir = repo_root / "frontend"
    node_modules = frontend_dir / "node_modules"
    
    if not node_modules.exists():
        return BuildResult(
            name="Frontend",
            success=False,
            duration=0,
            error="node_modules not found. Run: cd frontend && npm install"
        )
    
    # Map platform to npm script
    platform_scripts = {
        "linux": "build:linux:full",
        "win": "build:win:full",
        "mac": "build:mac:full",
    }
    
    if platform not in platform_scripts:
        return BuildResult(
            name="Frontend",
            success=False,
            duration=0,
            error=f"Unknown platform: {platform}. Use: linux, win, or mac"
        )
    
    npm_script = platform_scripts[platform]
    start_time = time.time()
    
    try:
        print(f"Running npm run {npm_script}...")
        result = subprocess.run(
            ["npm", "run", npm_script],
            cwd=frontend_dir,
            capture_output=False,
        )
        
        duration = time.time() - start_time
        
        if result.returncode != 0:
            return BuildResult(
                name="Frontend",
                success=False,
                duration=duration,
                error="Frontend build failed"
            )
        
        # List output files
        dist_dir = frontend_dir / "dist"
        if dist_dir.exists():
            print()
            print("Output files:")
            for item in dist_dir.iterdir():
                if item.is_file():
                    size_mb = item.stat().st_size / (1024 * 1024)
                    print(f"  {item.name} ({size_mb:.1f} MB)")
        
        return BuildResult(
            name="Frontend",
            success=True,
            duration=duration,
        )
        
    except Exception as e:
        return BuildResult(
            name="Frontend",
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
    parser = argparse.ArgumentParser(
        description="Build Sigilweaver application"
    )
    parser.add_argument(
        "--platform",
        choices=["linux", "win", "mac"],
        default=None,
        help="Target platform (default: auto-detect)"
    )
    parser.add_argument(
        "--backend-only",
        action="store_true",
        help="Build backend only"
    )
    parser.add_argument(
        "--frontend-only",
        action="store_true",
        help="Build frontend only (assumes backend already built)"
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Clean build artifacts before building"
    )
    
    args = parser.parse_args()
    
    # Determine platform
    platform = args.platform or detect_platform()
    
    # Determine what to build
    build_backend_step = True
    copy_backend_step = True
    build_frontend_step = True
    
    if args.backend_only:
        build_frontend_step = False
        copy_backend_step = False
    elif args.frontend_only:
        build_backend_step = False
    
    repo_root = get_repo_root()
    results: list[BuildResult] = []
    
    print_header("Sigilweaver Build")
    print(f"Repository: {repo_root}")
    print(f"Platform: {platform}")
    
    # Clean if requested
    if args.clean:
        clean_build_artifacts(repo_root)
    
    # Build steps
    if build_backend_step:
        result = build_backend(repo_root, platform)
        results.append(result)
        if not result.success:
            print_summary(results)
            return 1
    
    if copy_backend_step:
        result = copy_backend_to_resources(repo_root, platform)
        results.append(result)
        if not result.success:
            print_summary(results)
            return 1
    
    if build_frontend_step:
        result = build_frontend(repo_root, platform)
        results.append(result)
    
    # Print summary
    print_summary(results)
    
    # Return appropriate exit code
    return 0 if all(r.success for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
