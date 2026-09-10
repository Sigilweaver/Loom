#!/usr/bin/env python3
"""
Full verification suite for Sigilweaver Loom.

Runs all checks to ensure CI will pass:
1. Server: Lint (ruff) + Type check (mypy) + Tests (pytest) + Coverage
2. Studio: Type check (tsc) + Lint (eslint) + Tests (vitest) + Coverage
3. Hub: Backend (ruff + mypy + pytest) + Frontend (tsc + eslint + vitest)
4. Docs: Build check (validates broken links)
5. Integration tests (requires server running)

Usage:
    ./scripts/test.py                   # Smart mode: only test changed components
    ./scripts/test.py --full            # Run ALL checks (CI mode)
    ./scripts/test.py -v                 # Verbose mode - show all output
    ./scripts/test.py -p                 # Parallel mode - run suites concurrently (faster)
    ./scripts/test.py --server           # Server checks only
    ./scripts/test.py --studio           # Studio checks only
    ./scripts/test.py --hub              # Hub checks only
    ./scripts/test.py --docs             # Docs build check only
    ./scripts/test.py --studio --server  # Multiple components
    ./scripts/test.py --integration      # Integration tests only
    ./scripts/test.py --no-integration   # Skip integration tests
    ./scripts/test.py --no-coverage      # Skip coverage reports (faster)
    ./scripts/test.py --strict           # Fail on lint warnings (stricter than CI)

Smart Mode (default):
    By default, only runs tests for components with changed files (git staged + unstaged).
    This gives fast feedback during development. Use --full for complete validation.

Auto-Setup:
    The script automatically sets up missing dependencies:
    - Python venvs: runs 'uv sync --all-extras' if .venv is missing
    - Node modules: runs 'bun install' if node_modules is missing
    No manual setup required - just run the script!

Performance Notes:
    - Smart mode auto-detects changed components for fastest iteration
    - Use -p (--parallel) to run test suites concurrently (requires pytest-xdist)
    - Use --no-coverage for faster iteration during development
    - Parallel mode automatically uses all available CPU cores
"""

import argparse
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path


# ANSI color codes
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'

    @classmethod
    def disable(cls) -> None:
        """Disable colors (for non-TTY output)."""
        cls.RED = cls.GREEN = cls.YELLOW = cls.BLUE = ''
        cls.BOLD = cls.DIM = cls.RESET = ''


# Disable colors if not a TTY
if not sys.stdout.isatty():
    Colors.disable()


# Global mode flags
_quiet_mode = False
_ci_mode = False  # CI mode: XML coverage, stricter output


@dataclass
class CheckResult:
    """Result of a single check (lint, typecheck, test, etc.)."""
    name: str
    passed: bool
    duration: float
    error: str | None = None
    warnings: int = 0


@dataclass
class SuiteResult:
    """Result of a test suite (server, studio, integration)."""
    name: str
    checks: list[CheckResult] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks)

    @property
    def duration(self) -> float:
        return sum(c.duration for c in self.checks)

    @property
    def error(self) -> str | None:
        errors = [c.error for c in self.checks if c.error]
        return "; ".join(errors) if errors else None


