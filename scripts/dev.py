#!/usr/bin/env python3
"""
Sigilweaver Development Script

Starts development servers for Studio, Server, Hub, Docs, and/or Site.

Usage:
    ./scripts/dev.py                    # Start all components (Server, Studio, Hub)
    ./scripts/dev.py --server           # Server only
    ./scripts/dev.py --studio           # Studio only  
    ./scripts/dev.py --hub              # Hub only (backend + frontend)
    ./scripts/dev.py --docs             # Documentation site only (Docusaurus)
    ./scripts/dev.py --site             # Marketing website only (Vite)
    ./scripts/dev.py --studio --server  # Multiple components
    ./scripts/dev.py --hub-auth         # All components with Hub authentication enabled
    ./scripts/dev.py --electron         # All components + launch Electron
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
hub_backend_process: subprocess.Popen | None = None
hub_frontend_process: subprocess.Popen | None = None
docs_process: subprocess.Popen | None = None
site_process: subprocess.Popen | None = None
shutdown_requested = False

# Patterns for noisy log lines to filter out (case-insensitive matching)
# These are routine/health-check type messages that clutter the output
NOISE_PATTERNS = [
    # HTTP 200/201/304 responses (successful, not interesting in dev)
    '" 200 ',
    '" 201 ',
    '" 304 ',
    # Health check endpoints
    '/health',
    '/api/health',
    # Vite HMR noise
    'hmr update',
    'hmr connection',
    'page reload',
    # Routine polling
    'http proxy error',  # Vite proxy errors when backend not ready yet
]

# Patterns that should ALWAYS be shown regardless of noise filtering
IMPORTANT_PATTERNS = [
    'error',
    'exception',
    'traceback',
    'failed',
    'warning',
    'started',
    'ready',
    'listening',
    'running on',
    'startup complete',
    'application startup',
    'cannot reach',
    'unauthorized',  # Auth issues are important
    '" 4',  # 4xx errors
    '" 5',  # 5xx errors
]

# Ports used by dev services (258xx scheme based on founding date 2025-08-01)
DEV_PORTS = {
    25801: "PostgreSQL",
    25802: "Hub API",
    25803: "Hub UI",
    25808: "Site",
    25809: "Docs",
    25810: "Studio",
    25811: "Server",
}


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


def kill_process_on_port(port: int) -> bool:
    """Kill any process using a specific port.
    
    Returns:
        True if a process was killed, False if port was free.
    """
    if sys.platform == "win32":
        # Windows: use netstat + taskkill
        try:
            result = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True,
                text=True,
            )
            for line in result.stdout.splitlines():
                if f":{port}" in line and "LISTENING" in line:
                    parts = line.split()
                    pid = parts[-1]
                    subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                    return True
        except Exception:
            pass
    else:
        # Unix: use lsof
        try:
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0 and result.stdout.strip():
                pids = result.stdout.strip().split('\n')
                for pid in pids:
                    try:
                        os.kill(int(pid), signal.SIGKILL)
                    except (ProcessLookupError, ValueError):
                        pass
                return True
        except FileNotFoundError:
            # lsof not available, try fuser
            try:
                subprocess.run(
                    ["fuser", "-k", f"{port}/tcp"],
                    capture_output=True,
                )
            except FileNotFoundError:
                pass
    return False


def cleanup_stale_processes(ports: list[int]) -> None:
    """Kill any stale processes on the ports we need."""
    killed_any = False
    for port in ports:
        if kill_process_on_port(port):
            service_name = DEV_PORTS.get(port, f"port {port}")
            print_warning(f"  Killed stale process on {service_name} (port {port})")
            killed_any = True
    
    if killed_any:
        time.sleep(1)  # Give OS time to release ports


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


def is_display_available() -> bool:
    """Check if a display server is available for GUI applications."""
    # Check for X11 display and verify it's actually accessible
    display = os.environ.get("DISPLAY")
    if display:
        try:
            # Try to connect to X server
            result = subprocess.run(
                ["xdpyinfo"],
                capture_output=True,
                timeout=2,
            )
            if result.returncode == 0:
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    
    # Check for Wayland - harder to verify, but check if socket exists
    wayland_display = os.environ.get("WAYLAND_DISPLAY")
    xdg_runtime = os.environ.get("XDG_RUNTIME_DIR", "/run/user/1000")
    if wayland_display:
        socket_path = Path(xdg_runtime) / wayland_display
        if socket_path.exists():
            return True
    
    return False


def check_postgres_running(port: int = 25801) -> bool:
    """Check if PostgreSQL is running on the expected port."""
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            s.connect(("localhost", port))
            return True
    except (ConnectionRefusedError, socket.timeout, OSError):
        return False


def ensure_postgres_running(repo_root: Path, timeout: int = 30) -> bool:
    """Ensure PostgreSQL is running, starting it if needed.
    
    Returns:
        True if PostgreSQL is running, False if it failed to start.
    """
    if check_postgres_running():
        return True
    
    print_warning("PostgreSQL not running, starting it...")
    hub_dir = repo_root / "hub"
    
    try:
        # Start PostgreSQL via docker compose
        result = subprocess.run(
            ["docker", "compose", "up", "-d", "postgres"],
            cwd=hub_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            print_error(f"Failed to start PostgreSQL: {result.stderr}")
            return False
        
        # Wait for PostgreSQL to be ready
        print("  Waiting for PostgreSQL to be ready...")
        start_time = time.time()
        while time.time() - start_time < timeout:
            if check_postgres_running():
                print_success("  PostgreSQL is ready!")
                return True
            time.sleep(1)
        
        print_error("PostgreSQL failed to start within timeout")
        return False
        
    except subprocess.TimeoutExpired:
        print_error("Timed out starting PostgreSQL")
        return False
    except Exception as e:
        print_error(f"Failed to start PostgreSQL: {e}")
        return False


def wait_for_hub_healthy(timeout: int = 30) -> bool:
    """Wait for Hub backend to be healthy.
    
    Returns:
        True if Hub is healthy, False if timeout.
    """
    import urllib.request
    import urllib.error
    
    print("  Waiting for Hub API to be ready...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request("http://localhost:25802/api/v1/health")
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    print_success("  Hub API is ready!")
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError, OSError):
            pass
        time.sleep(0.5)
    
    print_warning("  Hub API not responding yet (Server may retry registration)")
    return False


def run_hub_migrations(repo_root: Path) -> bool:
    """Run database migrations for the Hub backend.
    
    Returns:
        True if migrations succeeded, False otherwise.
    """
    hub_backend_dir = repo_root / "hub" / "backend"
    venv_python = hub_backend_dir / ".venv" / "bin" / "python"
    
    if not venv_python.exists():
        print_error("Hub backend venv not found, skipping migrations")
        return False
    
    print("  Running database migrations...")
    try:
        result = subprocess.run(
            [str(venv_python), "-m", "alembic", "upgrade", "head"],
            cwd=hub_backend_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            # Check if it's just "already at head"
            if "already at head" in result.stdout.lower() or result.returncode == 0:
                print_success("  Database is up to date!")
                return True
            print_error(f"Migration failed: {result.stderr}")
            print(result.stdout)
            return False
        
        print_success("  Migrations complete!")
        return True
        
    except subprocess.TimeoutExpired:
        print_error("Migrations timed out")
        return False
    except Exception as e:
        print_error(f"Migration failed: {e}")
        return False


def check_hub_setup(repo_root: Path) -> tuple[bool, bool]:
    """Check if hub backend and frontend are set up.
    
    Returns:
        Tuple of (backend_ready, frontend_ready)
    """
    hub_dir = repo_root / "hub"
    backend_ready = True
    frontend_ready = True
    
    # Check backend
    backend_venv = hub_dir / "backend" / ".venv"
    backend_lock = hub_dir / "backend" / "uv.lock"
    if not backend_venv.exists() or not backend_lock.exists():
        print_error("Hub backend not set up!")
        print_warning("Please set up the hub backend first:")
        print("  cd hub/backend")
        print("  uv sync --all-extras")
        backend_ready = False
    
    # Ensure PostgreSQL is running (auto-start if needed)
    if not ensure_postgres_running(repo_root):
        backend_ready = False
    elif backend_ready:
        # Run migrations if PostgreSQL is running and backend is set up
        if not run_hub_migrations(repo_root):
            print_warning("Migrations failed, Hub may not work correctly")
    
    # Check frontend
    frontend_modules = hub_dir / "frontend" / "node_modules"
    if not frontend_modules.exists():
        print_error("Hub frontend dependencies not installed!")
        print_warning("Please set up the hub frontend first:")
        print("  cd hub/frontend")
        print("  npm install")
        frontend_ready = False
    
    return backend_ready, frontend_ready


def check_docs_setup(repo_root: Path) -> bool:
    """Check if docs node_modules exists."""
    node_modules = repo_root / "docs" / "node_modules"
    if not node_modules.exists():
        print_error("Docs dependencies not installed!")
        print_warning("Please set up the docs first:")
        print("  cd docs")
        print("  npm install")
        return False
    return True


def check_site_setup(repo_root: Path) -> bool:
    """Check if site node_modules exists."""
    node_modules = repo_root / "site" / "node_modules"
    if not node_modules.exists():
        print_error("Site dependencies not installed!")
        print_warning("Please set up the site first:")
        print("  cd site")
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
    """Stream process output with a prefix, filtering out noise."""
    if process.stdout is None:
        return
    
    try:
        for line in iter(process.stdout.readline, ""):
            if shutdown_requested:
                break
            if line:
                line_lower = line.lower()
                
                # Always show important messages
                is_important = any(pattern in line_lower for pattern in IMPORTANT_PATTERNS)
                
                # Filter out noise unless it's important
                if not is_important:
                    is_noise = any(pattern in line_lower for pattern in NOISE_PATTERNS)
                    if is_noise:
                        continue
                
                print(f"[{prefix}] {line}", end="", flush=True)
    except (ValueError, OSError):
        # Process closed or pipe broken
        pass


def start_server(repo_root: Path, hub_auth: bool = False) -> subprocess.Popen | None:
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
        "--port", "25811"
    ]
    
    # Set environment variables
    env = os.environ.copy()
    env["POLARS_VERBOSE"] = "1"
    env["PORT"] = "25811"  # Must match --port arg so settings.port is correct for Hub registration
    
    if hub_auth:
        env["AUTH_MODE"] = "hub"
        env["HUB_URL"] = "http://localhost:25802"  # Hub backend port
        # Development server token - Server will auto-register with Hub on startup
        env["HUB_SERVER_TOKEN"] = "dev-server-token"
        # Registration secret - must match Hub's SERVER_REGISTRATION_SECRET
        env["HUB_REGISTRATION_SECRET"] = "dev-registration-secret"
        print_success("  Hub auth mode enabled (validating tokens with Hub)")
        print_success("  Server will auto-register with Hub on startup")
    else:
        env["AUTH_MODE"] = "disabled"  # Disable auth for direct API access
    
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
    
    # Check for display in headless environments
    if not is_display_available():
        print_warning("No display available (headless environment)")
        print_warning("Skipping Electron - use Studio web UI at http://localhost:25810")
        return None
    
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


def start_hub_backend(repo_root: Path) -> subprocess.Popen | None:
    """Start the Hub backend (FastAPI)."""
    global hub_backend_process
    
    print_success("Starting Hub backend...")
    
    hub_backend_dir = repo_root / "hub" / "backend"
    venv_path = hub_backend_dir / ".venv"
    if sys.platform == "win32":
        python_path = venv_path / "Scripts" / "python.exe"
    else:
        python_path = venv_path / "bin" / "python"
    
    cmd = [
        str(python_path),
        "-m", "uvicorn",
        "app.main:app",
        "--reload",
        "--host", "0.0.0.0",
        "--port", "25802"
    ]
    
    # Set environment variables for Hub
    env = os.environ.copy()
    # Development encryption key for Hub connections (valid Fernet key)
    # In production, generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    env["CONNECTION_ENCRYPTION_KEY"] = "xFvKugJ1oWmzFdB_MaNc0M0MJZhcZ9IVcRWf76dm85c="
    # Development registration secret - servers must provide this to register
    # In production, generate a secure random string
    env["SERVER_REGISTRATION_SECRET"] = "dev-registration-secret"
    
    try:
        hub_backend_process = subprocess.Popen(
            cmd,
            cwd=hub_backend_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        
        thread = threading.Thread(
            target=stream_output,
            args=(hub_backend_process, "HUB-API"),
            daemon=True
        )
        thread.start()
        
        return hub_backend_process
    except Exception as e:
        print_error(f"Failed to start Hub backend: {e}")
        return None


def start_hub_frontend(repo_root: Path) -> subprocess.Popen | None:
    """Start the Hub frontend (Vite)."""
    global hub_frontend_process
    
    print_success("Starting Hub frontend...")
    
    hub_frontend_dir = repo_root / "hub" / "frontend"
    npm_cmd = get_npm_command()
    
    try:
        hub_frontend_process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=hub_frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=(sys.platform == "win32"),
        )
        
        thread = threading.Thread(
            target=stream_output,
            args=(hub_frontend_process, "HUB-UI"),
            daemon=True
        )
        thread.start()
        
        return hub_frontend_process
    except Exception as e:
        print_error(f"Failed to start Hub frontend: {e}")
        return None


def start_docs(repo_root: Path) -> subprocess.Popen | None:
    """Start the documentation site (Docusaurus)."""
    global docs_process
    
    print_success("Starting Docs dev server...")
    
    docs_dir = repo_root / "docs"
    npm_cmd = get_npm_command()
    
    try:
        docs_process = subprocess.Popen(
            [npm_cmd, "run", "start"],
            cwd=docs_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=(sys.platform == "win32"),
        )
        
        thread = threading.Thread(
            target=stream_output,
            args=(docs_process, "DOCS"),
            daemon=True
        )
        thread.start()
        
        return docs_process
    except Exception as e:
        print_error(f"Failed to start Docs: {e}")
        return None


def start_site(repo_root: Path) -> subprocess.Popen | None:
    """Start the marketing website (Vite)."""
    global site_process
    
    print_success("Starting Site dev server...")
    
    site_dir = repo_root / "site"
    npm_cmd = get_npm_command()
    
    try:
        site_process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=site_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=(sys.platform == "win32"),
        )
        
        thread = threading.Thread(
            target=stream_output,
            args=(site_process, "SITE"),
            daemon=True
        )
        thread.start()
        
        return site_process
    except Exception as e:
        print_error(f"Failed to start Site: {e}")
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
    terminate_process(site_process, "Site")
    terminate_process(docs_process, "Docs")
    terminate_process(hub_frontend_process, "Hub Frontend")
    terminate_process(hub_backend_process, "Hub Backend")
    terminate_process(studio_process, "Studio")
    terminate_process(server_process, "Server")
    
    print_success("All services stopped")


def signal_handler(signum: int, frame) -> None:
    """Handle interrupt signals."""
    cleanup()
    sys.exit(0)


def print_status(run_server: bool, run_studio: bool, run_electron: bool, run_hub: bool, run_docs: bool = False, run_site: bool = False) -> None:
    """Print status information after services start."""
    print()
    print_success("Services started!")
    print(f"{BLUE}========================================{NC}")
    if run_server:
        print(f"Server API:     {GREEN}http://localhost:25811{NC}")
        print(f"API Docs:       {GREEN}http://localhost:25811/docs{NC}")
    if run_studio:
        print(f"Studio:         {GREEN}http://localhost:25810{NC}")
    if run_hub:
        print(f"Hub API:        {GREEN}http://localhost:25802{NC}")
        print(f"Hub API Docs:   {GREEN}http://localhost:25802/docs{NC}")
        print(f"Hub UI:         {GREEN}http://localhost:25803{NC}")
    if run_docs:
        print(f"Docs:           {GREEN}http://localhost:25809{NC}")
    if run_site:
        print(f"Site:           {GREEN}http://localhost:25808{NC}")
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
    ./scripts/dev.py                    # Start all components (Server, Studio, Hub)
    ./scripts/dev.py --server           # Server only
    ./scripts/dev.py --studio           # Studio only
    ./scripts/dev.py --hub              # Hub only (backend + frontend)
    ./scripts/dev.py --docs             # Docs only (Docusaurus)
    ./scripts/dev.py --site             # Site only (marketing website)
    ./scripts/dev.py --studio --server  # Multiple components
    ./scripts/dev.py --hub-auth         # All components with Hub authentication enabled
    ./scripts/dev.py --electron         # All components + launch Electron
        """
    )
    parser.add_argument(
        "--server",
        action="store_true",
        help="Start server"
    )
    parser.add_argument(
        "--studio",
        action="store_true",
        help="Start studio"
    )
    parser.add_argument(
        "--electron",
        action="store_true",
        help="Also launch Electron after studio starts"
    )
    parser.add_argument(
        "--hub",
        action="store_true",
        help="Start hub (backend + frontend)"
    )
    parser.add_argument(
        "--hub-auth",
        action="store_true",
        help="Enable Hub authentication mode (Server validates tokens with Hub)"
    )
    parser.add_argument(
        "--docs",
        action="store_true",
        help="Start documentation site (Docusaurus)"
    )
    parser.add_argument(
        "--site",
        action="store_true",
        help="Start marketing website (Vite)"
    )
    
    args = parser.parse_args()
    
    # Determine what to run
    # If any specific services requested, only run those
    any_specific = args.server or args.studio or args.hub or args.docs or args.site
    
    if any_specific:
        run_server = args.server
        run_studio = args.studio
        run_hub = args.hub
        run_docs = args.docs
        run_site = args.site
    # Default: run core components (Server, Studio, Hub) but not docs/site
    else:
        run_server = True
        run_studio = True
        run_hub = True
        run_docs = False
        run_site = False
    
    run_electron = args.electron
    
    # If electron requested but not studio, enable studio too
    if run_electron and not run_studio:
        run_studio = True
    
    # If Hub is running, enable hub auth mode for the server automatically
    # This ensures Hub connections work without requiring --hub-auth flag
    hub_auth = args.hub_auth or run_hub
    
    # Get repo root
    repo_root = get_repo_root()
    
    # Print banner
    print_banner()
    
    # Check prerequisites
    if run_server and not check_server_setup(repo_root):
        return 1
    
    if run_studio and not check_studio_setup(repo_root):
        return 1
    
    if run_hub:
        hub_backend_ready, hub_frontend_ready = check_hub_setup(repo_root)
        if not hub_backend_ready or not hub_frontend_ready:
            return 1
    
    if run_docs and not check_docs_setup(repo_root):
        return 1
    
    if run_site and not check_site_setup(repo_root):
        return 1
    
    # Register cleanup handlers
    atexit.register(cleanup)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # On Windows, also handle CTRL_C_EVENT and CTRL_BREAK_EVENT
    if sys.platform == "win32":
        signal.signal(signal.SIGBREAK, signal_handler)
    
    # Clean up any stale processes from previous runs
    ports_to_clean = []
    if run_server:
        ports_to_clean.append(25811)
    if run_studio:
        ports_to_clean.append(25810)
    if run_hub:
        ports_to_clean.extend([25802, 25803])
    if run_docs:
        ports_to_clean.append(25809)
    if run_site:
        ports_to_clean.append(25808)
    
    cleanup_stale_processes(list(set(ports_to_clean)))
    
    # Start services in dependency order:
    # 1. Hub backend (if needed) - Server depends on Hub for registration
    # 2. Server - needs Hub to be ready for registration
    # 3. Studio/Hub frontend - can start in parallel with Server
    # 4. Docs/Site - independent
    
    if run_hub:
        if start_hub_backend(repo_root) is None:
            return 1
        # Wait for Hub to be healthy before starting Server
        wait_for_hub_healthy(timeout=15)
    
    if run_server:
        if start_server(repo_root, hub_auth=hub_auth) is None:
            return 1
        # Give server a moment to start
        time.sleep(2)
    
    if run_studio:
        if start_studio(repo_root) is None:
            return 1
        # Wait for Vite to start
        time.sleep(3)
    
    if run_hub:
        # Hub backend already started above, now start frontend
        if start_hub_frontend(repo_root) is None:
            return 1
        time.sleep(2)
    
    if run_docs:
        if start_docs(repo_root) is None:
            return 1
        time.sleep(2)
    
    if run_site:
        if start_site(repo_root) is None:
            return 1
        time.sleep(2)
    
    if run_electron:
        # Wait a bit more for studio to be ready
        time.sleep(2)
        if start_electron(repo_root) is None:
            print_warning("Electron failed to start, but other services are running")
    
    # Print status
    print_status(run_server, run_studio, run_electron, run_hub, run_docs, run_site)
    
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
            if run_hub:
                if hub_backend_process and hub_backend_process.poll() is not None:
                    print_error("Hub backend process died unexpectedly!")
                    break
                if hub_frontend_process and hub_frontend_process.poll() is not None:
                    print_error("Hub frontend process died unexpectedly!")
                    break
            if run_docs and docs_process and docs_process.poll() is not None:
                print_error("Docs process died unexpectedly!")
                break
            if run_site and site_process and site_process.poll() is not None:
                print_error("Site process died unexpectedly!")
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
