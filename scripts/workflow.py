#!/usr/bin/env python3
"""
GitHub Actions Workflow Local Testing

Test GitHub Actions workflows locally using `act` before pushing.
This saves money and time by catching issues before they hit CI.

Usage:
    ./scripts/workflow.py                     # List available workflows/jobs
    ./scripts/workflow.py ci                  # Run full CI workflow
    ./scripts/workflow.py ci --job test-server    # Run specific job
    ./scripts/workflow.py ci --dry-run        # Dry run (no actual execution)
    ./scripts/workflow.py build-server        # Test server build
    ./scripts/workflow.py release --dry-run   # Preview release workflow

Requirements:
    - Docker must be running
    - `act` will be installed automatically if not present
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

# ANSI color codes
GREEN = "\033[0;32m"
BLUE = "\033[0;34m"
RED = "\033[0;31m"
YELLOW = "\033[1;33m"
CYAN = "\033[0;36m"
BOLD = "\033[1m"
NC = "\033[0m"  # No Color


def get_repo_root() -> Path:
    """Find the repository root directory."""
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent


def print_header(message: str) -> None:
    """Print a header message."""
    print(f"\n{BLUE}{BOLD}{'=' * 60}{NC}")
    print(f"{BLUE}{BOLD}  {message}{NC}")
    print(f"{BLUE}{BOLD}{'=' * 60}{NC}\n")


def print_info(message: str) -> None:
    """Print an info message."""
    print(f"{CYAN}ℹ {message}{NC}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{GREEN}{message}{NC}")


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{YELLOW}Warning: {message}{NC}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"{RED}Error: {message}{NC}")


def check_docker() -> bool:
    """Check if Docker is running."""
    try:
        result = subprocess.run(["docker", "info"], capture_output=True, timeout=10)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def ensure_act_installed() -> str | None:
    """Ensure act is installed, return path or None."""
    # Check if act is already in PATH
    act_path = shutil.which("act")
    if act_path:
        return act_path

    print_warning("act not found, installing...")

    try:
        # Install act using the official installer
        result = subprocess.run(
            [
                "bash",
                "-c",
                "curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh"
                " | sudo bash",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode == 0:
            # Move to a standard location
            subprocess.run(["sudo", "mv", "./bin/act", "/usr/local/bin/"], check=True)
            subprocess.run(["rm", "-rf", "./bin"], check=False)
            print_success("act installed successfully")
            return "/usr/local/bin/act"
        else:
            print_error(f"Failed to install act: {result.stderr}")
            return None
    except Exception as e:
        print_error(f"Failed to install act: {e}")
        return None


def get_workflows(repo_root: Path) -> dict[str, Path]:
    """Get available workflow files."""
    workflows_dir = repo_root / ".github" / "workflows"
    workflows = {}

    if workflows_dir.exists():
        for wf in workflows_dir.glob("*.yml"):
            # Use stem without extension as key
            name = wf.stem
            workflows[name] = wf

    return workflows


def list_workflows(act_path: str, repo_root: Path) -> None:
    """List all available workflows and jobs."""
    print_header("Available Workflows & Jobs")

    result = subprocess.run(
        [act_path, "-l"], cwd=repo_root, capture_output=True, text=True
    )

    if result.returncode == 0:
        print(result.stdout)
    else:
        print_error(f"Failed to list workflows: {result.stderr}")

    # Also show workflow files
    workflows = get_workflows(repo_root)
    print(f"\n{BOLD}Workflow Files:{NC}")
    for name, path in sorted(workflows.items()):
        print(f"  {CYAN}{name}{NC} → {path.relative_to(repo_root)}")

    print(f"\n{BOLD}Quick Commands:{NC}")
    print(f"  {GREEN}./scripts/workflow.py ci{NC}                    # Run CI workflow")
    print(
        f"  {GREEN}./scripts/workflow.py ci --job test-server{NC}  # Run specific job"
    )
    print(
        f"  {GREEN}./scripts/workflow.py ci --dry-run{NC}          # Preview without running"
    )
    print(
        f"  {GREEN}./scripts/workflow.py build-server{NC}          # Test server build"
    )


def run_workflow(
    act_path: str,
    repo_root: Path,
    workflow: str,
    job: str | None = None,
    dry_run: bool = False,
    verbose: bool = False,
    event: str | None = None,
    secrets_file: str | None = None,
    env_file: str | None = None,
) -> int:
    """Run a workflow using act."""

    workflows = get_workflows(repo_root)

    # Find the workflow file
    workflow_path = None
    if workflow in workflows:
        workflow_path = workflows[workflow]
    else:
        # Try with .yml extension
        for name, path in workflows.items():
            if name.startswith(workflow):
                workflow_path = path
                break

    if not workflow_path:
        print_error(f"Workflow '{workflow}' not found")
        print_info(f"Available workflows: {', '.join(workflows.keys())}")
        return 1

    # Build the act command
    cmd = [act_path]

    # Add workflow path
    cmd.extend(["-W", str(workflow_path)])

    # Add job filter if specified
    if job:
        cmd.extend(["-j", job])

    # Add event type (default: push for most workflows)
    if event:
        cmd.append(event)

    # Add dry run flag
    if dry_run:
        cmd.append("--dryrun")

    # Add verbose flag
    if verbose:
        cmd.append("-v")

    # Add secrets file if specified
    if secrets_file:
        cmd.extend(["--secret-file", secrets_file])

    # Add env file if specified
    if env_file:
        cmd.extend(["--env-file", env_file])

    # Common useful options
    cmd.extend(
        [
            "--container-architecture",
            "linux/amd64",
            # Use artifact server to handle artifacts locally
            "--artifact-server-path",
            str(repo_root / ".act-artifacts"),
        ]
    )

    action = "Dry running" if dry_run else "Running"
    job_str = f" (job: {job})" if job else ""
    print_header(f"{action} workflow: {workflow}{job_str}")

    print_info(f"Command: {' '.join(cmd)}")
    print()

    # Run act
    try:
        result = subprocess.run(
            cmd,
            cwd=repo_root,
        )

        if result.returncode == 0:
            print()
            print_success(f"Workflow {workflow} completed successfully!")
        else:
            print()
            print_error(
                f"Workflow {workflow} failed with exit code {result.returncode}"
            )

        return result.returncode

    except KeyboardInterrupt:
        print()
        print_warning("Workflow interrupted by user")
        return 130


def create_secrets_template(repo_root: Path) -> None:
    """Create a template secrets file for local testing."""
    secrets_file = repo_root / ".act.secrets"

    if secrets_file.exists():
        print_warning(f"Secrets file already exists: {secrets_file}")
        return

    template = """# Local secrets for act (GitHub Actions local testing)
