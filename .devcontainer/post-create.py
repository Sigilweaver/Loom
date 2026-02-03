#!/usr/bin/env python3
"""
Sigilweaver Dev Container Post-Create Setup

Minimal setup that runs on every container create. Installs core tooling (uv)
and configures git. Component dependencies are auto-installed when dev.py runs.

Usage after container creation:
    ./scripts/dev.py              # Start all core components (auto-installs deps)
    ./scripts/dev.py --server     # Server only
    ./scripts/dev.py --studio     # Studio only
    ./scripts/dev.py --hub        # Hub only

Personal configuration:
    Copy .devcontainer/personal.example/ to .devcontainer/personal/ and edit.
    Files: gitconfig.json, .gitignore-global
"""

import json
import subprocess
import sys
from pathlib import Path

# ANSI color codes
GREEN = "\033[0;32m"
BLUE = "\033[0;34m"
RED = "\033[0;31m"
YELLOW = "\033[1;33m"
NC = "\033[0m"  # No Color

WORKSPACE = Path(__file__).parent.parent
PERSONAL_DIR = WORKSPACE / ".devcontainer" / "personal"


def run(cmd: list[str], **kwargs) -> None:
    """Run a command, printing it first."""
    print(f"  → {' '.join(cmd)}")
    subprocess.run(cmd, check=True, **kwargs)


def print_info(message: str) -> None:
    """Print an info message in blue."""
    print(f"{BLUE}{message}{NC}")


def print_success(message: str) -> None:
    """Print a success message in green."""
    print(f"{GREEN}{message}{NC}")


def print_warning(message: str) -> None:
    """Print a warning message in yellow."""
    print(f"{YELLOW}{message}{NC}")


def print_error(message: str) -> None:
    """Print an error message in red."""
    print(f"{RED}ERROR: {message}{NC}")


def configure_git() -> None:
    """Configure Git with base settings and personal config if available."""
    print_info("\nConfiguring Git...")
    
    # Base settings
    for key, value in [
        ("init.defaultBranch", "main"),
        ("pull.rebase", "false"),
        ("core.autocrlf", "input"),
    ]:
        run(["git", "config", "--global", key, value])
    
    # Personal settings
    gitconfig = PERSONAL_DIR / "gitconfig.json"
    if gitconfig.exists():
        config = json.loads(gitconfig.read_text())
        if "name" in config:
            run(["git", "config", "--global", "user.name", config["name"]])
        if "email" in config:
            run(["git", "config", "--global", "user.email", config["email"]])
        for alias, command in config.get("aliases", {}).items():
            run(["git", "config", "--global", f"alias.{alias}", command])
        print_success("  Personal git identity applied")
    else:
        print_warning("  No personal git config - set with:")
        print("    git config --global user.name 'Your Name'")
        print("    git config --global user.email 'you@example.com'")
    
    # Global gitignore
    gitignore = PERSONAL_DIR / ".gitignore-global"
    if gitignore.exists():
        run(["git", "config", "--global", "core.excludesFile", str(gitignore)])


def install_uv() -> None:
    """Install the uv Python package manager."""
    print_info("\nInstalling uv...")
    subprocess.run(
        "curl -LsSf https://astral.sh/uv/install.sh | sh",
        shell=True,
        check=True,
    )
    print_success("  uv installed")


def main() -> int:
    print_info("\nSigilweaver post-create setup\n")
    
    try:
        configure_git()
        install_uv()
        
        print("\n" + "=" * 60)
        print_success("  Base setup complete!")
        print("=" * 60)
        print("""
  Start development (auto-installs dependencies as needed):

    ./scripts/dev.py              # All core components
    ./scripts/dev.py --server     # Server only
    ./scripts/dev.py --studio     # Studio only
    ./scripts/dev.py --hub        # Hub only

  Force reinstall dependencies:

    ./scripts/dev.py --all --install
""")
        return 0
    
    except subprocess.CalledProcessError as e:
        print_error(f"Command failed: {e.cmd}")
        return 1
    except Exception as e:
        print_error(f"{e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
