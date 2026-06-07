#!/usr/bin/env python3
"""
Set version across all project files from git tag.

Used in GitHub Actions to inject version from git tags into the build.

Updates the following files:
  - studio/package.json
  - server/pyproject.toml
  - hub/backend/pyproject.toml
  - hub/frontend/package.json
  - docs/package.json
  - studio/tauri/tauri.conf.json
  - studio/tauri/Cargo.toml
  - server/app/__init__.py
  - hub/backend/app/__init__.py

Usage:
    python3 set-version.py <version>
    python3 set-version.py 0.3.3-alpha

Environment variables:
    GITHUB_REF_NAME: Git ref name (e.g., 'v0.3.3-alpha') - version prefix 'v' will be stripped
"""

import json
import re
import sys
from pathlib import Path


def set_package_json_version(version: str, package_json_path: Path) -> bool:
    """
    Set version in package.json.
    
    Args:
        version: Version string (e.g., '0.3.3-alpha')
        package_json_path: Path to package.json file
        
    Returns:
        True if successful, False otherwise
    """
    if not package_json_path.exists():
        print(f"WARNING: {package_json_path} not found, skipping")
        return True  # Not an error, just skip
    
    # Read package.json
    try:
        with open(package_json_path, 'r') as f:
            package_data = json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to read {package_json_path}: {e}")
        return False
    
    # Update version
    old_version = package_data.get('version', 'unknown')
    package_data['version'] = version
    
    # Write back
    try:
        with open(package_json_path, 'w') as f:
            json.dump(package_data, f, indent=2)
            f.write('\n')  # Add trailing newline
    except Exception as e:
        print(f"ERROR: Failed to write {package_json_path}: {e}")
        return False
    
    print(f"Updated package.json version: {old_version} -> {version}")
    return True


def make_msi_compatible_version(version: str) -> str:
    """
    Convert a semver version to an MSI-compatible version.
    
    MSI versions only support numeric pre-release identifiers (max 65535).
    Non-numeric pre-release identifiers (e.g., 'alpha', 'beta', 'rc1')
    are stripped to produce a valid MSI version.
    
    Args:
        version: Semver version string (e.g., '0.3.3-alpha', '1.0.0-rc.1')
        
    Returns:
        MSI-compatible version string (e.g., '0.3.3', '1.0.0-1')
    """
    # Split off pre-release identifier
    match = re.match(r'^(\d+\.\d+\.\d+)(?:-(.+))?$', version)
    if not match:
        return version  # Can't parse, return as-is
    
    base_version = match.group(1)
    prerelease = match.group(2)
    
    if prerelease is None:
        return base_version
    
    # Check if pre-release is purely numeric and <= 65535
    if prerelease.isdigit() and int(prerelease) <= 65535:
        return f"{base_version}-{prerelease}"
    
    # Non-numeric or out-of-range pre-release: strip it for MSI compatibility
    print(f"  Stripping non-numeric pre-release '{prerelease}' for MSI compatibility")
    return base_version


def set_tauri_config_version(version: str, tauri_config_path: Path) -> bool:
    """
    Set version in tauri.conf.json.
    
    The version is made MSI-compatible by stripping non-numeric pre-release
    identifiers, since MSI targets require numeric-only identifiers (max 65535).
    
    Args:
        version: Version string (e.g., '0.3.3-alpha')
        tauri_config_path: Path to tauri.conf.json file
        
    Returns:
        True if successful, False otherwise
    """
    if not tauri_config_path.exists():
        print(f"WARNING: {tauri_config_path} not found, skipping")
        return True  # Not an error, just skip
    
    # Read tauri.conf.json
    try:
        with open(tauri_config_path, 'r') as f:
            config_data = json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to read {tauri_config_path}: {e}")
        return False
    
    # Make version MSI-compatible
    tauri_version = make_msi_compatible_version(version)
    
    # Update version
    old_version = config_data.get('version', 'unknown')
    config_data['version'] = tauri_version
    
    # Write back with proper formatting
    try:
        with open(tauri_config_path, 'w') as f:
            json.dump(config_data, f, indent=4)
            f.write('\n')  # Add trailing newline
    except Exception as e:
        print(f"ERROR: Failed to write {tauri_config_path}: {e}")
        return False
    
    print(f"Updated tauri.conf.json version: {old_version} -> {tauri_version}" +
          (f" (from {version})" if tauri_version != version else ""))
    return True


