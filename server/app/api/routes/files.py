"""File browser API routes for Hub-authenticated file browsing.

These endpoints allow Hub users to browse files on the Server within
their granted file paths. In hub mode, a browse token is validated
with Hub to get the user's file path grants. In other modes, browsing
uses the configured allowed_file_paths.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.domain.hub.client import BrowseValidationResult, FilePathGrant, get_hub_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])


# --- Models ---


class FileEntry(BaseModel):
    """A file or directory entry."""

    name: str
    path: str
    is_dir: bool
    size: int | None = None  # None for directories
    modified: datetime | None = None
    extension: str | None = None  # File extension without dot


class RootEntry(BaseModel):
    """A browsable root directory."""

    path: str
    read_only: bool


class ListResponse(BaseModel):
    """Response for directory listing."""

    path: str
    entries: list[FileEntry]
    read_only: bool


class StatResponse(BaseModel):
    """Response for file/directory stat."""

    path: str
    exists: bool
    is_file: bool | None = None
    is_dir: bool | None = None
    size: int | None = None
    modified: datetime | None = None
    extension: str | None = None
    read_only: bool = True


class BrowseContext(BaseModel):
    """Context from browse token validation."""

    user_id: str | None = None
    file_paths: list[FilePathGrant]


# --- Dependencies ---


async def get_browse_context(
    authorization: Annotated[str | None, Header()] = None,
) -> BrowseContext:
    """Get browse context from token validation.

    In hub mode, validates the browse token with Hub.
    In other modes, uses configured allowed_file_paths.

    Returns:
        BrowseContext with file path grants.

    Raises:
        HTTPException: If authentication fails.
    """
    # Non-hub modes: use static configuration
    if settings.auth_mode != "hub":
        # In disabled mode or with static paths configured
        file_paths = [
            FilePathGrant(path=p, read_only=False)
            for p in settings.allowed_file_paths
        ]
        return BrowseContext(user_id=None, file_paths=file_paths)

    # Hub mode: validate token
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header required for file browsing",
        )

    # Parse Bearer token
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format",
        )

    token = parts[1]

    # Get Hub client
    hub_client = get_hub_client()
    if not hub_client:
        raise HTTPException(
            status_code=503,
            detail="Hub client not configured",
        )

    # Validate with Hub
    result: BrowseValidationResult = await hub_client.validate_browse(token)

    if not result.valid:
        raise HTTPException(
            status_code=401,
            detail=result.error or "Invalid browse token",
        )

    return BrowseContext(
        user_id=result.user_id,
        file_paths=result.file_paths or [],
    )


# --- Helpers ---


def _is_path_allowed(path: Path, grants: list[FilePathGrant]) -> tuple[bool, bool]:
    """Check if a path is within any granted path.

    Args:
        path: The resolved path to check.
        grants: List of file path grants.

    Returns:
        Tuple of (allowed, read_only). If not allowed, read_only is True.
    """
    # Server-level restriction: optional admin guard (independent of Hub grants)
    if settings.restrict_file_access and settings.allowed_file_paths:
        admin_allowed = False
        for allowed_path_str in settings.allowed_file_paths:
            allowed_path = Path(allowed_path_str).resolve()
            try:
                path.relative_to(allowed_path)
                admin_allowed = True
                break
            except ValueError:
                continue
        if not admin_allowed:
            return False, True

    for grant in grants:
        grant_path = Path(grant.path).resolve()
        try:
            path.relative_to(grant_path)
            return True, grant.read_only
        except ValueError:
            continue
    return False, True


def _get_file_entry(path: Path) -> FileEntry:
    """Create a FileEntry from a Path."""
    stat = path.stat()
    is_dir = path.is_dir()

    return FileEntry(
        name=path.name,
        path=str(path),
        is_dir=is_dir,
        size=None if is_dir else stat.st_size,
        modified=datetime.fromtimestamp(stat.st_mtime),
        extension=path.suffix[1:] if path.suffix and not is_dir else None,
    )


# --- Routes ---


@router.get("/roots", response_model=list[RootEntry])
async def list_roots(
    ctx: Annotated[BrowseContext, Depends(get_browse_context)],
) -> list[RootEntry]:
    """List available root directories for browsing.

    Returns the root directories the user has access to based on their
    file path grants.
    """
    roots: list[RootEntry] = []

    for grant in ctx.file_paths:
        grant_path = Path(grant.path)
        # Only include existing directories
        if grant_path.exists() and grant_path.is_dir():
            resolved = grant_path.resolve()
            allowed, _ = _is_path_allowed(resolved, ctx.file_paths)
            if not allowed:
                continue
            roots.append(RootEntry(
                path=str(resolved),
                read_only=grant.read_only,
            ))

    return roots


@router.get("/list", response_model=ListResponse)
async def list_directory(
    path: str,
    ctx: Annotated[BrowseContext, Depends(get_browse_context)],
) -> ListResponse:
    """List contents of a directory.

    Args:
        path: Absolute path to the directory to list.

    Returns:
        Directory listing with file and subdirectory entries.

    Raises:
        HTTPException: If path is invalid, not allowed, or not a directory.
    """
    try:
        resolved = Path(path).resolve()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path: {e}")

    # Check if path is within grants
    allowed, read_only = _is_path_allowed(resolved, ctx.file_paths)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Path not within granted directories",
        )

    # Verify it exists and is a directory
    if not resolved.exists():
        raise HTTPException(status_code=404, detail="Directory not found")

    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    # List directory contents
    entries: list[FileEntry] = []
    try:
        for item in resolved.iterdir():
            try:
                # Harden against symlink-based metadata leakage:
                # only include entries whose resolved target is still allowed.
                resolved_item = item.resolve()
                item_allowed, _ = _is_path_allowed(resolved_item, ctx.file_paths)
                if not item_allowed:
                    continue

                # Use resolved item for stat/is_dir so symlink targets are only read
                # when they're still within grants.
                entries.append(_get_file_entry(resolved_item))
            except PermissionError:
                logger.debug(f"Permission denied for {item}")
            except OSError as e:
                logger.debug(f"Cannot stat {item}: {e}")
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail="Permission denied reading directory",
        )

    # Sort directories first, then by name (case-insensitive)
    entries.sort(key=lambda e: (not e.is_dir, e.name.lower()))

    return ListResponse(
        path=str(resolved),
        entries=entries,
        read_only=read_only,
    )


@router.get("/stat", response_model=StatResponse)
async def stat_path(
    path: str,
    ctx: Annotated[BrowseContext, Depends(get_browse_context)],
) -> StatResponse:
    """Get information about a file or directory.

    Args:
        path: Absolute path to stat.

    Returns:
        File/directory information.

    Raises:
        HTTPException: If path is invalid or not allowed.
    """
    try:
        resolved = Path(path).resolve()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path: {e}")

    # Check if path is within grants
    allowed, read_only = _is_path_allowed(resolved, ctx.file_paths)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Path not within granted directories",
        )

    # Basic response for non-existent paths
    if not resolved.exists():
        return StatResponse(
            path=str(resolved),
            exists=False,
            read_only=read_only,
        )

    # Get full stat info
    try:
        stat = resolved.stat()
        is_dir = resolved.is_dir()
        is_file = resolved.is_file()

        return StatResponse(
            path=str(resolved),
            exists=True,
            is_file=is_file,
            is_dir=is_dir,
            size=None if is_dir else stat.st_size,
            modified=datetime.fromtimestamp(stat.st_mtime),
            extension=resolved.suffix[1:] if resolved.suffix and is_file else None,
            read_only=read_only,
        )
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail="Permission denied accessing path",
        )
    except OSError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cannot stat path: {e}",
        )
