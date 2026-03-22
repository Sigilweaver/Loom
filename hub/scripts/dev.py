#!/usr/bin/env python3
"""
Sigilweaver Loom Hub Development Script

Starts both the backend and frontend development servers.

Usage:
    ./scripts/dev.py              # Start both backend and frontend
    ./scripts/dev.py --backend    # Backend only
    ./scripts/dev.py --frontend   # Frontend only
"""

import argparse
import atexit
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

# ANSI color codes
GREEN = "\033[0;32m"
BLUE = "\033[0;34m"
RED = "\033[0;31m"
YELLOW = "\033[1;33m"
NC = "\033[0m"  # No Color

# Global process references for cleanup
backend_process: subprocess.Popen | None = None
frontend_process: subprocess.Popen | None = None
shutdown_requested = False


def get_repo_root() -> Path:
    """Find the hub root directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent


def print_banner() -> None:
    """Print the startup banner."""
    print(f"{BLUE}========================================{NC}")
    print(f"{BLUE}  Sigilweaver Loom Hub Development Launcher{NC}")
    print(f"{BLUE}========================================{NC}")
    print()


def check_prerequisites() -> bool:
    """Check that required tools are installed."""
    # Check for uv
    try:
        subprocess.run(
            ["uv", "--version"],
            capture_output=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"{RED}Error: uv is not installed or not in PATH{NC}")
        print("Install with: curl -LsSf https://astral.sh/uv/install.sh | sh")
        return False

    # Check for npm
    try:
        subprocess.run(
            ["npm", "--version"],
            capture_output=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"{RED}Error: npm is not installed or not in PATH{NC}")
        return False

    return True


def start_backend(repo_root: Path) -> subprocess.Popen:
    """Start the FastAPI backend server."""
    backend_dir = repo_root / "backend"

    print(f"{BLUE}Starting backend server...{NC}")

    # Use uv to run uvicorn
    process = subprocess.Popen(
        [
            "uv",
            "run",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "25802",
            "--reload",
        ],
        cwd=backend_dir,
        env={**os.environ},
    )

    return process


def start_frontend(repo_root: Path) -> subprocess.Popen:
    """Start the Vite frontend dev server."""
    frontend_dir = repo_root / "frontend"

    print(f"{BLUE}Starting frontend server...{NC}")

    process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir,
        env={**os.environ},
    )

    return process


def cleanup() -> None:
    """Clean up processes on exit."""
    global backend_process, frontend_process, shutdown_requested

    if shutdown_requested:
        return
    shutdown_requested = True

    print(f"\n{YELLOW}Shutting down...{NC}")

    for name, process in [("Backend", backend_process), ("Frontend", frontend_process)]:
        if process and process.poll() is None:
            print(f"  Stopping {name}...")
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


def signal_handler(signum: int, frame: object) -> None:
    """Handle interrupt signals."""
    cleanup()
    sys.exit(0)


def main() -> int:
    global backend_process, frontend_process

    parser = argparse.ArgumentParser(description="Sigilweaver Loom Hub Development Launcher")
    parser.add_argument("--backend", action="store_true", help="Start backend only")
    parser.add_argument("--frontend", action="store_true", help="Start frontend only")
    args = parser.parse_args()

    # If neither specified, start both
    start_backend_flag = args.backend or (not args.backend and not args.frontend)
    start_frontend_flag = args.frontend or (not args.backend and not args.frontend)

    print_banner()

    if not check_prerequisites():
        return 1

    repo_root = get_repo_root()

    # Register cleanup handlers
    atexit.register(cleanup)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        if start_backend_flag:
            backend_process = start_backend(repo_root)
            time.sleep(2)  # Give backend time to start

        if start_frontend_flag:
            frontend_process = start_frontend(repo_root)

        print()
        print(f"{GREEN}Development servers started!{NC}")
        print()
        if start_backend_flag:
            print(f"  Backend API:  {BLUE}http://localhost:25802{NC}")
            print(f"  API Docs:     {BLUE}http://localhost:25802/docs{NC}")
        if start_frontend_flag:
            print(f"  Frontend:     {BLUE}http://localhost:25803{NC}")
        print()
        print(f"{YELLOW}Press Ctrl+C to stop{NC}")

        # Wait for processes
        while True:
            if backend_process and backend_process.poll() is not None:
                print(f"{RED}Backend process exited unexpectedly{NC}")
                break
            if frontend_process and frontend_process.poll() is not None:
                print(f"{RED}Frontend process exited unexpectedly{NC}")
                break
            time.sleep(1)

    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

    return 0


if __name__ == "__main__":
    sys.exit(main())
