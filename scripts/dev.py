#!/usr/bin/env python3
"""
Sigilweaver Development Script

Starts the Vite dev server for Studio development.
Electron manages the Server automatically (required for token auth).

Usage:
    ./scripts/dev.py              # Start Vite (Electron manages Server)
    ./scripts/dev.py --server     # Server only (for browser dev without Electron)
    ./scripts/dev.py --studio     # Studio only (same as default)
    ./scripts/dev.py --electron   # Also launch Electron after Vite starts
"""

import argparse
import atexit
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

# ANSI color codes (work on most terminals including Windows 10+)
GREEN = "\033[0;32m"
BLUE = "\033[0;34m"
RED = "\033[0;31m"
YELLOW = "\033[1;33m"
NC = "\033[0m"  # No Color

# Global process references for cleanup
server_process: subprocess.Popen | None = None
studio_process: subprocess.Popen | None = None
electron_process: subprocess.Popen | None = None
shutdown_requested = False


def get_repo_root() -> Path:
    """Find the repository root directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent


def print_banner() -> None:
    """Print the startup banner."""
    print(f"{BLUE}========================================{NC}")
    print(f"{BLUE}  Sigilweaver Development Launcher{NC}")
    print(f"{BLUE}========================================{NC}")
    print()


def print_error(message: str) -> None:
    """Print an error message in red."""
    print(f"{RED}ERROR: {message}{NC}")


def print_warning(message: str) -> None:
    """Print a warning message in yellow."""
    print(f"{YELLOW}{message}{NC}")


def print_success(message: str) -> None:
    """Print a success message in green."""
    print(f"{GREEN}{message}{NC}")


def check_server_setup(repo_root: Path) -> bool:
    """Check if server is set up with uv."""
    lock_path = repo_root / "server" / "uv.lock"
    venv_path = repo_root / "server" / ".venv"
    if not lock_path.exists() or not venv_path.exists():
        print_error("Server not set up!")
        print_warning("Please set up the server first:")
        print("  cd server")
        print("  uv sync --all-extras")
        return False
    return True


def check_studio_setup(repo_root: Path) -> bool:
    """Check if studio node_modules exists."""
    node_modules = repo_root / "studio" / "node_modules"
    if not node_modules.exists():
        print_error("Studio dependencies not installed!")
        print_warning("Please set up the studio first:")
        print("  cd studio")
        print("  npm install")
        return False
    return True


def get_python_executable(repo_root: Path) -> Path:
    """Get the Python executable path from the virtual environment."""
    venv_path = repo_root / "server" / ".venv"
    if sys.platform == "win32":
        return venv_path / "Scripts" / "python.exe"
    return venv_path / "bin" / "python"


def get_npm_command() -> str:
    """Get the npm command (npm.cmd on Windows)."""
    if sys.platform == "win32":
        return "npm.cmd"
    return "npm"


def stream_output(process: subprocess.Popen, prefix: str) -> None:
    """Stream process output with a prefix."""
    if process.stdout is None:
        return
    
    try:
        for line in iter(process.stdout.readline, ""):
            if shutdown_requested:
                break
            if line:
                print(f"[{prefix}] {line}", end="", flush=True)
    except (ValueError, OSError):
        # Process closed or pipe broken
        pass


def start_server(repo_root: Path) -> subprocess.Popen | None:
    """Start the server uvicorn server."""
    global server_process
    
    print_success("Starting Python server...")
    
    server_dir = repo_root / "server"
    python_path = get_python_executable(repo_root)
    
    cmd = [
        str(python_path),
        "-m", "uvicorn",
        "app.main:app",
        "--reload",
        "--host", "0.0.0.0",
        "--port", "8000"
    ]
    
    # Set environment variables
    env = os.environ.copy()
    env["POLARS_VERBOSE"] = "1"
    env["AUTH_MODE"] = "disabled"  # Disable auth for direct API access during development
    
    try:
        # Use shell=False for cross-platform compatibility
        server_process = subprocess.Popen(
            cmd,
            cwd=server_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,  # Line buffered
        )
        
        # Start output streaming in a separate thread
        thread = threading.Thread(
            target=stream_output,
            args=(server_process, "SERVER"),
            daemon=True
        )
        thread.start()
        
        return server_process
    except Exception as e:
        print_error(f"Failed to start server: {e}")
        return None


def start_studio(repo_root: Path) -> subprocess.Popen | None:
    """Start the Vite development server."""
    global studio_process
    
    print_success("Starting Vite dev server...")
    
    studio_dir = repo_root / "studio"
    npm_cmd = get_npm_command()
    
    try:
        studio_process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=studio_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=(sys.platform == "win32"),  # Required for npm.cmd on Windows
        )
        
        # Start output streaming in a separate thread
        thread = threading.Thread(
            target=stream_output,
            args=(studio_process, "STUDIO"),
            daemon=True
        )
        thread.start()
        
        return studio_process
    except Exception as e:
        print_error(f"Failed to start studio: {e}")
        return None


def start_electron(repo_root: Path) -> subprocess.Popen | None:
    """Start Electron (optional)."""
    global electron_process
    
    print_success("Starting Electron...")
    
    studio_dir = repo_root / "studio"
    npm_cmd = get_npm_command()
    
    try:
        electron_process = subprocess.Popen(
            [npm_cmd, "run", "electron"],
            cwd=studio_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=(sys.platform == "win32"),
        )
        
        # Start output streaming in a separate thread
        thread = threading.Thread(
            target=stream_output,
            args=(electron_process, "ELECTRON"),
            daemon=True
        )
        thread.start()
        
        return electron_process
    except Exception as e:
        print_error(f"Failed to start Electron: {e}")
        return None


def terminate_process(process: subprocess.Popen | None, name: str) -> None:
    """Gracefully terminate a process."""
    if process is None:
        return
    
    if process.poll() is None:  # Process still running
        print_warning(f"Stopping {name} (PID: {process.pid})...")
        try:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                print_warning(f"Force killing {name}...")
                process.kill()
                process.wait(timeout=2)
        except Exception as e:
            print_error(f"Error stopping {name}: {e}")


def cleanup() -> None:
    """Clean up all running processes."""
    global shutdown_requested
    shutdown_requested = True
    
    print()
    print_warning("Shutting down services...")
    
    terminate_process(electron_process, "Electron")
    terminate_process(studio_process, "Studio")
    terminate_process(server_process, "Server")
    
    print_success("All services stopped")


def signal_handler(signum: int, frame) -> None:
    """Handle interrupt signals."""
    cleanup()
    sys.exit(0)


def print_status(run_server: bool, run_studio: bool, run_electron: bool) -> None:
    """Print status information after services start."""
    print()
    print_success("Services started!")
    print(f"{BLUE}========================================{NC}")
    if run_server:
        print(f"Server API:     {GREEN}http://localhost:8000{NC}")
        print(f"API Docs:       {GREEN}http://localhost:8000/docs{NC}")
    if run_studio:
        print(f"Studio:         {GREEN}http://localhost:5173{NC}")
    print(f"{BLUE}========================================{NC}")
    if not run_electron and run_studio:
        print_warning("To launch Electron, run in another terminal:")
        print("   cd studio && npm run electron")
        print()
        print("Or restart with: ./scripts/dev.py --electron")
    print()
    print_warning("Press Ctrl+C to stop all services")
    print()


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Sigilweaver Development Launcher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    ./scripts/dev.py              # Start Vite (Electron manages Server)
    ./scripts/dev.py --server     # Server only (for browser dev)
    ./scripts/dev.py --studio     # Studio only (same as default)
    ./scripts/dev.py --electron   # Also launch Electron explicitly
        """
    )
    parser.add_argument(
        "--server",
        action="store_true",
        help="Start server only"
    )
    parser.add_argument(
        "--studio",
        action="store_true",
        help="Start studio only"
    )
    parser.add_argument(
        "--electron",
        action="store_true",
        help="Also launch Electron after studio starts"
    )
    
    args = parser.parse_args()
    
    # Determine what to run
    # By default, just run studio (Vite auto-launches Electron which manages server)
    # Use --server for browser-only development without Electron
    if not args.server and not args.studio:
        run_server = False
        run_studio = True
    else:
        run_server = args.server
        run_studio = args.studio
    
    run_electron = args.electron
    
    # If electron requested but not studio, enable studio too
    if run_electron and not run_studio:
        run_studio = True
    
    # Get repo root
    repo_root = get_repo_root()
    
    # Print banner
    print_banner()
    
    # Check prerequisites
    if run_server and not check_server_setup(repo_root):
        return 1
    
    if run_studio and not check_studio_setup(repo_root):
        return 1
    
    # Register cleanup handlers
    atexit.register(cleanup)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # On Windows, also handle CTRL_C_EVENT and CTRL_BREAK_EVENT
    if sys.platform == "win32":
        signal.signal(signal.SIGBREAK, signal_handler)
    
    # Start services
    if run_server:
        if start_server(repo_root) is None:
            return 1
        # Give server a moment to start
        time.sleep(2)
    
    if run_studio:
        if start_studio(repo_root) is None:
            return 1
        # Wait for Vite to start
        time.sleep(3)
    
    if run_electron:
        # Wait a bit more for studio to be ready
        time.sleep(2)
        if start_electron(repo_root) is None:
            print_warning("Electron failed to start, but other services are running")
    
    # Print status
    print_status(run_server, run_studio, run_electron)
    
    # Wait for processes to complete (they run until interrupted)
    try:
        while True:
            # Check if any required process has died
            if run_server and server_process and server_process.poll() is not None:
                print_error("Server process died unexpectedly!")
                break
            if run_studio and studio_process and studio_process.poll() is not None:
                print_error("Studio process died unexpectedly!")
                break
            if run_electron and electron_process and electron_process.poll() is not None:
                # Electron closing is expected (user closed window)
                print_warning("Electron closed")
                run_electron = False
                # If only electron was the user focus, maybe exit?
                # For now, keep other services running
            
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    
    cleanup()
    return 0


if __name__ == "__main__":
    sys.exit(main())
