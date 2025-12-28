#!/usr/bin/env python3
"""
Full verification suite for Sigilweaver.

Runs all checks to ensure CI will pass:
1. Server: Lint (ruff) + Type check (mypy) + Tests (pytest) + Coverage
2. Studio: Type check (tsc) + Lint (eslint) + Tests (vitest) + Coverage
3. Integration tests (requires server running)

Usage:
    ./scripts/test.py              # Run all checks, only show errors (recommended before PR)
    ./scripts/test.py -v           # Verbose mode - show all output
    ./scripts/test.py --server     # Server checks only
    ./scripts/test.py --studio     # Studio checks only
    ./scripts/test.py --integration # Integration tests only
    ./scripts/test.py --no-integration # Skip integration tests
    ./scripts/test.py --no-coverage # Skip coverage reports (faster)
    ./scripts/test.py --strict     # Fail on lint warnings (stricter than CI)
"""

import argparse
import subprocess
import sys
import time
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


# Global quiet mode flag
_quiet_mode = False


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
    
    # Match CI behavior: ruff check with exit-zero unless strict mode
    cmd = [str(python_path), "-m", "ruff", "check", "app/", "tests/"]
    if not strict:
        cmd.append("--exit-zero")
    
    return run_command(cmd, server_dir, "Server Lint", fail_on_error=strict)


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
    
    # Match CI behavior: mypy issues are reported but don't fail unless strict
    return run_command(cmd, server_dir, "Server Types", fail_on_error=strict)


def run_server_tests(repo_root: Path, coverage: bool = False) -> CheckResult:
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
    if coverage:
        cmd.extend(["--cov=app", "--cov-report=term", "--cov-report=html"])
    
    result = run_command(cmd, server_dir, "Server Tests", fail_on_error=True)
    
    if coverage and result.passed and not _quiet_mode:
        print()
        print(f"Coverage report: {server_dir}/htmlcov/index.html")
    
    return result


def run_server_suite(repo_root: Path, coverage: bool = False, strict: bool = False) -> SuiteResult:
    """Run all server checks."""
    print_header("Server Verification")
    
    server_dir = repo_root / "server"
    venv_path = server_dir / ".venv"
    
    suite = SuiteResult(name="Server")
    
    lock_path = server_dir / "uv.lock"
    if not lock_path.exists() or not venv_path.exists():
        suite.checks.append(CheckResult(
            name="Server Setup",
            passed=False,
            duration=0,
            error="Server not set up with uv. Run: cd server && uv sync --all-extras"
        ))
        return suite
    
    # Run lint, typecheck, and tests
    suite.checks.append(run_server_lint(repo_root, strict=strict))
    suite.checks.append(run_server_typecheck(repo_root, strict=strict))
    suite.checks.append(run_server_tests(repo_root, coverage=coverage))
    
    return suite


def run_studio_typecheck(repo_root: Path) -> CheckResult:
    """Run TypeScript type checker."""
    print_subheader("Studio Type Check (tsc)")
    
    studio_dir = repo_root / "studio"
    
    return run_command(
        ["npm", "run", "type-check"],
        studio_dir,
        "Studio Types",
        fail_on_error=True
    )


