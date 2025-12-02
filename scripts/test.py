#!/usr/bin/env python3
"""
Full verification suite for Sigilweaver.

Runs all checks to ensure CI will pass:
1. Backend: Lint (ruff) + Type check (mypy) + Tests (pytest)
2. Frontend: Type check (tsc) + Lint (eslint) + Tests (vitest)
3. Integration tests (requires backend running)

Usage:
    ./scripts/test.py              # Run all checks (recommended before PR)
    ./scripts/test.py --backend    # Backend checks only
    ./scripts/test.py --frontend   # Frontend checks only
    ./scripts/test.py --integration # Integration tests only
    ./scripts/test.py --no-integration # Skip integration tests
    ./scripts/test.py --coverage   # Include coverage reports
    ./scripts/test.py --strict     # Fail on lint warnings (stricter than CI)
"""

import argparse
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path


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
    """Result of a test suite (backend, frontend, integration)."""
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


def print_header(title: str) -> None:
    """Print a section header."""
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_subheader(title: str) -> None:
    """Print a subsection header."""
    print()
    print(f"--- {title} ---")


def print_separator() -> None:
    """Print a separator line."""
    print("-" * 60)


def get_python_path(backend_dir: Path) -> Path | None:
    """Get the Python executable path from the backend venv."""
    venv_path = backend_dir / ".venv"
    if not venv_path.exists():
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