def get_repo_root() -> Path:
    """Find the repository root directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent


@dataclass
class ChangedComponents:
    """Tracks which components have changed files."""
    server: bool = False
    studio: bool = False
    hub_backend: bool = False
    hub_frontend: bool = False
    docs: bool = False
    scripts: bool = False
    workflows: bool = False  # .github/workflows

    @property
    def hub(self) -> bool:
        """True if any hub component changed."""
        return self.hub_backend or self.hub_frontend

    @property
    def any_changed(self) -> bool:
        """True if any component has changes."""
        return any([
            self.server, self.studio, self.hub_backend, self.hub_frontend,
            self.docs, self.scripts, self.workflows
        ])

    def summary(self) -> str:
        """Human-readable summary of changed components."""
        changed = []
        if self.server:
            changed.append("Server")
        if self.studio:
            changed.append("Studio")
        if self.hub_backend:
            changed.append("Hub Backend")
        if self.hub_frontend:
            changed.append("Hub Frontend")
        if self.docs:
            changed.append("Docs")
        if self.scripts:
            changed.append("Scripts")
        if self.workflows:
            changed.append("CI Workflows")
        return ", ".join(changed) if changed else "None"


def get_changed_files(repo_root: Path) -> list[str]:
    """Get list of changed files from git (staged + unstaged + untracked)."""
    try:
        # Get staged changes
        staged = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            cwd=repo_root,
            capture_output=True,
            text=True,
        )
        # Get unstaged changes
        unstaged = subprocess.run(
            ["git", "diff", "--name-only"],
            cwd=repo_root,
            capture_output=True,
            text=True,
        )
        # Get untracked files (new files not yet added)
        untracked = subprocess.run(
            ["git", "ls-files", "--others", "--exclude-standard"],
            cwd=repo_root,
            capture_output=True,
            text=True,
        )

        # Combine all changed files
        all_files = set()
        for result in [staged, unstaged, untracked]:
            if result.returncode == 0:
                all_files.update(f.strip() for f in result.stdout.strip().split("\n") if f.strip())

        return list(all_files)
    except Exception:
        # If git fails, return empty (will trigger full run)
        return []


def detect_changed_components(repo_root: Path) -> ChangedComponents:
    """Detect which components have changed files based on git status."""
    changed_files = get_changed_files(repo_root)
    components = ChangedComponents()

    for file_path in changed_files:
        # Normalize path
        path = file_path.lower()

        # Map file paths to components
        if path.startswith("server/"):
            components.server = True
        elif path.startswith("studio/"):
            components.studio = True
        elif path.startswith("hub/backend/"):
            components.hub_backend = True
        elif path.startswith("hub/frontend/"):
            components.hub_frontend = True
        elif path.startswith("hub/"):
            # Other hub files (docker-compose, etc.) - test both
            components.hub_backend = True
            components.hub_frontend = True
        elif path.startswith("docs/"):
            components.docs = True
        elif path.startswith("scripts/"):
            components.scripts = True
        elif path.startswith(".github/"):
            components.workflows = True
        # Root config files - be conservative, test related components
        elif path in ["pyproject.toml", "uv.lock"]:
            components.server = True
        elif path in ["package.json", "package-lock.json", "bun.lock", "tsconfig.json"]:
            components.studio = True

    return components


def print_header(title: str, force: bool = False) -> None:
    """Print a section header."""
    if _quiet_mode and not force:
        return
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_subheader(title: str) -> None:
    """Print a subsection header."""
    if _quiet_mode:
        return
    print()
    print(f"--- {title} ---")


def print_separator() -> None:
    """Print a separator line."""
    print("-" * 60)


def get_python_path(server_dir: Path) -> Path | None:
    """Get the Python executable path from the server venv (managed by uv)."""
    lock_path = server_dir / "uv.lock"
    venv_path = server_dir / ".venv"
    if not lock_path.exists() or not venv_path.exists():
        return None

    if sys.platform == "win32":
        return venv_path / "Scripts" / "python.exe"
    return venv_path / "bin" / "python"


def ensure_python_venv(project_dir: Path, name: str) -> bool:
    """
    Ensure a Python venv exists for a project, creating it if needed.

    Args:
        project_dir: Directory containing pyproject.toml/uv.lock
        name: Human-readable name for logging (e.g., 'Server', 'Hub Backend')

    Returns:
        True if venv is ready, False if setup failed
    """
    venv_path = project_dir / ".venv"
    lock_path = project_dir / "uv.lock"

    # Check if venv exists and has a working Python
    if venv_path.exists() and lock_path.exists():
        # Verify the Python binary actually works
        if sys.platform == "win32":
            python_path = venv_path / "Scripts" / "python.exe"
        else:
            python_path = venv_path / "bin" / "python"

        if python_path.exists():
            # Try to run Python to make sure it's not a broken symlink
            try:
                result = subprocess.run(
                    [str(python_path), "--version"],
                    capture_output=True,
                    timeout=10,
                )
                if result.returncode == 0:
                    return True
            except Exception:
                pass

        # Venv exists but is broken - remove it and recreate
        if not _quiet_mode:
            print(
                f"  {Colors.YELLOW}Repairing{Colors.RESET}: "
                f"{name} venv (broken or incomplete)..."
            )
        import shutil
        try:
            shutil.rmtree(venv_path)
        except Exception:
            pass

    # Auto-setup: run uv sync
    if not _quiet_mode:
        print(f"  {Colors.YELLOW}Setting up{Colors.RESET}: {name} venv (uv sync)...")

    try:
        result = subprocess.run(
            ["uv", "sync", "--all-extras"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout for initial setup
        )
        if result.returncode != 0:
            if not _quiet_mode:
                print(f"  {Colors.RED}Failed{Colors.RESET}: uv sync failed for {name}")
                if result.stderr:
                    print(f"    {result.stderr[:500]}")
            return False

        if not _quiet_mode:
            print(f"  {Colors.GREEN}Ready{Colors.RESET}: {name} venv created")
        return True
    except FileNotFoundError:
        if not _quiet_mode:
            print(
                f"  {Colors.RED}Error{Colors.RESET}: 'uv' not found. Install with: "
                "curl -LsSf https://astral.sh/uv/install.sh | sh"
            )
        return False
    except subprocess.TimeoutExpired:
        if not _quiet_mode:
            print(f"  {Colors.RED}Timeout{Colors.RESET}: uv sync timed out for {name}")
        return False
    except Exception as e:
        if not _quiet_mode:
            print(f"  {Colors.RED}Error{Colors.RESET}: Failed to setup {name}: {e}")
        return False


def ensure_node_modules(project_dir: Path, name: str) -> bool:
    """
    Ensure node_modules exists for a project, installing if needed.

    Args:
        project_dir: Directory containing package.json
        name: Human-readable name for logging (e.g., 'Studio', 'Hub Frontend')

    Returns:
        True if node_modules is ready, False if setup failed
    """
    node_modules = project_dir / "node_modules"
    package_json = project_dir / "package.json"

    if node_modules.exists():
        return True

    if not package_json.exists():
        if not _quiet_mode:
            print(f"  {Colors.RED}Error{Colors.RESET}: No package.json in {project_dir}")
        return False

    # Auto-setup: run bun install (frozen lockfile when bun.lock exists)
    lock_file = project_dir / "bun.lock"
    cmd = ["bun", "install", "--frozen-lockfile"] if lock_file.exists() else ["bun", "install"]

    if not _quiet_mode:
        print(
            f"  {Colors.YELLOW}Setting up{Colors.RESET}: "
            f"{name} dependencies ({' '.join(cmd)})..."
        )

    try:
        result = subprocess.run(
            cmd,
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )
        if result.returncode != 0:
            if not _quiet_mode:
                print(f"  {Colors.RED}Failed{Colors.RESET}: bun install failed for {name}")
                if result.stderr:
                    print(f"    {result.stderr[:500]}")
            return False

        if not _quiet_mode:
            print(f"  {Colors.GREEN}Ready{Colors.RESET}: {name} dependencies installed")
        return True
    except FileNotFoundError:
        if not _quiet_mode:
            print(f"  {Colors.RED}Error{Colors.RESET}: 'bun' not found. Install bun first (https://bun.sh).")
        return False
    except subprocess.TimeoutExpired:
        if not _quiet_mode:
            print(f"  {Colors.RED}Timeout{Colors.RESET}: bun install timed out for {name}")
        return False
    except Exception as e:
        if not _quiet_mode:
            print(f"  {Colors.RED}Error{Colors.RESET}: Failed to setup {name}: {e}")
        return False


def run_command(
    cmd: list[str],
    cwd: Path,
    name: str,
    fail_on_error: bool = True
) -> CheckResult:
    """Run a command and return a CheckResult."""
    start_time = time.time()

    try:
        if _quiet_mode:
            # Capture output and only show on failure
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
            )
            duration = time.time() - start_time
            passed = result.returncode == 0 if fail_on_error else True

            # Show output only on failure
            if not passed:
                print(f"\n{Colors.RED}{Colors.BOLD}=== {name} FAILED ==={Colors.RESET}")
                if result.stdout:
                    print(result.stdout)
                if result.stderr:
                    print(result.stderr, file=sys.stderr)
        else:
            # Normal mode: stream output
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=False,
            )
            duration = time.time() - start_time
            passed = result.returncode == 0 if fail_on_error else True

        return CheckResult(
            name=name,
            passed=passed,
            duration=duration,
            warnings=0 if result.returncode == 0 else 1,
        )
    except Exception as e:
        return CheckResult(
            name=name,
            passed=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def run_server_lint(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run ruff linter on server code."""
    print_subheader("Server Lint (ruff)")

    server_dir = repo_root / "server"
    python_path = get_python_path(server_dir)

    if python_path is None:
        return CheckResult(
            name="Server Lint",
            passed=False,
            duration=0,
            error="Virtual environment not found"
        )

    # The server declares a zero-ignore ruff policy (pyproject: ignore = [])
    # and the baseline is clean, so lint is enforced unconditionally: any
    # finding fails the build, in CI and locally. `strict` no longer downgrades
    # this (it only ever added extra checks).
    cmd = [str(python_path), "-m", "ruff", "check", "app/", "tests/"]
    return run_command(cmd, server_dir, "Server Lint", fail_on_error=True)


