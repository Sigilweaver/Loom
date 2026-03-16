"""Security utilities for file path validation"""

import contextvars
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException

from app.config import settings


@dataclass
class FilePathGrant:
    """A file path grant with read-only flag for Hub mode."""

    path: str
    read_only: bool


# Context variable for per-request allowed file paths (used in Hub mode)
# When set, file access is restricted to these paths for the current request
# Stores list of FilePathGrant objects with read_only flag
allowed_paths_context: contextvars.ContextVar[list[FilePathGrant] | None] = contextvars.ContextVar(
    "allowed_paths_context", default=None
)


def validate_file_path(file_path: str) -> Path:
    """
    Validate file path for security (read operations).

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
        raise HTTPException(status_code=400, detail=f"Invalid file path: {str(e)}")

    # Check if file exists
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    # Check if it's a file
    if not path.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {file_path}")

    # Hub mode: Check against per-request grants (always enforced when context is set)
    context_grants = allowed_paths_context.get()
    if context_grants is not None:
        if not context_grants:
            raise HTTPException(
                status_code=403,
                detail="File access denied: no file paths granted",
            )
        grant_paths = [g.path for g in context_grants]
        if not _is_path_in_allowlist(path, grant_paths):
            raise HTTPException(
                status_code=403,
                detail="File path not allowed. Must be within granted paths.",
            )

    # Server-level restriction: Additional admin guard (independent of Hub mode)
    if settings.restrict_file_access and settings.allowed_file_paths:
        if not _is_path_in_allowlist(path, settings.allowed_file_paths):
            raise HTTPException(
                status_code=403,
                detail=f"File path not allowed. Must be within: {settings.allowed_file_paths}",
            )

    return path


def validate_file_path_for_write(file_path: str) -> Path:
    """
    Validate file path for security (write operations).

    Similar to validate_file_path but:
    - Does NOT require file to exist (creating new file)
    - Checks read_only flag on grants
    - Validates the parent directory exists or can be created

    Args:
        file_path: Path to validate for writing

    Returns:
        Resolved Path object

    Raises:
        HTTPException: If validation fails
    """
    try:
        path = Path(file_path).resolve()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid file path: {str(e)}")

    # Hub mode: Check against per-request grants with read_only check
    context_grants = allowed_paths_context.get()
    if context_grants is not None:
        if not context_grants:
            raise HTTPException(
                status_code=403,
                detail="File access denied: no file paths granted",
            )

        # Find the grant that matches this path
        matching_grant: FilePathGrant | None = None
        for grant in context_grants:
            grant_path = Path(grant.path).resolve()
            try:
                path.relative_to(grant_path)
                matching_grant = grant
                break
            except ValueError:
                continue

        if not matching_grant:
            raise HTTPException(
                status_code=403,
                detail="File path not allowed. Must be within granted paths.",
            )

        if matching_grant.read_only:
            raise HTTPException(
                status_code=403,
                detail="Cannot write to read-only path.",
            )

    # Server-level restriction: Additional admin guard (independent of Hub mode)
    if settings.restrict_file_access and settings.allowed_file_paths:
        if not _is_path_in_allowlist(path, settings.allowed_file_paths):
            raise HTTPException(
                status_code=403,
                detail=f"File path not allowed. Must be within: {settings.allowed_file_paths}",
            )

    return path


def _is_path_in_allowlist(path: Path, allowed_paths: list[str]) -> bool:
    """Check if a resolved path is within any of the allowed paths."""
    for allowed_path_str in allowed_paths:
        allowed_path = Path(allowed_path_str).resolve()
        try:
            path.relative_to(allowed_path)
            return True
        except ValueError:
            continue
    return False
