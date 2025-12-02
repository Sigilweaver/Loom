"""Security utilities for file path validation"""

from pathlib import Path

from fastapi import HTTPException

from app.config import settings


def validate_file_path(file_path: str) -> Path:
    """
    Validate file path for security.
    
    Checks:
    - File exists
    - Is a file (not directory)
    - Is within allowed paths (if restrictions enabled)
    
    Args:
        file_path: Path to validate
        
    Returns:
        Resolved Path object
        
    Raises:
        HTTPException: If validation fails
    """
    try:
        path = Path(file_path).resolve()
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid file path: {str(e)}"
        )

    # Check if file exists
    if not path.exists():
        raise HTTPException(
            status_code=404, detail=f"File not found: {file_path}"
        )

    # Check if it's a file
    if not path.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {file_path}")

    # Check if path is allowed (if restrictions enabled)
    if settings.restrict_file_access and settings.allowed_file_paths:
        allowed = False
        for allowed_path_str in settings.allowed_file_paths:
            allowed_path = Path(allowed_path_str).resolve()
            try:
                # Check if path is relative to (within) allowed path
                path.relative_to(allowed_path)
                allowed = True
                break
            except ValueError:
                # Not relative to this allowed path, try next
                continue

        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=f"File path not allowed. Must be within: {settings.allowed_file_paths}",
            )

    return path
