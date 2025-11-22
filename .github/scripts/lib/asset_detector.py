"""
Asset type detection and metadata extraction.

Maps release asset filenames to OS, architecture, and kind.
"""

from pathlib import Path
from typing import Dict, Optional


def detect_asset_type(filename: str) -> Dict[str, str]:
    """
    Detect asset type from filename.
    
    Args:
        filename: Name of the asset file
        
    Returns:
        Dictionary with 'os', 'id', 'kind' keys
        
    Examples:
        >>> detect_asset_type('Sigilweaver-Setup-v0.2.5.exe')
        {'os': 'windows', 'id': 'windowsSetup', 'kind': 'installer'}
        
        >>> detect_asset_type('Sigilweaver-v0.2.5-x64.AppImage')
        {'os': 'linux', 'id': 'linuxAppImage', 'kind': 'image'}
    """
    name_lower = filename.lower()
    
    # Windows executables
    if filename.endswith('.exe'):
        if 'setup' in name_lower:
            return {'os': 'windows', 'id': 'windowsSetup', 'kind': 'installer'}
        elif 'portable' in name_lower:
            return {'os': 'windows', 'id': 'windowsPortable', 'kind': 'installer'}
        else:
            return {'os': 'windows', 'id': 'windowsInstaller', 'kind': 'installer'}
    
    # macOS disk images
    elif filename.endswith('.dmg'):
        return {'os': 'macos', 'id': 'macDmg', 'kind': 'image'}
    
    # Linux AppImage
    elif filename.endswith('.AppImage') or filename.endswith('.appimage'):
        return {'os': 'linux', 'id': 'linuxAppImage', 'kind': 'image'}
    
    # Linux Snap
    elif filename.endswith('.snap'):
        return {'os': 'linux', 'id': 'linuxSnap', 'kind': 'image'}
    
    # Web archive
    elif filename.endswith('.zip') and 'web' in name_lower:
        return {'os': 'web', 'id': 'webZip', 'kind': 'archive'}
    
    # Generic archive
    elif filename.endswith('.zip'):
        return {'os': 'any', 'id': 'archive', 'kind': 'archive'}
    
    # Unknown type
    else:
        ext = Path(filename).suffix.lstrip('.')
        return {'os': 'unknown', 'id': ext or 'file', 'kind': 'file'}


def is_variant(filename: str, variant: str) -> bool:
    """
    Check if filename matches a variant (e.g., 'Client').
    
    Args:
        filename: Name of the asset file
        variant: Variant name to check for
        
    Returns:
        True if filename contains the variant name
    """
    return variant.lower() in filename.lower()


def extract_version(filename: str) -> Optional[str]:
    """
    Extract version string from filename.
    
    Args:
        filename: Name of the asset file
        
    Returns:
        Version string (e.g., 'v0.2.5-alpha') or None if not found
    """
    import re
    
    # Match version patterns: v1.2.3 or v1.2.3-alpha or v1.2.3-beta.2
    # Prerelease tags are lowercase and separated by dots or hyphens
    match = re.search(r'v\d+\.\d+\.\d+(?:-[a-z][a-z0-9]*(?:\.[a-z0-9]+)*)?', filename, re.IGNORECASE)
    if match:
        version = match.group(0)
        # Stop at file extension (dots followed by uppercase like .AppImage, .exe)
        # Remove trailing parts that look like file extensions
        version = re.sub(r'\.[A-Z][a-zA-Z]*$', '', version)
        version = re.sub(r'\.(exe|dmg|zip|tar|gz)$', '', version, flags=re.IGNORECASE)
        return version
    
    return None