def run_backend_lint(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run ruff linter on backend code."""
    print_subheader("Backend Lint (ruff)")
    
    backend_dir = repo_root / "backend"
    python_path = get_python_path(backend_dir)
    
    if python_path is None:
        return CheckResult(
            name="Backend Lint",
            passed=False,
            duration=0,
            error="Virtual environment not found"
        )
    
    # Match CI behavior: ruff check with exit-zero unless strict mode
    cmd = [str(python_path), "-m", "ruff", "check", "app/", "tests/"]
    if not strict:
        cmd.append("--exit-zero")
    
    return run_command(cmd, backend_dir, "Backend Lint", fail_on_error=strict)


def run_backend_typecheck(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run mypy type checker on backend code."""
    print_subheader("Backend Type Check (mypy)")
    
    backend_dir = repo_root / "backend"
    python_path = get_python_path(backend_dir)
    
    if python_path is None:
        return CheckResult(
            name="Backend Types",
            passed=False,
            duration=0,
            error="Virtual environment not found"
        )
    
    cmd = [str(python_path), "-m", "mypy", "app/"]
    
    # Match CI behavior: mypy issues are reported but don't fail unless strict
    return run_command(cmd, backend_dir, "Backend Types", fail_on_error=strict)


def run_backend_tests(repo_root: Path, coverage: bool = False) -> CheckResult:
    """Run backend pytest tests."""
    print_subheader("Backend Tests (pytest)")
    
    backend_dir = repo_root / "backend"
    python_path = get_python_path(backend_dir)
    
    if python_path is None:
        return CheckResult(
            name="Backend Tests",
            passed=False,
            duration=0,
            error="Virtual environment not found. Run: cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'"
        )
    
    cmd = [str(python_path), "-m", "pytest", "tests/", "-v", "--tb=short"]
    if coverage:
        cmd.extend(["--cov=app", "--cov-report=term", "--cov-report=html"])
    
    result = run_command(cmd, backend_dir, "Backend Tests", fail_on_error=True)
    
    if coverage and result.passed:
        print()
        print(f"Coverage report: {backend_dir}/htmlcov/index.html")
    
    return result


def run_backend_suite(repo_root: Path, coverage: bool = False, strict: bool = False) -> SuiteResult:
    """Run all backend checks."""
    print_header("Backend Verification")
    
    backend_dir = repo_root / "backend"
    venv_path = backend_dir / ".venv"
    
    suite = SuiteResult(name="Backend")
    
    if not venv_path.exists():
        suite.checks.append(CheckResult(
            name="Backend Setup",
            passed=False,
            duration=0,
            error="Virtual environment not found. Run: cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'"
        ))
        return suite
    
    # Run lint, typecheck, and tests
    suite.checks.append(run_backend_lint(repo_root, strict=strict))
    suite.checks.append(run_backend_typecheck(repo_root, strict=strict))
    suite.checks.append(run_backend_tests(repo_root, coverage=coverage))
    
    return suite


def run_frontend_typecheck(repo_root: Path) -> CheckResult:
    """Run TypeScript type checker."""
    print_subheader("Frontend Type Check (tsc)")
    
    frontend_dir = repo_root / "frontend"
    
    return run_command(
        ["npm", "run", "type-check"],
        frontend_dir,
        "Frontend Types",
        fail_on_error=True
    )


def run_frontend_lint(repo_root: Path, strict: bool = False) -> CheckResult:
    """Run ESLint on frontend code."""
    print_subheader("Frontend Lint (eslint)")
    
    frontend_dir = repo_root / "frontend"
    
    # Match CI behavior: lint issues are reported but don't fail unless strict
    return run_command(
        ["npm", "run", "lint"],
        frontend_dir,
        "Frontend Lint",
        fail_on_error=strict
    )


def run_frontend_tests(repo_root: Path, coverage: bool = False) -> CheckResult:
    """Run frontend vitest tests."""
    print_subheader("Frontend Tests (vitest)")
    
    frontend_dir = repo_root / "frontend"
    
    cmd = ["npm", "run", "test:coverage" if coverage else "test:unit"]
    
    result = run_command(cmd, frontend_dir, "Frontend Tests", fail_on_error=True)
    
    if coverage and result.passed:
        print()
        print(f"Coverage report: {frontend_dir}/coverage/index.html")
    
    return result


def run_frontend_suite(repo_root: Path, coverage: bool = False, strict: bool = False) -> SuiteResult:
    """Run all frontend checks."""
    print_header("Frontend Verification")
    
    frontend_dir = repo_root / "frontend"
    node_modules = frontend_dir / "node_modules"
    
    suite = SuiteResult(name="Frontend")
    
    if not node_modules.exists():
        suite.checks.append(CheckResult(
            name="Frontend Setup",
            passed=False,
            duration=0,
            error="node_modules not found. Run: cd frontend && npm install"
        ))
        return suite
    
    # Run typecheck, lint, and tests
    suite.checks.append(run_frontend_typecheck(repo_root))
    suite.checks.append(run_frontend_lint(repo_root, strict=strict))
    suite.checks.append(run_frontend_tests(repo_root, coverage=coverage))
    
    return suite


def check_backend_running() -> bool:
    """Check if backend is running."""
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:8000/api/health/", timeout=2)
        return True
    except Exception:
        return False


def start_backend(repo_root: Path) -> subprocess.Popen | None:
    """Start the backend server."""
    backend_dir = repo_root / "backend"
    python_path = get_python_path(backend_dir)
    
    if python_path is None:
        return None
    
    print("Starting backend server...")
    
    process = subprocess.Popen(
        [str(python_path), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=backend_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    
    # Wait for backend to be ready
    for _ in range(30):
        if check_backend_running():
            print("Backend ready!")
            return process
        time.sleep(1)
    
    print("ERROR: Backend failed to start")
    process.terminate()
    return None


def run_integration_tests(repo_root: Path) -> SuiteResult:
    """Run integration tests."""
    print_header("Integration Tests")
    
    frontend_dir = repo_root / "frontend"
    node_modules = frontend_dir / "node_modules"
    
    suite = SuiteResult(name="Integration")
    
    if not node_modules.exists():
        suite.checks.append(CheckResult(
            name="Integration Setup",
            passed=False,
            duration=0,
            error="node_modules not found. Run: cd frontend && npm install"
        ))
        return suite
    
    # Check if backend is running, start if needed
    backend_process = None
    if not check_backend_running():
        print("Backend not detected, starting...")
        backend_process = start_backend(repo_root)
        if backend_process is None:
            suite.checks.append(CheckResult(
                name="Integration Setup",
                passed=False,
                duration=0,
                error="Failed to start backend server"
            ))
            return suite
    else:
        print("Backend already running")
    
    try:
        result = run_command(
            ["npm", "run", "test:integration"],
            frontend_dir,
            "Integration Tests",
            fail_on_error=True
        )
        suite.checks.append(result)
    finally:
        if backend_process:
            print("Stopping backend server...")
            backend_process.terminate()
            backend_process.wait()
    
    return suite


def print_summary(results: list[SuiteResult], strict: bool = False) -> None:
    """Print verification summary."""
    print_header("Verification Summary")
    
    total_duration = sum(r.duration for r in results)
    all_passed = all(r.passed for r in results)
    
    for suite in results:
        suite_status = "PASS" if suite.passed else "FAIL"
        print(f"\n  {suite.name}: {suite_status} ({suite.duration:.1f}s)")
        
        for check in suite.checks:
            check_status = "PASS" if check.passed else "FAIL"
            warning_note = f" ({check.warnings} warnings)" if check.warnings > 0 and check.passed else ""
            print(f"    - {check.name}: {check_status}{warning_note} ({check.duration:.1f}s)")
            if check.error:
                print(f"      Error: {check.error}")
    
    print_separator()
    print(f"Total time: {total_duration:.1f}s")
    print(f"Mode: {'strict' if strict else 'CI-compatible'}")
    print()
    
    if all_passed:
        print("All checks passed! Ready for PR.")
    else:
        failed_suites = [r.name for r in results if not r.passed]
        print(f"FAILED: {', '.join(failed_suites)}")
        print()
        print("Fix the issues above before submitting a PR.")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run full verification suite for Sigilweaver (lint, typecheck, tests)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  ./scripts/test.py              # Full verification (recommended before PR)
  ./scripts/test.py --backend    # Backend only (ruff + mypy + pytest)
  ./scripts/test.py --frontend   # Frontend only (tsc + eslint + vitest)
  ./scripts/test.py --strict     # Fail on lint/type warnings
  ./scripts/test.py --coverage   # Include coverage reports
"""
    )
    parser.add_argument(
        "--backend",
        action="store_true",
        help="Run backend checks only (ruff + mypy + pytest)"
    )
    parser.add_argument(
        "--frontend",
        action="store_true",
        help="Run frontend checks only (tsc + eslint + vitest)"
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
        "--coverage",
        action="store_true",
        help="Generate coverage reports"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on lint/type warnings (stricter than CI)"
    )
    
    args = parser.parse_args()
    
    # Determine which tests to run
    run_backend = True
    run_frontend = True
    run_integration = True
    
    # If specific tests requested, only run those
    if args.backend or args.frontend or args.integration:
        run_backend = args.backend
        run_frontend = args.frontend
        run_integration = args.integration
    
    # Handle --no-integration
    if args.no_integration:
        run_integration = False
    
    repo_root = get_repo_root()
    results: list[SuiteResult] = []
    
    print_header("Sigilweaver Verification Suite")
    print(f"Repository: {repo_root}")
    print(f"Mode: {'strict' if args.strict else 'CI-compatible'}")
    if args.coverage:
        print("Coverage: enabled")
    
    # Run checks
    if run_backend:
        results.append(run_backend_suite(repo_root, coverage=args.coverage, strict=args.strict))
    
    if run_frontend:
        results.append(run_frontend_suite(repo_root, coverage=args.coverage, strict=args.strict))
    
    if run_integration:
        results.append(run_integration_tests(repo_root))
    
    # Print summary
    print_summary(results, strict=args.strict)
    
    # Return appropriate exit code
    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
