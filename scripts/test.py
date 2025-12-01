#!/usr/bin/env python3
"""
Full test suite runner for Sigilweaver.

Runs all tests in sequence:
1. Backend tests (pytest)
2. Frontend tests (vitest)
3. Integration tests (requires backend running)

Usage:
    ./scripts/test-full.py              # Run all tests
    ./scripts/test-full.py --backend    # Backend tests only
    ./scripts/test-full.py --frontend   # Frontend tests only
    ./scripts/test-full.py --integration # Integration tests only
    ./scripts/test-full.py --no-integration # Skip integration tests
"""

import argparse
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class TestResult:
    """Result of a test suite run."""
    name: str
    passed: bool
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


def run_backend_tests(repo_root: Path, coverage: bool = False) -> TestResult:
    """Run backend pytest tests."""
    print_header("Backend Tests (pytest)")
    
    backend_dir = repo_root / "backend"
    venv_path = backend_dir / ".venv"
    
    if not venv_path.exists():
        return TestResult(
            name="Backend",
            passed=False,
            duration=0,
            error="Virtual environment not found. Run: cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'"
        )
    
    # Determine the Python executable path
    if sys.platform == "win32":
        python_path = venv_path / "Scripts" / "python.exe"
    else:
        python_path = venv_path / "bin" / "python"
    
    start_time = time.time()
    
    # Build pytest command
    cmd = [str(python_path), "-m", "pytest", "tests/", "-v", "--tb=short"]
    if coverage:
        cmd.extend(["--cov=app", "--cov-report=term", "--cov-report=html"])
    
    try:
        result = subprocess.run(
            cmd,
            cwd=backend_dir,
            capture_output=False,
        )
        duration = time.time() - start_time
        
        if coverage and result.returncode == 0:
            print()
            print(f"Coverage report: {backend_dir}/htmlcov/index.html")
        
        return TestResult(
            name="Backend",
            passed=result.returncode == 0,
            duration=duration,
        )
    except Exception as e:
        return TestResult(
            name="Backend",
            passed=False,
            duration=time.time() - start_time,
            error=str(e),
        )


def run_frontend_tests(repo_root: Path) -> TestResult:
    """Run frontend vitest tests."""
    print_header("Frontend Tests (vitest)")
    
    frontend_dir = repo_root / "frontend"
    node_modules = frontend_dir / "node_modules"
    
    if not node_modules.exists():
        return TestResult(
            name="Frontend",
            passed=False,
            duration=0,
            error="node_modules not found. Run: cd frontend && npm install"
        )
    
    start_time = time.time()
    
    try:
        result = subprocess.run(
            ["npm", "run", "test:unit"],
            cwd=frontend_dir,
            capture_output=False,
        )
        duration = time.time() - start_time
        
        return TestResult(
            name="Frontend",
            passed=result.returncode == 0,
            duration=duration,
        )
    except Exception as e:
        return TestResult(
            name="Frontend",
            passed=False,
            duration=time.time() - start_time,
            error=str(e),
        )


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
    venv_path = backend_dir / ".venv"
    
    if not venv_path.exists():
        return None
    
    if sys.platform == "win32":
        python_path = venv_path / "Scripts" / "python.exe"
    else:
        python_path = venv_path / "bin" / "python"
    
    print("Starting backend server...")
    
    process = subprocess.Popen(
        [str(python_path), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=backend_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    
    # Wait for backend to be ready
    for i in range(30):
        if check_backend_running():
            print("Backend ready!")
            return process
        time.sleep(1)
    
    print("ERROR: Backend failed to start")
    process.terminate()
    return None


def run_integration_tests(repo_root: Path) -> TestResult:
    """Run integration tests."""
    print_header("Integration Tests")
    
    frontend_dir = repo_root / "frontend"
    node_modules = frontend_dir / "node_modules"
    
    if not node_modules.exists():
        return TestResult(
            name="Integration",
            passed=False,
            duration=0,
            error="node_modules not found. Run: cd frontend && npm install"
        )
    
    # Check if backend is running, start if needed
    backend_process = None
    if not check_backend_running():
        print("Backend not detected, starting...")
        backend_process = start_backend(repo_root)
        if backend_process is None:
            return TestResult(
                name="Integration",
                passed=False,
                duration=0,
                error="Failed to start backend server"
            )
    else:
        print("Backend already running")
    
    start_time = time.time()
    
    try:
        result = subprocess.run(
            ["npm", "run", "test:integration"],
            cwd=frontend_dir,
            capture_output=False,
        )
        duration = time.time() - start_time
        
        return TestResult(
            name="Integration",
            passed=result.returncode == 0,
            duration=duration,
        )
    except Exception as e:
        return TestResult(
            name="Integration",
            passed=False,
            duration=time.time() - start_time,
            error=str(e),
        )
    finally:
        if backend_process:
            print("Stopping backend server...")
            backend_process.terminate()
            backend_process.wait()


def print_summary(results: list[TestResult]) -> None:
    """Print test summary."""
    print_header("Test Summary")
    
    total_duration = sum(r.duration for r in results)
    all_passed = all(r.passed for r in results)
    
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(f"  {result.name}: {status} ({result.duration:.1f}s)")
        if result.error:
            print(f"    Error: {result.error}")
    
    print_separator()
    print(f"Total time: {total_duration:.1f}s")
    print()
    
    if all_passed:
        print("All tests passed!")
    else:
        failed = [r.name for r in results if not r.passed]
        print(f"FAILED: {', '.join(failed)}")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run full test suite for Sigilweaver"
    )
    parser.add_argument(
        "--backend",
        action="store_true",
        help="Run backend tests only"
    )
    parser.add_argument(
        "--frontend",
        action="store_true",
        help="Run frontend tests only"
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
        help="Generate coverage reports for backend tests"
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
    results: list[TestResult] = []
    
    print_header("Sigilweaver Full Test Suite")
    print(f"Repository: {repo_root}")
    
    # Run tests
    if run_backend:
        results.append(run_backend_tests(repo_root, coverage=args.coverage))
    
    if run_frontend:
        results.append(run_frontend_tests(repo_root))
    
    if run_integration:
        results.append(run_integration_tests(repo_root))
    
    # Print summary
    print_summary(results)
    
    # Return appropriate exit code
    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
