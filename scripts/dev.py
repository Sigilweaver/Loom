#!/usr/bin/env python3
"""
Sigilweaver Loom Development Script

Starts development servers for Studio, Server, Hub, and/or Docs.
Dependencies are automatically installed when missing.

Usage:
    ./scripts/dev.py                    # Start all core components (auto-installs deps)
    ./scripts/dev.py --server           # Server only
    ./scripts/dev.py --studio           # Studio (web mode)
    ./scripts/dev.py --studio-electron  # Studio as Electron desktop app
    ./scripts/dev.py --studio-tauri     # Studio as Tauri desktop app
    ./scripts/dev.py --hub              # Hub only (backend + frontend)
    ./scripts/dev.py --docs             # Documentation site only (Docusaurus)
    ./scripts/dev.py --studio --server  # Multiple components
    ./scripts/dev.py --hub-auth         # Specified components with Hub authentication enabled
    ./scripts/dev.py --all              # Start all core components (Server, Studio, Hub)

    # Force reinstall dependencies (useful after branch switch)
    ./scripts/dev.py --server --install
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
tauri_process: subprocess.Popen | None = None
hub_backend_process: subprocess.Popen | None = None
hub_frontend_process: subprocess.Popen | None = None
docs_process: subprocess.Popen | None = None
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
    25809: "Docs",
    25810: "Studio",
    25811: "Server",
}


def read_dotenv(path: Path) -> dict[str, str]:
    """Read a .env file and return a dict of key=value pairs.

    Handles quoting (single/double), inline comments, and skips blanks/comments.
    Does NOT handle multi-line values.
    """
    env_vars: dict[str, str] = {}
    if not path.exists():
        return env_vars
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        # Strip surrounding quotes
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        env_vars[key] = value
    return env_vars


def get_repo_root() -> Path:
    """Find the repository root directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent


def print_banner() -> None:
    """Print the startup banner."""
    print(f"{BLUE}========================================{NC}")
    print(f"{BLUE}  Sigilweaver Loom Development Launcher{NC}")
    print(f"{BLUE}========================================{NC}")
    print()


def print_error(message: str) -> None:
    """Print an error message in red."""
    print(f"{RED}ERROR: {message}{NC}")


def print_warning(message: str) -> None:
    """Print a warning message in yellow."""
    print(f"{YELLOW}{message}{NC}")


def print_info(message: str) -> None:
    """Print an info message in blue."""
    print(f"{BLUE}{message}{NC}")


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


def install_server(repo_root: Path) -> bool:
    """Install server Python dependencies using uv."""
    print_info("Installing server dependencies...")
    server_dir = repo_root / "server"
    result = subprocess.run(
        ["uv", "sync", "--extra", "dev"],
        cwd=server_dir,
    )
    if result.returncode != 0:
        print_error("Failed to install server dependencies")
        return False
    print_success("Server dependencies installed")
    return True


def install_studio(repo_root: Path) -> bool:
    """Install studio Node.js dependencies."""
    print_info("Installing studio dependencies...")
    studio_dir = repo_root / "studio"
    result = subprocess.run(["npm", "install"], cwd=studio_dir)
    if result.returncode != 0:
        print_error("Failed to install studio dependencies")
        return False
    print_success("Studio dependencies installed")
    return True


def install_hub_backend(repo_root: Path) -> bool:
    """Install hub backend Python dependencies."""
    print_info("Installing hub backend dependencies...")
    hub_dir = repo_root / "hub"
    result = subprocess.run(
        ["uv", "sync", "--extra", "dev"],
        cwd=hub_dir / "backend",
    )
    if result.returncode != 0:
        print_error("Failed to install hub backend dependencies")
        return False
    print_success("Hub backend dependencies installed")
    return True


def install_hub_frontend(repo_root: Path) -> bool:
    """Install hub frontend Node.js dependencies."""
    print_info("Installing hub frontend dependencies...")
    hub_dir = repo_root / "hub"
    result = subprocess.run(["npm", "install"], cwd=hub_dir / "frontend")
    if result.returncode != 0:
        print_error("Failed to install hub frontend dependencies")
        return False
    print_success("Hub frontend dependencies installed")
    return True


def install_hub(repo_root: Path) -> bool:
    """Install hub backend and frontend dependencies."""
    backend_ok = install_hub_backend(repo_root)
    frontend_ok = install_hub_frontend(repo_root)
    return backend_ok and frontend_ok


