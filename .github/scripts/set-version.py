#!/usr/bin/env python3
"""
Set version in package.json and pyproject.toml from git tag.

Used in GitHub Actions to inject version from git tags into the build.

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


def set_pyproject_version(version: str, pyproject_path: Path) -> bool:
    """
    Set version in pyproject.toml.
    
    Args:
        version: Version string (e.g., '0.3.3-alpha')
        pyproject_path: Path to pyproject.toml file
        
    Returns:
        True if successful, False otherwise
    """
    if not pyproject_path.exists():
        print(f"WARNING: {pyproject_path} not found, skipping")
        return True  # Not an error, just skip
    
    # Read pyproject.toml
    try:
        with open(pyproject_path, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"ERROR: Failed to read {pyproject_path}: {e}")
        return False
    
    # Replace version line
    old_content = content
    content = re.sub(
        r'^version\s*=\s*"[^"]*"',
        f'version = "{version}"',
        content,
        flags=re.MULTILINE
    )
    
    if content == old_content:
        print(f"WARNING: No version found in {pyproject_path}")
        return False
    
    # Write back
    try:
        with open(pyproject_path, 'w') as f:
            f.write(content)
    except Exception as e:
        print(f"ERROR: Failed to write {pyproject_path}: {e}")
        return False
    
    # Extract old version for logging
    old_match = re.search(r'version\s*=\s*"([^"]*)"', old_content)
    old_version = old_match.group(1) if old_match else 'unknown'
    
    print(f"Updated pyproject.toml version: {old_version} -> {version}")
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
    
    # Find package.json and pyproject.toml (assume we're in .github/scripts/)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    package_json = project_root / 'frontend' / 'package.json'
    pyproject_toml = project_root / 'backend' / 'pyproject.toml'
    
    success = True
    
    # Update both files
    if not set_package_json_version(version, package_json):
        success = False
    
    if not set_pyproject_version(version, pyproject_toml):
        success = False
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