def set_toml_version(version: str, toml_path: Path) -> bool:
    """
    Set version in a TOML file (pyproject.toml or Cargo.toml).
    
    Args:
        version: Version string (e.g., '0.3.3-alpha')
        toml_path: Path to TOML file
        
    Returns:
        True if successful, False otherwise
    """
    if not toml_path.exists():
        print(f"WARNING: {toml_path} not found, skipping")
        return True
    
    try:
        with open(toml_path, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"ERROR: Failed to read {toml_path}: {e}")
        return False
    
    old_content = content
    content = re.sub(
        r'^version\s*=\s*"[^"]*"',
        f'version = "{version}"',
        content,
        flags=re.MULTILINE
    )
    
    if content == old_content:
        print(f"WARNING: No version found in {toml_path}")
        return False
    
    try:
        with open(toml_path, 'w') as f:
            f.write(content)
    except Exception as e:
        print(f"ERROR: Failed to write {toml_path}: {e}")
        return False
    
    old_match = re.search(r'version\s*=\s*"([^"]*)"', old_content)
    old_version = old_match.group(1) if old_match else 'unknown'
    
    print(f"Updated {toml_path.name} version: {old_version} -> {version}")
    return True


def set_init_version(version: str, init_path: Path) -> bool:
    """
    Set __version__ in a Python __init__.py file.
    
    Args:
        version: Version string (e.g., '0.3.3-alpha')
        init_path: Path to __init__.py file
        
    Returns:
        True if successful, False otherwise
    """
    if not init_path.exists():
        print(f"WARNING: {init_path} not found, skipping")
        return True
    
    try:
        with open(init_path, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"ERROR: Failed to read {init_path}: {e}")
        return False
    
    old_content = content
    content = re.sub(
        r'^__version__\s*=\s*"[^"]*"',
        f'__version__ = "{version}"',
        content,
        flags=re.MULTILINE
    )
    
    if content == old_content:
        print(f"WARNING: No __version__ found in {init_path}")
        return False
    
    try:
        with open(init_path, 'w') as f:
            f.write(content)
    except Exception as e:
        print(f"ERROR: Failed to write {init_path}: {e}")
        return False
    
    old_match = re.search(r'__version__\s*=\s*"([^"]*)"', old_content)
    old_version = old_match.group(1) if old_match else 'unknown'
    
    print(f"Updated {init_path} __version__: {old_version} -> {version}")
    return True


def main():
    # Check for version argument or GITHUB_REF_NAME environment variable
    import os
    
    if len(sys.argv) > 1:
        version = sys.argv[1]
    elif 'GITHUB_REF_NAME' in os.environ:
        version = os.environ['GITHUB_REF_NAME']
    else:
        print("ERROR: No version provided")
        print("Usage: set-version.py <version>")
        print("   or: set GITHUB_REF_NAME environment variable")
        return 1
    
    # Strip 'v' prefix if present
    if version.startswith('v'):
        version = version[1:]
    
    # Find config files (assume we're in .github/scripts/)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    package_json = project_root / 'studio' / 'package.json'
    server_pyproject = project_root / 'server' / 'pyproject.toml'
    hub_pyproject = project_root / 'hub' / 'backend' / 'pyproject.toml'
    hub_frontend_package = project_root / 'hub' / 'frontend' / 'package.json'
    docs_package = project_root / 'docs' / 'package.json'
    tauri_config = project_root / 'studio' / 'tauri' / 'tauri.conf.json'
    cargo_toml = project_root / 'studio' / 'tauri' / 'Cargo.toml'
    server_init = project_root / 'server' / 'app' / '__init__.py'
    hub_init = project_root / 'hub' / 'backend' / 'app' / '__init__.py'
    
    success = True
    
    if not set_package_json_version(version, package_json):
        success = False
    
    if not set_toml_version(version, server_pyproject):
        success = False
    
    if not set_toml_version(version, hub_pyproject):
        success = False
    
    if not set_package_json_version(version, hub_frontend_package):
        success = False
    
    if not set_package_json_version(version, docs_package):
        success = False
    
    if not set_tauri_config_version(version, tauri_config):
        success = False
    
    if not set_toml_version(version, cargo_toml):
        success = False
    
    if not set_init_version(version, server_init):
        success = False
    
    if not set_init_version(version, hub_init):
        success = False
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