def install_docs(repo_root: Path) -> bool:
    """Install docs Node.js dependencies."""
    print_info("Installing docs dependencies...")
    docs_dir = repo_root / "docs"
    result = subprocess.run(["npm", "install"], cwd=docs_dir)
    if result.returncode != 0:
        print_error("Failed to install docs dependencies")
        return False
    print_success("Docs dependencies installed")
    return True


def get_venv_python(venv_path: Path) -> Path:
    """Return the platform-appropriate Python executable inside a venv."""
    if sys.platform == "win32":
        return venv_path / "Scripts" / "python.exe"
    return venv_path / "bin" / "python"


def venv_needs_sync(project_dir: Path) -> bool:
    """Check whether a uv-managed venv needs to be created or updated.

    Returns True when:
      - .venv or uv.lock does not exist (first run / fresh clone)
      - pyproject.toml is newer than the venv directory (deps changed)
      - The venv Python binary is missing or not runnable (e.g. venv was
        created inside a dev container but we are now on the host, or
        vice-versa)
    """
    venv_path = project_dir / ".venv"
    lock_path = project_dir / "uv.lock"
    pyproject_path = project_dir / "pyproject.toml"

    if not venv_path.exists() or not lock_path.exists():
        return True

    # Verify the Python binary inside the venv is actually executable in
    # the current environment.  A venv created in a dev container will
    # have symlinks / paths that don't resolve on the host (and vice-versa).
    python_path = get_venv_python(venv_path)
    if not python_path.exists():
        return True
    try:
        result = subprocess.run(
            [str(python_path), "-c", "import sys"],
            capture_output=True,
            timeout=5,
        )
        if result.returncode != 0:
            return True
    except (OSError, subprocess.TimeoutExpired):
        return True

    # If pyproject.toml or uv.lock was modified after the venv was last
    # touched, dependencies likely changed (e.g. branch switch).
    try:
        venv_mtime = venv_path.stat().st_mtime
        if pyproject_path.exists() and pyproject_path.stat().st_mtime > venv_mtime:
            return True
        if lock_path.stat().st_mtime > venv_mtime:
            return True
    except OSError:
        return True

    return False


def sync_venv(project_dir: Path, label: str) -> bool:
    """Run `uv sync --extra dev` for a project and touch .venv on success."""
    print_info(f"Syncing {label} virtual environment...")
    result = subprocess.run(
        ["uv", "sync", "--extra", "dev"],
        cwd=project_dir,
    )
    if result.returncode != 0:
        print_error(f"Failed to sync {label} dependencies")
        return False
    # Touch the venv so the mtime check passes next time
    try:
        (project_dir / ".venv").touch()
    except OSError:
        pass
    print_success(f"{label} environment is up to date")
    return True


def check_server_setup(repo_root: Path) -> bool:
    """Check if server venv is set up and current. Auto-syncs if needed."""
    server_dir = repo_root / "server"
    if venv_needs_sync(server_dir):
        venv_path = server_dir / ".venv"
        if not venv_path.exists():
            print_warning("Server virtual environment not found, creating...")
        elif not get_venv_python(venv_path).exists():
            print_warning("Server venv was built for a different environment, recreating...")
        else:
            print_warning("Server dependencies may have changed, syncing...")
        if not sync_venv(server_dir, "Server"):
            return False
    return True


def check_studio_setup(repo_root: Path) -> bool:
    """Check if studio node_modules exists. Auto-installs if missing."""
    node_modules = repo_root / "studio" / "node_modules"
    if not node_modules.exists():
        print_warning("Studio dependencies not found, installing...")
        if not install_studio(repo_root):
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


def wait_for_hub_healthy(timeout: int = 45) -> bool:
    """Wait for Hub backend to be healthy.

    Returns:
        True if Hub is healthy, False if timeout.
    """
    import urllib.error
    import urllib.request

    print("  Waiting for Hub API to be ready...")
    start_time = time.time()
    last_error = None

    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request("http://localhost:25802/api/v1/health")
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    print_success("  Hub API is ready!")
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            last_error = e
        time.sleep(0.5)

    if last_error:
        print_warning(f"  Hub API not responding after {timeout}s: {last_error}")
    else:
        print_warning(f"  Hub API not responding after {timeout}s")
    print_warning("  Server will automatically retry Hub registration")
    return False