# Copy this file to .act.secrets and fill in values
# DO NOT COMMIT THIS FILE - it's in .gitignore

# GitHub token (for API access, artifact upload, etc.)
# Create a personal access token at https://github.com/settings/tokens
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Cloudflare R2 Storage (for release uploads)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT_URL=
R2_CDN_URL=

# Other secrets as needed
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
"""

    secrets_file.write_text(template)
    print_success(f"Created secrets template: {secrets_file}")
    print_info("Edit this file and add your secrets for local testing")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Test GitHub Actions workflows locally using act",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    ./scripts/workflow.py                         # List available workflows
    ./scripts/workflow.py ci                      # Run CI workflow
    ./scripts/workflow.py ci --job test-server    # Run specific job
    ./scripts/workflow.py ci --dry-run            # Preview without execution
    ./scripts/workflow.py build-server            # Test server build
    ./scripts/workflow.py --init-secrets          # Create secrets template

Workflow shortcuts:
    ci            → .github/workflows/ci.yml
    release       → .github/workflows/release.yml
    build-server  → .github/workflows/build-server.yml
    build-studio-full → .github/workflows/build-studio-full.yml
        """,
    )

    parser.add_argument(
        "workflow",
        nargs="?",
        help="Workflow to run (e.g., 'ci', 'release', 'build-server')",
    )
    parser.add_argument("--job", "-j", help="Specific job to run within the workflow")
    parser.add_argument(
        "--dry-run",
        "-n",
        action="store_true",
        help="Show what would be run without actually running",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument(
        "--event",
        "-e",
        help="Event type to simulate (push, pull_request, workflow_dispatch)",
    )
    parser.add_argument(
        "--secrets-file", help="Path to secrets file (default: .act.secrets if exists)"
    )
    parser.add_argument("--env-file", help="Path to environment file")
    parser.add_argument(
        "--init-secrets", action="store_true", help="Create a template secrets file"
    )
    parser.add_argument(
        "--list", "-l", action="store_true", help="List available workflows and jobs"
    )

    args = parser.parse_args()
    repo_root = get_repo_root()

    # Handle --init-secrets
    if args.init_secrets:
        create_secrets_template(repo_root)
        return 0

    # Check Docker
    if not check_docker():
        print_error("Docker is not running!")
        print_info("Please start Docker and try again")
        return 1

    # Ensure act is installed
    act_path = ensure_act_installed()
    if not act_path:
        print_error("Could not install act")
        return 1

    # List workflows if no workflow specified or --list flag
    if args.list or not args.workflow:
        list_workflows(act_path, repo_root)
        return 0

    # Check for secrets file
    secrets_file = args.secrets_file
    if not secrets_file:
        default_secrets = repo_root / ".act.secrets"
        if default_secrets.exists():
            secrets_file = str(default_secrets)
            print_info(f"Using secrets from: {default_secrets}")

    # Run the workflow
    return run_workflow(
        act_path=act_path,
        repo_root=repo_root,
        workflow=args.workflow,
        job=args.job,
        dry_run=args.dry_run,
        verbose=args.verbose,
        event=args.event,
        secrets_file=secrets_file,
        env_file=args.env_file,
    )


if __name__ == "__main__":
    sys.exit(main())