def run_server_typecheck(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run mypy type checker on server code."""
    print_subheader("Server Type Check (mypy)")

    server_dir = repo_root / "server"
    python_path = get_python_path(server_dir)

    if python_path is None:
        return CheckResult(
            name="Server Types",
            passed=False,
            duration=0,
            error="Virtual environment not found"
        )

    cmd = [str(python_path), "-m", "mypy", "app/"]

    # mypy runs in strict mode (pyproject) and the baseline is clean, so type
    # errors fail the build unconditionally, in CI and locally.
    return run_command(cmd, server_dir, "Server Types", fail_on_error=True)


def run_server_tests(
    repo_root: Path, coverage: bool = False, parallel: bool = False
) -> CheckResult:
    """Run server pytest tests."""
    print_subheader("Server Tests (pytest)")

    server_dir = repo_root / "server"
    python_path = get_python_path(server_dir)

    if python_path is None:
        return CheckResult(
            name="Server Tests",
            passed=False,
            duration=0,
            error="Server not set up with uv. Run: cd server && uv sync --all-extras"
        )

    cmd = [str(python_path), "-m", "pytest", "tests/", "-v", "--tb=short"]

    # Use pytest-xdist for parallel test execution if available and enabled
    if parallel:
        cmd.extend(["-n", "auto"])

    if coverage:
        cmd.extend(["--cov=app", "--cov-report=term"])
        if _ci_mode:
            # CI mode: generate XML for coverage upload
            cmd.extend(["--cov-report=xml"])
        else:
            cmd.extend(["--cov-report=html"])

    result = run_command(cmd, server_dir, "Server Tests", fail_on_error=True)

    if coverage and result.passed and not _quiet_mode and not _ci_mode:
        print()
        print(f"Coverage report: {server_dir}/htmlcov/index.html")

    return result


def run_server_suite(
    repo_root: Path, coverage: bool = False, strict: bool = False, parallel: bool = False
) -> SuiteResult:
    """Run all server checks."""
    print_header("Server Verification")

    server_dir = repo_root / "server"

    suite = SuiteResult(name="Server")

    # Auto-setup venv if needed
    if not ensure_python_venv(server_dir, "Server"):
        suite.checks.append(CheckResult(
            name="Server Setup",
            passed=False,
            duration=0,
            error="Failed to setup Server venv. Check uv is installed."
        ))
        return suite

    # Run lint, typecheck, and tests
    suite.checks.append(run_server_lint(repo_root, strict=strict))
    suite.checks.append(run_server_typecheck(repo_root, strict=strict))
    suite.checks.append(run_server_tests(repo_root, coverage=coverage, parallel=parallel))

    return suite


def run_studio_typecheck(repo_root: Path) -> CheckResult:
    """Run TypeScript type checker."""
    print_subheader("Studio Type Check (tsc)")

    studio_dir = repo_root / "studio"

    return run_command(
        ["bun", "run", "type-check"],
        studio_dir,
        "Studio Types",
        fail_on_error=True
    )


def run_studio_lint(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run ESLint on studio code."""
    print_subheader("Studio Lint (eslint)")

    studio_dir = repo_root / "studio"

    # eslint runs again (#119) and the baseline is clean, so lint is enforced
    # unconditionally: any finding fails the build, in CI and locally. This
    # previously used fail_on_error=strict, which meant eslint crashing on
    # startup was reported as a passing check with a warning.
    return run_command(
        ["bun", "run", "lint"],
        studio_dir,
        "Studio Lint",
        fail_on_error=True
    )


def run_studio_tests(repo_root: Path, coverage: bool = False) -> CheckResult:
    """Run studio vitest tests."""
    print_subheader("Studio Tests (vitest)")

    studio_dir = repo_root / "studio"

    cmd = ["bun", "run", "test:coverage" if coverage else "test:unit"]

    result = run_command(cmd, studio_dir, "Studio Tests", fail_on_error=True)

    if coverage and result.passed and not _quiet_mode and not _ci_mode:
        print()
        print(f"Coverage report: {studio_dir}/coverage/index.html")

    return result


def run_studio_suite(repo_root: Path, coverage: bool = False, strict: bool = False) -> SuiteResult:
    """Run all studio checks."""
    print_header("Studio Verification")

    studio_dir = repo_root / "studio"

    suite = SuiteResult(name="Studio")

    # Auto-setup node_modules if needed
    if not ensure_node_modules(studio_dir, "Studio"):
        suite.checks.append(CheckResult(
            name="Studio Setup",
            passed=False,
            duration=0,
            error="Failed to setup Studio dependencies. Check bun is installed."
        ))
        return suite

    # Run typecheck, lint, and tests
    suite.checks.append(run_studio_typecheck(repo_root))
    suite.checks.append(run_studio_lint(repo_root, strict=strict))
    suite.checks.append(run_studio_tests(repo_root, coverage=coverage))

    return suite


# --- Hub checks ---


def run_hub_backend_lint(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run ruff linter on hub backend code."""
    print_subheader("Hub Backend Lint (ruff)")

    hub_backend_dir = repo_root / "hub" / "backend"
    python_path = get_python_path(hub_backend_dir)

    if python_path is None:
        return CheckResult(
            name="Hub Backend Lint",
            passed=False,
            duration=0,
            error="Virtual environment not found"
        )

    cmd = [str(python_path), "-m", "ruff", "check", "app/", "tests/"]
    if not strict:
        cmd.append("--exit-zero")

    return run_command(cmd, hub_backend_dir, "Hub Backend Lint", fail_on_error=strict)


def run_hub_backend_typecheck(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run mypy type checker on hub backend code."""
    print_subheader("Hub Backend Type Check (mypy)")

    hub_backend_dir = repo_root / "hub" / "backend"
    python_path = get_python_path(hub_backend_dir)

    if python_path is None:
        return CheckResult(
            name="Hub Backend Types",
            passed=False,
            duration=0,
            error="Virtual environment not found"
        )

    cmd = [str(python_path), "-m", "mypy", "app/"]

    return run_command(cmd, hub_backend_dir, "Hub Backend Types", fail_on_error=strict)


def run_hub_backend_tests(
    repo_root: Path, coverage: bool = False, parallel: bool = False
) -> CheckResult:
    """Run hub backend pytest tests.

    Note: parallel flag is intentionally ignored for Hub backend tests.
    The database fixtures use shared state and table truncation between tests,
    which is incompatible with pytest-xdist parallel execution.
    """
    print_subheader("Hub Backend Tests (pytest)")

    hub_backend_dir = repo_root / "hub" / "backend"
    python_path = get_python_path(hub_backend_dir)

    if python_path is None:
        return CheckResult(
            name="Hub Backend Tests",
            passed=False,
            duration=0,
            error="Hub backend not set up with uv. Run: cd hub/backend && uv sync --all-extras"
        )

    # Note: NOT using -n auto for parallel execution because Hub backend tests
    # have complex database fixtures that share state between tests
    cmd = [str(python_path), "-m", "pytest", "tests/", "-v", "--tb=short"]

    if coverage:
        cmd.extend(["--cov=app", "--cov-report=term"])
        if _ci_mode:
            cmd.extend(["--cov-report=xml"])
        else:
            cmd.extend(["--cov-report=html"])

    result = run_command(cmd, hub_backend_dir, "Hub Backend Tests", fail_on_error=True)

    if coverage and result.passed and not _quiet_mode and not _ci_mode:
        print()
        print(f"Coverage report: {hub_backend_dir}/htmlcov/index.html")

    return result


def run_hub_frontend_typecheck(repo_root: Path) -> CheckResult:
    """Run TypeScript type checker on hub frontend."""
    print_subheader("Hub Frontend Type Check (tsc)")

    hub_frontend_dir = repo_root / "hub" / "frontend"

    return run_command(
        ["bun", "run", "type-check"],
        hub_frontend_dir,
        "Hub Frontend Types",
        fail_on_error=True
    )


def run_hub_frontend_lint(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run ESLint on hub frontend code."""
    print_subheader("Hub Frontend Lint (eslint)")

    hub_frontend_dir = repo_root / "hub" / "frontend"

    # Enforced unconditionally - see run_studio_lint.
    return run_command(
        ["bun", "run", "lint"],
        hub_frontend_dir,
        "Hub Frontend Lint",
        fail_on_error=True
    )


def run_hub_frontend_tests(repo_root: Path, coverage: bool = False) -> CheckResult:
    """Run hub frontend vitest tests."""
    print_subheader("Hub Frontend Tests (vitest)")

    hub_frontend_dir = repo_root / "hub" / "frontend"

    cmd = ["bun", "run", "test:coverage" if coverage else "test"]

    result = run_command(cmd, hub_frontend_dir, "Hub Frontend Tests", fail_on_error=True)

    if coverage and result.passed and not _quiet_mode and not _ci_mode:
        print()
        print(f"Coverage report: {hub_frontend_dir}/coverage/index.html")

    return result


def run_hub_suite(
    repo_root: Path, coverage: bool = False, strict: bool = False, parallel: bool = False
) -> SuiteResult:
    """Run all hub checks (backend + frontend).

    Every check runs in CI as well as locally. The backend pytest suite needs
    Postgres reachable on localhost:25801; nothing else has to be provisioned,
    because tests/conftest.py sets its own required secrets and creates its own
    throwaway database.
    """
    print_header("Hub Verification")

    hub_dir = repo_root / "hub"
    hub_backend_dir = hub_dir / "backend"
    hub_frontend_dir = hub_dir / "frontend"

    suite = SuiteResult(name="Hub")

    # Auto-setup backend venv if needed
    if not ensure_python_venv(hub_backend_dir, "Hub Backend"):
        suite.checks.append(CheckResult(
            name="Hub Backend Setup",
            passed=False,
            duration=0,
            error="Failed to setup Hub Backend venv. Check uv is installed."
        ))
    else:
        # Run backend checks
        suite.checks.append(run_hub_backend_lint(repo_root, strict=strict))
        suite.checks.append(run_hub_backend_typecheck(repo_root, strict=strict))

        # Hub backend tests run everywhere, including CI. They need Postgres on
        # localhost:25801 (see hub/docker-compose.yml locally, and the postgres
        # service container in .github/workflows/ci.yml); conftest.py supplies
        # its own secrets and creates its own throwaway test database.
        suite.checks.append(run_hub_backend_tests(repo_root, coverage=coverage, parallel=parallel))

    # Auto-setup frontend node_modules if needed
    if not ensure_node_modules(hub_frontend_dir, "Hub Frontend"):
        suite.checks.append(CheckResult(
            name="Hub Frontend Setup",
            passed=False,
            duration=0,
            error="Failed to setup Hub Frontend dependencies. Check bun is installed."
        ))
    else:
        # Run frontend checks
        suite.checks.append(run_hub_frontend_typecheck(repo_root))
        suite.checks.append(run_hub_frontend_lint(repo_root, strict=strict))
        suite.checks.append(run_hub_frontend_tests(repo_root, coverage=coverage))

    return suite


# --- Docs checks ---


def run_docs_build(repo_root: Path) -> CheckResult:
    """Run docs build check (validates broken links)."""
    print_subheader("Docs Build Check")

    docs_dir = repo_root / "docs"

    return run_command(
        ["bun", "run", "build"],
        docs_dir,
        "Docs Build",
        fail_on_error=True
    )


def run_docs_suite(repo_root: Path) -> SuiteResult:
    """Run docs verification (build check validates links)."""
    print_header("Docs Verification")

    docs_dir = repo_root / "docs"

    suite = SuiteResult(name="Docs")

    # Auto-setup node_modules if needed
    if not ensure_node_modules(docs_dir, "Docs"):
        suite.checks.append(CheckResult(
            name="Docs Setup",
            passed=False,
            duration=0,
            error="Failed to setup Docs dependencies. Check bun is installed."
        ))
        return suite

    # Build check validates broken links via Docusaurus
    suite.checks.append(run_docs_build(repo_root))

    return suite


# --- Repo tooling checks ---


def run_scripts_lint(repo_root: Path) -> CheckResult:
    """Run ruff over the repo's own build/dev/test tooling in scripts/.

    scripts/ruff.toml mirrors the zero-ignore policy the server and hub
    backends declare, so the tooling that enforces that policy is held to it
    too. Uses the server venv's ruff, which is the same binary the server
    lint check runs.
    """
    print_subheader("Scripts Lint (ruff)")

    python_path = get_python_path(repo_root / "server")

    if python_path is None:
        return CheckResult(
            name="Scripts Lint",
            passed=False,
            duration=0,
            error="Server virtual environment not found (needed for ruff)"
        )

    # The baseline is clean and scripts/ruff.toml sets ignore = [], so this is
    # enforced unconditionally: any finding fails the build, in CI and locally.
    cmd = [str(python_path), "-m", "ruff", "check", "scripts/"]
    return run_command(cmd, repo_root, "Scripts Lint", fail_on_error=True)


def run_repo_suite(repo_root: Path) -> SuiteResult:
    """Run repo-wide tooling checks that belong to no single component."""
    print_header("Repo Verification")

    suite = SuiteResult(name="Repo")

    # Auto-setup the server venv if needed - it supplies the ruff binary.
    if not ensure_python_venv(repo_root / "server", "Server"):
        suite.checks.append(CheckResult(
            name="Repo Setup",
            passed=False,
            duration=0,
            error="Failed to setup Server venv (needed for ruff). Check uv is installed."
        ))
        return suite

    suite.checks.append(run_scripts_lint(repo_root))

    return suite


def check_server_running() -> bool:
    """Check if server is running on test port."""
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:8001/api/health/", timeout=2)
        return True
    except Exception:
        return False


def start_server(repo_root: Path) -> subprocess.Popen | None:
    """Start the server."""
    server_dir = repo_root / "server"

    # Auto-setup venv if needed
    if not ensure_python_venv(server_dir, "Server"):
        return None

    python_path = get_python_path(server_dir)

    if python_path is None:
        return None

    print("Starting server on port 8001 (test server)...")

    # Run the test server with authentication disabled. The integration suite
    # talks to the server without a session token, and the harness health probe
    # hits /api/health/ which is auth-protected by default (AUTH_MODE=ephemeral).
    # AUTH_MODE=disabled keeps the local test server reachable without tokens.
    server_env = {**os.environ, "AUTH_MODE": "disabled"}

    process = subprocess.Popen(
        [
            str(python_path), "-m", "uvicorn", "app.main:app",
            "--host", "127.0.0.1", "--port", "8001",
        ],
        cwd=server_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=server_env,
    )

    # Wait for server to be ready
    for _ in range(30):
        if check_server_running():
            print("Server ready!")
            return process
        time.sleep(1)

    print("ERROR: Server failed to start")
    process.terminate()
    return None


def run_integration_tests(repo_root: Path) -> SuiteResult:
    """Run integration tests."""
    print_header("Integration Tests")

    studio_dir = repo_root / "studio"
    server_dir = repo_root / "server"

    suite = SuiteResult(name="Integration")

    # Auto-setup studio node_modules if needed
    if not ensure_node_modules(studio_dir, "Studio"):
        suite.checks.append(CheckResult(
            name="Integration Setup",
            passed=False,
            duration=0,
            error="Failed to setup Studio dependencies for integration tests."
        ))
        return suite

    # Auto-setup server venv if needed (for starting server)
    if not ensure_python_venv(server_dir, "Server"):
        suite.checks.append(CheckResult(
            name="Integration Setup",
            passed=False,
            duration=0,
            error="Failed to setup Server venv for integration tests."
        ))
        return suite

    # Check if server is running, start if needed
    server_process = None
    if not check_server_running():
        print("Server not detected, starting...")
        server_process = start_server(repo_root)
        if server_process is None:
            suite.checks.append(CheckResult(
                name="Integration Setup",
                passed=False,
                duration=0,
                error="Failed to start server"
            ))
            return suite
    else:
        print("Server already running")

    try:
        result = run_command(
            ["bun", "run", "test:integration"],
            studio_dir,
            "Integration Tests",
            fail_on_error=True
        )
        suite.checks.append(result)
    finally:
        if server_process:
            print("Stopping server...")
            server_process.terminate()
            server_process.wait()

    return suite


def print_summary(
    results: list[SuiteResult],
    strict: bool = False,
    coverage: bool = True,
    is_full_run: bool = True,
    parallel: bool = False,
    smart_mode: bool = False,
) -> None:
    """Print verification summary with colors."""
    print_header("Verification Summary", force=True)

    total_duration = sum(r.duration for r in results)
    all_passed = all(r.passed for r in results)

    for suite in results:
        if suite.passed:
            status = f"{Colors.GREEN}{Colors.BOLD}PASS{Colors.RESET}"
        else:
            status = f"{Colors.RED}{Colors.BOLD}FAIL{Colors.RESET}"
        print(
            f"\n  {Colors.BOLD}{suite.name}{Colors.RESET}: {status} "
            f"{Colors.DIM}({suite.duration:.1f}s){Colors.RESET}"
        )

        for check in suite.checks:
            if check.passed:
                check_status = f"{Colors.GREEN}PASS{Colors.RESET}"
            else:
                check_status = f"{Colors.RED}FAIL{Colors.RESET}"
            warning_note = (
                f" {Colors.YELLOW}({check.warnings} warnings){Colors.RESET}"
                if check.warnings > 0 and check.passed
                else ""
            )
            print(
                f"    - {check.name}: {check_status}{warning_note} "
                f"{Colors.DIM}({check.duration:.1f}s){Colors.RESET}"
            )
            if check.error:
                print(f"      {Colors.RED}Error: {check.error}{Colors.RESET}")

    print_separator()
    print(f"{Colors.DIM}Total time: {total_duration:.1f}s{Colors.RESET}")
    print(f"{Colors.DIM}Mode: {'strict' if strict else 'CI-compatible'}{Colors.RESET}")
    print(f"{Colors.DIM}Coverage: {'enabled' if coverage else 'disabled'}{Colors.RESET}")
    print(f"{Colors.DIM}Parallel: {'enabled' if parallel else 'disabled'}{Colors.RESET}")
    if smart_mode:
        print(f"{Colors.DIM}Smart mode: enabled (use --full for complete validation){Colors.RESET}")
    print()

    if all_passed:
        if is_full_run:
            print(f"{Colors.GREEN}{Colors.BOLD}All checks passed! Ready for PR.{Colors.RESET}")
        elif smart_mode:
            print(
                f"{Colors.GREEN}{Colors.BOLD}All checks passed!{Colors.RESET} "
                "Run with --full before PR."
            )
        else:
            print(f"{Colors.GREEN}{Colors.BOLD}All checks passed!{Colors.RESET}")
    else:
        failed_suites = [r.name for r in results if not r.passed]
        print(f"{Colors.RED}{Colors.BOLD}FAILED: {', '.join(failed_suites)}{Colors.RESET}")
        print()
        print(f"{Colors.YELLOW}Fix the issues above before submitting a PR.{Colors.RESET}")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run full verification suite for Sigilweaver Loom (lint, typecheck, tests)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  ./scripts/test.py                   # Smart mode: only test changed components
  ./scripts/test.py --full            # Run ALL checks (CI mode)
  ./scripts/test.py -v                # Verbose mode - show all output
  ./scripts/test.py -p                # Parallel mode - run suites concurrently (faster)
  ./scripts/test.py --server          # Server only (ruff + mypy + pytest + coverage)
  ./scripts/test.py --studio          # Studio only (tsc + eslint + vitest + coverage)
  ./scripts/test.py --hub             # Hub only (backend + frontend checks)
  ./scripts/test.py --docs            # Docs only (build + link check)
  ./scripts/test.py --studio --server # Multiple components
  ./scripts/test.py --no-coverage     # Skip coverage reports (faster)
  ./scripts/test.py --strict          # Fail on lint/type warnings
"""
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Run full test suite (bypass smart change detection)"
    )
    parser.add_argument(
        "--server",
        action="store_true",
        help="Run server checks (ruff + mypy + pytest)"
    )
    parser.add_argument(
        "--studio",
        action="store_true",
        help="Run studio checks (tsc + eslint + vitest)"
    )
    parser.add_argument(
        "--hub",
        action="store_true",
        help="Run hub checks (backend + frontend)"
    )
    parser.add_argument(
        "--docs",
        action="store_true",
        help="Run docs checks (build + link validation)"
    )
    parser.add_argument(
        "--repo",
        action="store_true",
        help="Run repo tooling checks (ruff over scripts/)"
    )
    parser.add_argument(
        "--integration",
        action="store_true",
        help="Run integration tests only"
    )
    parser.add_argument(
        "--no-integration",
        action="store_true",
        help="Skip integration tests"
    )
    parser.add_argument(
        "--no-coverage",
        action="store_true",
        help="Skip coverage reports (faster)"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on lint/type warnings (stricter than CI)"
    )
    parser.add_argument(
        "-p", "--parallel",
        action="store_true",
        help="Run test suites in parallel (faster, requires quiet mode)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Verbose mode: show all output (default: only show errors)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be tested without actually running tests"
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI mode: XML coverage output, optimized for GitHub Actions"
    )

    args = parser.parse_args()

    repo_root = get_repo_root()

    # Set global mode flags
    global _quiet_mode, _ci_mode
    _quiet_mode = not args.verbose
    _ci_mode = args.ci

    # CI mode implies full mode and coverage
    if args.ci:
        args.full = True

    # Determine which tests to run
    run_server = True
    run_studio = True
    run_hub = True
    run_docs = True
    run_repo = True
    run_integration = True

    # Track if we're using smart mode
    smart_mode = False
    changed_components: ChangedComponents | None = None

    # If any specific tests requested, only run those (explicit override)
    any_specific = (
        args.server or args.studio or args.hub
        or args.docs or args.repo or args.integration
    )

    if any_specific:
        # Explicit component selection - run exactly what was requested
        run_server = args.server
        run_studio = args.studio
        run_hub = args.hub
        run_docs = args.docs
        run_repo = args.repo
        run_integration = args.integration
    elif not args.full:
        # Smart mode: detect changed components from git
        changed_components = detect_changed_components(repo_root)

        if changed_components.any_changed:
            smart_mode = True
            run_server = changed_components.server
            run_studio = changed_components.studio
            run_hub = changed_components.hub
            run_docs = changed_components.docs
            run_repo = changed_components.scripts
            # Run integration tests if server changed
            run_integration = changed_components.server

            # If CI workflows changed, run everything
            if changed_components.workflows:
                run_server = run_studio = run_hub = True
                run_docs = run_repo = run_integration = True
                smart_mode = False  # Effectively full mode
        else:
            # No changes detected - run nothing (or show message)
            print(f"{Colors.GREEN}No changes detected.{Colors.RESET} Use --full to run all tests.")
            return 0

    # Handle --no-integration
    if args.no_integration:
        run_integration = False

    # Dry run: show what would be tested and exit
    if args.dry_run:
        print_header("Sigilweaver Loom Verification Suite (dry run)", force=True)
        if smart_mode and changed_components:
            print(f"Smart mode: {changed_components.summary()}")
            print()
            print("Changed files:")
            for f in sorted(get_changed_files(repo_root)):
                print(f"  {f}")
            print()
        print("Would run:")
        if run_server:
            print(f"  {Colors.BLUE}Server{Colors.RESET}: lint, types, tests")
        if run_studio:
            print(f"  {Colors.BLUE}Studio{Colors.RESET}: types, lint, tests")
        if run_hub:
            print(
                f"  {Colors.BLUE}Hub{Colors.RESET}: backend (lint, types, tests) "
                "+ frontend (types, lint, tests)"
            )
        if run_docs:
            print(f"  {Colors.BLUE}Docs{Colors.RESET}: build")
        if run_repo:
            print(f"  {Colors.BLUE}Repo{Colors.RESET}: scripts lint")
        if run_integration:
            print(f"  {Colors.BLUE}Integration{Colors.RESET}: server health tests")
        if not any([run_server, run_studio, run_hub, run_docs, run_repo, run_integration]):
            print(f"  {Colors.DIM}(nothing){Colors.RESET}")
        print()
        if smart_mode:
            print(f"{Colors.DIM}Use --full to run all tests{Colors.RESET}")
        return 0

    # Coverage is enabled by default, disable with --no-coverage
    run_coverage = not args.no_coverage

    # CI mode always runs with coverage
    if _ci_mode:
        run_coverage = True

    # Quiet mode is default, use --verbose to show all output
    # (Note: _quiet_mode already set above, just update for parallel)

    # Parallel mode requires quiet mode for clean output
    run_parallel = args.parallel
    if run_parallel and args.verbose:
        print(
            f"{Colors.YELLOW}Warning: Parallel mode requires quiet mode. "
            f"Disabling verbose.{Colors.RESET}"
        )
        _quiet_mode = True

    results: list[SuiteResult] = []

    print_header("Sigilweaver Loom Verification Suite", force=True)

    # Get CPU count for display
    cpu_count = os.cpu_count() or 1

    if _quiet_mode:
        if smart_mode and changed_components:
            print(f"Smart mode: testing changed components ({changed_components.summary()})")
        if run_parallel:
            print(f"Running tests in parallel ({cpu_count} CPUs available)...")
        else:
            print("Running tests (errors only)...")
    else:
        print(f"Repository: {repo_root}")
        if smart_mode and changed_components:
            print(f"Smart mode: {changed_components.summary()}")
        print(f"Mode: {'strict' if args.strict else 'CI-compatible'}")
        print(f"Coverage: {'enabled' if run_coverage else 'disabled'}")
        print(f"Parallel: {'enabled' if run_parallel else 'disabled'}")

    # Build list of suite runners to execute
    suite_runners: list[tuple[str, callable]] = []

    if run_server:
        suite_runners.append(("Server", lambda: run_server_suite(
            repo_root, coverage=run_coverage, strict=args.strict, parallel=run_parallel
        )))

    if run_studio:
        suite_runners.append(("Studio", lambda: run_studio_suite(
            repo_root, coverage=run_coverage, strict=args.strict
        )))

    if run_hub:
        suite_runners.append(("Hub", lambda: run_hub_suite(
            repo_root, coverage=run_coverage, strict=args.strict, parallel=run_parallel
        )))

    if run_docs:
        suite_runners.append(("Docs", lambda: run_docs_suite(repo_root)))

    # The Repo suite is deliberately not in suite_runners: it reads the server
    # venv's ruff, so running it alongside the Server suite in the parallel pool
    # could race that suite creating or repairing the venv. It takes ~0.05s, so
    # there is nothing to gain from parallelising it. Runs first so a tooling
    # break is reported before the long suites start.
    if run_repo:
        results.append(run_repo_suite(repo_root))

    # Run suites (either in parallel or sequentially)
    if run_parallel and len(suite_runners) > 1:
        # Run independent suites in parallel using ThreadPoolExecutor
        # Integration tests must run last (needs server), so exclude from parallel
        with ThreadPoolExecutor(max_workers=min(len(suite_runners), cpu_count)) as executor:
            futures = {executor.submit(runner): name for name, runner in suite_runners}
            for future in as_completed(futures):
                suite_name = futures[future]
                try:
                    result = future.result()
                    results.append(result)
                    status = (
                        f"{Colors.GREEN}PASS{Colors.RESET}" if result.passed
                        else f"{Colors.RED}FAIL{Colors.RESET}"
                    )
                    print(f"  {status} {suite_name} completed ({result.duration:.1f}s)")
                except Exception as e:
                    results.append(SuiteResult(
                        name=suite_name,
                        checks=[
                            CheckResult(
                                name=suite_name, passed=False, duration=0, error=str(e)
                            )
                        ]
                    ))
                    print(f"  {Colors.RED}FAIL{Colors.RESET} {suite_name} failed: {e}")
    else:
        # Sequential execution
        for name, runner in suite_runners:
            results.append(runner())

    # Integration tests always run sequentially (needs server)
    if run_integration:
        results.append(run_integration_tests(repo_root))

    # Determine if this is a full run (all suites enabled, no exclusions)
    is_full_run = (
        run_server and run_studio and run_hub and run_docs
        and run_repo and run_integration and not smart_mode
    )

    # Print summary
    print_summary(
        results,
        strict=args.strict,
        coverage=run_coverage,
        is_full_run=is_full_run,
        parallel=run_parallel,
        smart_mode=smart_mode,
    )

    # Return appropriate exit code
    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