def run_hub_migrations(repo_root: Path) -> bool:
    """Run database migrations for the Hub backend.

    Returns:
        True if migrations succeeded, False otherwise.
    """
    hub_backend_dir = repo_root / "hub" / "backend"
    venv_python = get_venv_python(hub_backend_dir / ".venv")

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
    hub_backend_dir = hub_dir / "backend"
    if venv_needs_sync(hub_backend_dir):
        venv_path = hub_backend_dir / ".venv"
        if not venv_path.exists():
            print_warning("Hub backend virtual environment not found, creating...")
        elif not get_venv_python(venv_path).exists():
            print_warning("Hub backend venv was built for a different environment, recreating...")
        else:
            print_warning("Hub backend dependencies may have changed, syncing...")
        if not sync_venv(hub_backend_dir, "Hub backend"):
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
        print_warning("Hub frontend dependencies not found, installing...")
        if not install_hub_frontend(repo_root):
            frontend_ready = False

    return backend_ready, frontend_ready


def check_docs_setup(repo_root: Path) -> bool:
    """Check if docs node_modules exists. Auto-installs if missing."""
    node_modules = repo_root / "docs" / "node_modules"
    if not node_modules.exists():
        print_warning("Docs dependencies not found, installing...")
        if not install_docs(repo_root):
            return False
    return True


def get_python_executable(repo_root: Path) -> Path:
    """Get the Python executable path from the server virtual environment."""
    return get_venv_python(repo_root / "server" / ".venv")


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
        # Registration secret - sourced from Hub's .env so they always match
        hub_env = read_dotenv(repo_root / "hub" / "backend" / ".env")
        reg_secret = hub_env.get("SERVER_REGISTRATION_SECRET", "")
        if reg_secret:
            env["HUB_REGISTRATION_SECRET"] = reg_secret
        else:
            print_warning("  No SERVER_REGISTRATION_SECRET in hub/backend/.env")
            print_warning("  Server may fail to register with Hub")
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