def run_studio_lint(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run ESLint on studio code."""
    print_subheader("Studio Lint (eslint)")
    
    studio_dir = repo_root / "studio"
    
    # Match CI behavior: lint issues are reported but don't fail unless strict
    return run_command(
        ["npm", "run", "lint"],
        studio_dir,
        "Studio Lint",
        fail_on_error=strict
    )


def run_studio_tests(repo_root: Path, coverage: bool = False) -> CheckResult:
    """Run studio vitest tests."""
    print_subheader("Studio Tests (vitest)")
    
    studio_dir = repo_root / "studio"
    
    cmd = ["npm", "run", "test:coverage" if coverage else "test:unit"]
    
    result = run_command(cmd, studio_dir, "Studio Tests", fail_on_error=True)
    
    if coverage and result.passed and not _quiet_mode:
        print()
        print(f"Coverage report: {studio_dir}/coverage/index.html")
    
    return result


def run_studio_suite(repo_root: Path, coverage: bool = False, strict: bool = False) -> SuiteResult:
    """Run all studio checks."""
    print_header("Studio Verification")
    
    studio_dir = repo_root / "studio"
    node_modules = studio_dir / "node_modules"
    
    suite = SuiteResult(name="Studio")
    
    if not node_modules.exists():
        suite.checks.append(CheckResult(
            name="Studio Setup",
            passed=False,
            duration=0,
            error="node_modules not found. Run: cd studio && npm install"
        ))
        return suite
    
    # Run typecheck, lint, and tests
    suite.checks.append(run_studio_typecheck(repo_root))
    suite.checks.append(run_studio_lint(repo_root, strict=strict))
    suite.checks.append(run_studio_tests(repo_root, coverage=coverage))
    
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
    python_path = get_python_path(server_dir)
    
    if python_path is None:
        return None
    
    print("Starting server on port 8001 (test server)...")
    
    process = subprocess.Popen(
        [str(python_path), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
        cwd=server_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
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
    node_modules = studio_dir / "node_modules"
    
    suite = SuiteResult(name="Integration")
    
    if not node_modules.exists():
        suite.checks.append(CheckResult(
            name="Integration Setup",
            passed=False,
            duration=0,
            error="node_modules not found. Run: cd studio && npm install"
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
            ["npm", "run", "test:integration"],
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


def print_summary(results: list[SuiteResult], strict: bool = False, coverage: bool = True, is_full_run: bool = True) -> None:
    """Print verification summary with colors."""
    print_header("Verification Summary", force=True)
    
    total_duration = sum(r.duration for r in results)
    all_passed = all(r.passed for r in results)
    
    for suite in results:
        if suite.passed:
            status = f"{Colors.GREEN}{Colors.BOLD}PASS{Colors.RESET}"
        else:
            status = f"{Colors.RED}{Colors.BOLD}FAIL{Colors.RESET}"
        print(f"\n  {Colors.BOLD}{suite.name}{Colors.RESET}: {status} {Colors.DIM}({suite.duration:.1f}s){Colors.RESET}")
        
        for check in suite.checks:
            if check.passed:
                check_status = f"{Colors.GREEN}PASS{Colors.RESET}"
            else:
                check_status = f"{Colors.RED}FAIL{Colors.RESET}"
            warning_note = f" {Colors.YELLOW}({check.warnings} warnings){Colors.RESET}" if check.warnings > 0 and check.passed else ""
            print(f"    - {check.name}: {check_status}{warning_note} {Colors.DIM}({check.duration:.1f}s){Colors.RESET}")
            if check.error:
                print(f"      {Colors.RED}Error: {check.error}{Colors.RESET}")
    
    print_separator()
    print(f"{Colors.DIM}Total time: {total_duration:.1f}s{Colors.RESET}")
    print(f"{Colors.DIM}Mode: {'strict' if strict else 'CI-compatible'}{Colors.RESET}")
    print(f"{Colors.DIM}Coverage: {'enabled' if coverage else 'disabled'}{Colors.RESET}")
    print()
    
    if all_passed:
        if is_full_run:
            print(f"{Colors.GREEN}{Colors.BOLD}All checks passed! Ready for PR.{Colors.RESET}")
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
        description="Run full verification suite for Sigilweaver (lint, typecheck, tests)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  ./scripts/test.py              # Full verification, only show errors (recommended before PR)
  ./scripts/test.py -v           # Verbose mode - show all output
  ./scripts/test.py --server     # Server only (ruff + mypy + pytest + coverage)
  ./scripts/test.py --studio     # Studio only (tsc + eslint + vitest + coverage)
  ./scripts/test.py --no-coverage # Skip coverage reports (faster)
  ./scripts/test.py --strict     # Fail on lint/type warnings
"""
    )
    parser.add_argument(
        "--server",
        action="store_true",
        help="Run server checks only (ruff + mypy + pytest)"
    )
    parser.add_argument(
        "--studio",
        action="store_true",
        help="Run studio checks only (tsc + eslint + vitest)"
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
        "-v", "--verbose",
        action="store_true",
        help="Verbose mode: show all output (default: only show errors)"
    )
    
    args = parser.parse_args()
    
    # Determine which tests to run
    run_server = True
    run_studio = True
    run_integration = True
    
    # If specific tests requested, only run those
    if args.server or args.studio or args.integration:
        run_server = args.server
        run_studio = args.studio
        run_integration = args.integration
    
    # Handle --no-integration
    if args.no_integration:
        run_integration = False
    
    # Coverage is enabled by default, disable with --no-coverage
    run_coverage = not args.no_coverage
    
    # Quiet mode is default, use --verbose to show all output
    global _quiet_mode
    _quiet_mode = not args.verbose
    
    repo_root = get_repo_root()
    results: list[SuiteResult] = []
    
    print_header("Sigilweaver Verification Suite", force=True)
    if _quiet_mode:
        print("Running tests (errors only)...")
    else:
        print(f"Repository: {repo_root}")
        print(f"Mode: {'strict' if args.strict else 'CI-compatible'}")
        print(f"Coverage: {'enabled' if run_coverage else 'disabled'}")
    
    # Run checks
    if run_server:
        results.append(run_server_suite(repo_root, coverage=run_coverage, strict=args.strict))
    
    if run_studio:
        results.append(run_studio_suite(repo_root, coverage=run_coverage, strict=args.strict))
    
    if run_integration:
        results.append(run_integration_tests(repo_root))
    
    # Determine if this is a full run (all suites enabled, no exclusions)
    is_full_run = run_server and run_studio and run_integration
    
    # Print summary
    print_summary(results, strict=args.strict, coverage=run_coverage, is_full_run=is_full_run)
    
    # Return appropriate exit code
    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
