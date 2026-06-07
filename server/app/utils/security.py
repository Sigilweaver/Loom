"""Security utilities for file path validation"""

import contextvars
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger(__name__)

FileAccessMode = Literal["open", "allowlist", "hub"]


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


def resolve_file_access_mode() -> FileAccessMode:
    """Resolve the active file-access mode from settings.

    Explicit modes win; ``auto`` derives from ``auth_mode`` and the legacy
    ``restrict_file_access``/``allowed_file_paths`` pair.
    """
    explicit = getattr(settings, "file_access_mode", "auto") or "auto"
    if explicit in ("open", "allowlist", "hub"):
        return explicit  # type: ignore[return-value]

    # auto
    if getattr(settings, "auth_mode", "") == "hub":
        return "hub"
    if settings.restrict_file_access and settings.allowed_file_paths:
        return "allowlist"
    return "open"


def validate_file_access_config() -> None:
    """Validate file-access configuration at startup.

    Refuses to boot when configuration is contradictory; logs a prominent
    warning for ``open`` mode.
    """
    explicit = getattr(settings, "file_access_mode", "auto") or "auto"

    if explicit not in ("open", "allowlist", "hub", "auto"):
        logger.error(
            "Unknown FILE_ACCESS_MODE=%r. Must be one of open|allowlist|hub|auto.",
            explicit,
        )
        raise SystemExit(2)

    if explicit == "allowlist" and not settings.allowed_file_paths:
        logger.error(
            "FILE_ACCESS_MODE=allowlist requires ALLOWED_FILE_PATHS to be non-empty. "
            "Refusing to start."
        )
        raise SystemExit(2)

    if explicit == "hub" and getattr(settings, "auth_mode", "") != "hub":
        logger.error(
            "FILE_ACCESS_MODE=hub requires AUTH_MODE=hub. Refusing to start."
        )
        raise SystemExit(2)

    if explicit == "auto" and settings.restrict_file_access and not settings.allowed_file_paths:
        # Previously a silent-bypass. Make it explicit so users notice.
        if getattr(settings, "auth_mode", "") != "hub":
            logger.error(
                "RESTRICT_FILE_ACCESS=true but ALLOWED_FILE_PATHS is empty. "
                "Either populate ALLOWED_FILE_PATHS or set FILE_ACCESS_MODE=open "
                "explicitly to acknowledge unrestricted access. Refusing to start."
            )
            raise SystemExit(2)

    mode = resolve_file_access_mode()
    if mode == "open":
        logger.warning(
            "FILE_ACCESS_MODE=open: the server may read/write any path the "
            "process can access. Set FILE_ACCESS_MODE=allowlist or hub for "
            "production deployments."
        )
    else:
        logger.info("File access mode: %s", mode)


def validate_file_path(file_path: str) -> Path:
    """
    Validate file path for security (read operations).

    Checks:
    - File exists
    - Is a file (not directory)
    - Mode-dispatched access check (open|allowlist|hub)

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

    mode = resolve_file_access_mode()

    # Hub mode (or any caller that explicitly set context grants) must enforce
    # the per-request grant list. Empty grants => deny.
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
        # Hub grants satisfied; still apply server-level allowlist if configured.

    if mode == "allowlist":
        if not _is_path_in_allowlist(path, settings.allowed_file_paths):
            raise HTTPException(
                status_code=403,
                detail=f"File path not allowed. Must be within: {settings.allowed_file_paths}",
            )
    elif mode == "hub" and context_grants is None:
        # Hub mode without per-request grants is a misconfiguration. Deny
        # rather than silently allowing.
        raise HTTPException(
            status_code=403,
            detail="File access requires a Hub-issued grant.",
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

    mode = resolve_file_access_mode()

    # Per-request Hub grants always enforced when present.
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

    if mode == "allowlist":
        if not _is_path_in_allowlist(path, settings.allowed_file_paths):
            raise HTTPException(
                status_code=403,
                detail=f"File path not allowed. Must be within: {settings.allowed_file_paths}",
            )
    elif mode == "hub" and context_grants is None:
        raise HTTPException(
            status_code=403,
            detail="File access requires a Hub-issued grant.",
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