def start_studio(repo_root: Path, mode: str = "web") -> subprocess.Popen | None:
    """Start Studio in the specified mode.

    Args:
        repo_root: Repository root path.
        mode: One of "web", "electron", or "tauri"
    """
    global studio_process

    print_success(f"Starting Studio ({mode} mode)...")

    studio_dir = repo_root / "studio"
    npm_cmd = get_npm_command()

    # Set environment
    env = os.environ.copy()

    if mode == "web":
        # Web mode - disable Electron
        env["NO_ELECTRON"] = "1"
        cmd = [npm_cmd, "run", "dev"]
    elif mode == "electron":
        # Electron mode - let vite-plugin-electron handle it
        env["NO_ELECTRON"] = "0"
        cmd = [npm_cmd, "run", "dev:electron"]
    else:
        # Should not reach here for Tauri - handled by start_tauri()
        print_error(f"Unknown studio mode: {mode}")
        return None

    try:
        studio_process = subprocess.Popen(
            cmd,
            cwd=studio_dir,
            env=env,
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


def start_tauri(repo_root: Path) -> subprocess.Popen | None:
    """Start Studio as Tauri desktop app."""
    global tauri_process

    # Check for display in headless environments
    if not is_display_available():
        print_warning("No display available (headless environment)")
        print_warning("Skipping Tauri - use Studio web UI at http://localhost:25810")
        return None

    print_success("Starting Tauri...")

    studio_dir = repo_root / "studio"
    npm_cmd = get_npm_command()

    try:
        tauri_process = subprocess.Popen(
            [npm_cmd, "run", "dev:tauri"],
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
            args=(tauri_process, "TAURI"),
            daemon=True
        )
        thread.start()

        return tauri_process
    except Exception as e:
        print_error(f"Failed to start Tauri: {e}")
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
    python_path = get_venv_python(hub_backend_dir / ".venv")

    cmd = [
        str(python_path),
        "-m", "uvicorn",
        "app.main:app",
        "--reload",
        "--host", "0.0.0.0",
        "--port", "25802"
    ]

    # Set environment variables for Hub
    # Secrets (CONNECTION_ENCRYPTION_KEY, SERVER_REGISTRATION_SECRET, etc.)
    # are read from hub/backend/.env by pydantic-settings - don't override here.
    env = os.environ.copy()

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
    terminate_process(tauri_process, "Tauri")
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


def print_status(
    run_server: bool,
    run_studio: bool,
    studio_mode: str = "web",
    run_hub: bool = False,
    run_docs: bool = False
) -> None:
    """Print status information after services start.

    Args:
        run_server: Whether server is running.
        run_studio: Whether studio is running.
        studio_mode: One of "web", "electron", or "tauri".
        run_hub: Whether hub is running.
        run_docs: Whether docs server is running.
    """
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
    print(f"{BLUE}========================================{NC}")
    if run_studio and studio_mode == "electron":
        print_success("Electron desktop mode enabled")
    elif run_studio and studio_mode == "tauri":
        print_success("Tauri desktop mode enabled")
    print()
    print_warning("Press Ctrl+C to stop all services")
    print()


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Sigilweaver Loom Development Launcher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    ./scripts/dev.py                    # Start Studio in web mode only
    ./scripts/dev.py --all              # Start all core components (Server, Studio web, Hub)
    ./scripts/dev.py --server           # Server only
    ./scripts/dev.py --studio           # Studio (web mode) only
    ./scripts/dev.py --studio-electron  # Studio as Electron desktop app
    ./scripts/dev.py --studio-tauri     # Studio as Tauri desktop app
    ./scripts/dev.py --hub              # Hub only (backend + frontend)
    ./scripts/dev.py --docs             # Docs only (Docusaurus)
    ./scripts/dev.py --studio --server  # Multiple components
    ./scripts/dev.py --hub-auth         # All components with Hub authentication enabled
        """
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Start all core components (Server, Studio web, Hub)"
    )
    parser.add_argument(
        "--server",
        action="store_true",
        help="Start server"
    )
    parser.add_argument(
        "--studio",
        action="store_true",
        help="Start Studio in web mode"
    )
    parser.add_argument(
        "--studio-electron",
        action="store_true",
        help="Start Studio as Electron desktop app"
    )
    parser.add_argument(
        "--studio-tauri",
        action="store_true",
        help="Start Studio as Tauri desktop app"
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
        "--install",
        action="store_true",
        help="Force reinstall dependencies for selected components (then exit)"
    )

    args = parser.parse_args()

    # Determine studio mode
    # Priority: tauri > electron > web (if multiple specified, use highest priority)
    studio_mode = "web"
    if args.studio_tauri:
        studio_mode = "tauri"
    elif args.studio_electron:
        studio_mode = "electron"

    # Determine what to run
    # If --all flag is set, run core components
    if args.all:
        run_server = True
        run_studio = True
        run_hub = True
        run_docs = False
    # If any specific services requested, only run those
    elif (
        args.server or args.studio or args.studio_electron
        or args.studio_tauri or args.hub or args.docs
    ):
        run_server = args.server
        run_studio = args.studio or args.studio_electron or args.studio_tauri
        run_hub = args.hub
        run_docs = args.docs
    # Default: run all core components (server, studio, hub)
    else:
        run_server = True
        run_studio = True
        run_hub = True
        run_docs = False

    # If Hub is running, enable hub auth mode for the server automatically
    # This ensures Hub connections work without requiring --hub-auth flag
    hub_auth = args.hub_auth or run_hub

    # Get repo root
    repo_root = get_repo_root()

    # Handle --install mode: install dependencies and exit
    if args.install:
        print_banner()
        print_info("Installing dependencies...")
        success = True

        if run_server:
            success = install_server(repo_root) and success
        if run_studio:
            success = install_studio(repo_root) and success
        if run_hub:
            success = install_hub(repo_root) and success
        if run_docs:
            success = install_docs(repo_root) and success

        if success:
            print_success("All dependencies installed!")
        else:
            print_error("Some dependencies failed to install")
        return 0 if success else 1

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
        # Server will auto-retry registration if Hub isn't ready yet
        wait_for_hub_healthy(timeout=45)

    if run_server:
        if start_server(repo_root, hub_auth=hub_auth) is None:
            return 1
        # Give server a moment to start
        time.sleep(2)

    if run_studio:
        if studio_mode == "tauri":
            # Tauri mode - start web server then tauri
            if start_studio(repo_root, mode="web") is None:
                return 1
            time.sleep(3)
            if start_tauri(repo_root) is None:
                # Tauri failed (e.g. no display), but web server is running
                print_warning("Tauri failed to start, but web UI is available")
        elif studio_mode == "electron":
            # Electron mode - vite-plugin-electron handles Electron
            if start_studio(repo_root, mode="electron") is None:
                return 1
            time.sleep(3)
        else:
            # Web mode only
            if start_studio(repo_root, mode="web") is None:
                return 1
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

    # Print status
    print_status(run_server, run_studio, studio_mode, run_hub, run_docs)

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
            if studio_mode == "tauri" and tauri_process and tauri_process.poll() is not None:
                print_warning("Tauri process exited - web UI still available")
                # Don't break, web server is still running

            time.sleep(1)
    except KeyboardInterrupt:
        pass

    cleanup()
    return 0


if __name__ == "__main__":
    sys.exit(main())
