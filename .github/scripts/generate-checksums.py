#!/usr/bin/env python3
"""
Generate SHA256SUMS.txt with generic filenames (no version strings).

This ensures checksums match the actual filenames in latest/ directory.
"""

import hashlib
import sys
from pathlib import Path

# Add lib directory to path for strip_version_from_filename
sys.path.insert(0, str(Path(__file__).parent))
from lib.manifest_builder import strip_version_from_filename


def compute_sha256(filepath: Path) -> str:
    """Compute SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def main():
    if len(sys.argv) < 2:
        print("Usage: generate-checksums.py <assets_dir>")
        print("Example: generate-checksums.py release-assets/")
        return 1
    
    assets_dir = Path(sys.argv[1])
    
    if not assets_dir.exists() or not assets_dir.is_dir():
        print(f"Error: {assets_dir} is not a valid directory")
        return 1
    
    checksums = []
    
    # Process all files except existing checksums
    for file in sorted(assets_dir.iterdir()):
        if not file.is_file():
            continue
        
        # Skip existing checksums and manifests
        if file.name in ('SHA256SUMS.txt', 'downloads.json'):
            continue
        
        # Compute hash
        sha256 = compute_sha256(file)
        
        # Use generic filename (no version)
        generic_name = strip_version_from_filename(file.name)
        
        checksums.append(f"{sha256}  {generic_name}\n")
    
    # Write to SHA256SUMS.txt
    output_path = assets_dir / 'SHA256SUMS.txt'
    with open(output_path, 'w') as f:
        f.writelines(checksums)
    
    print(f"Generated {output_path} with {len(checksums)} checksums")
    print("Files:")
    for line in checksums:
        print(f"  {line.strip()}")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
