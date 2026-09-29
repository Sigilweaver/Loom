"""File browser API routes for Hub-authenticated file browsing.

These endpoints allow Hub users to browse files on the Server within
their granted file paths. In hub mode, a browse token is authorized
with Hub to get the user's file path grants. In other modes, browsing
uses the configured allowed_file_paths.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.domain.hub.client import AuthorizationResult, FilePathGrant, get_hub_client
from app.utils.security import active_server_allowlist, is_path_in_allowlist

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


class SearchResultEntry(BaseModel):
    """A file matching a search query, with relevance score."""

    name: str
    path: str
    size: int | None = None
    modified: datetime | None = None
    extension: str | None = None
    score: float  # 0.0-1.0, higher = better match


class SearchResponse(BaseModel):
    """Response for file search."""

    query: str
    results: list[SearchResultEntry]
    total_files_scanned: int


class BrowseContext(BaseModel):
    """Context from browse token authorization."""

    user_id: str | None = None
    file_paths: list[FilePathGrant]


# --- Dependencies ---


async def get_browse_context(
    authorization: Annotated[str | None, Header()] = None,
) -> BrowseContext:
    """Get browse context from token authorization.

    In hub mode, authorizes the browse token with Hub.
    In other modes, uses configured allowed_file_paths.

    Returns:
        BrowseContext with file path grants.

    Raises:
        HTTPException: If authentication fails.
    """
    # Non-hub modes: use static configuration
    if settings.auth_mode != "hub":
        # In disabled mode or with static paths configured
        file_paths = [FilePathGrant(path=p, read_only=False) for p in settings.allowed_file_paths]
        return BrowseContext(user_id=None, file_paths=file_paths)

    # Hub mode: authorize token
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

    # Authorize with Hub (token is consumed - one-time use)
    result: AuthorizationResult = await hub_client.authorize(
        server_token=token,
        request_type="browse",
    )

    if not result.authorized:
        raise HTTPException(
            status_code=401,
            detail=result.error or "Invalid browse token",
        )

    fp = result.file_paths or []
    return BrowseContext(
        user_id=result.user_id,
        file_paths=fp,
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
    # Server-level restriction: optional admin guard (independent of Hub grants).
    # Same rule as execution-time path validation so browsing and running agree.
    server_allowlist = active_server_allowlist()
    if server_allowlist is not None and not is_path_in_allowlist(path, server_allowlist):
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
            roots.append(
                RootEntry(
                    path=str(resolved),
                    read_only=grant.read_only,
                )
            )

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


# --- Fuzzy search ---

# Default data file extensions the search targets
DATA_EXTENSIONS = frozenset(
    {
        "csv",
        "parquet",
        "xlsx",
        "xls",
        "json",
        "ndjson",
        "yxdb",
        "avro",
        "ipc",
        "arrow",
        "ods",
        "tsv",
        "db",
        "sqlite",
        "sqlite3",
    }
)

# Hard cap to prevent runaway recursion on huge filesystems
_MAX_SCAN = 10_000


def _fuzzy_score(query: str, name: str) -> float:
    """Score how well *query* matches *name*.

    Returns 0.0-1.0.  Higher is better.  0.0 means no match.

    Ranking tiers (from best to worst):
      1.0  -- exact match (ignoring case + extension)
      0.9  -- name starts with query
      0.8  -- query is a whole word in the name
      0.7  -- query is a substring of name
      0.3+ -- all query chars appear in order (subsequence match, score
              proportional to how compact the match is)
      0.0  -- no match
    """
    q = query.lower()
    # Strip extension for matching
    stem = Path(name).stem.lower()

    if q == stem:
        return 1.0
    if stem.startswith(q):
        return 0.9
    # Whole-word check: split on common separators
    words = set(stem.replace("-", "_").replace(".", "_").split("_"))
    if q in words:
        return 0.8
    if q in stem:
        return 0.7

    # Subsequence match
    qi = 0
    first_idx = -1
    last_idx = -1
    for si, ch in enumerate(stem):
        if qi < len(q) and ch == q[qi]:
            if first_idx == -1:
                first_idx = si
            last_idx = si
            qi += 1
    if qi == len(q) and len(q) > 0:
        # Score based on compactness: fewer gaps = higher score
        span = last_idx - first_idx + 1
        compactness = len(q) / span  # 1.0 when perfectly compact
        return 0.3 + 0.35 * compactness
    return 0.0


def _walk_data_files(
    root: Path,
    grants: list[FilePathGrant],
    extensions: frozenset[str],
    max_files: int = _MAX_SCAN,
) -> list[tuple[Path, float]]:
    """Recursively collect data files under *root* that are within grants.

    Returns list of (resolved_path, mtime_ts) tuples.
    Skips hidden directories (starting with `.`) and directories already visited
    through another path (symlink cycles).
    """
    results: list[tuple[Path, float]] = []
    # Resolved directories already walked. Symlinks are followed (when their target
    # is still granted), so without this a link back to an ancestor is re-scanned
    # at every depth, and several links multiply the work exponentially.
    visited: set[Path] = set()

    def _recurse(directory: Path, depth: int = 0) -> None:
        if depth > 20 or len(results) >= max_files:
            return
        if directory in visited:
            return
        visited.add(directory)
        try:
            for item in sorted(directory.iterdir(), key=lambda p: p.name.lower()):
                if len(results) >= max_files:
                    return
                # Skip hidden
                if item.name.startswith("."):
                    continue
                try:
                    resolved = item.resolve()
                    allowed, _ = _is_path_allowed(resolved, grants)
                    if not allowed:
                        continue
                    if resolved.is_dir():
                        _recurse(resolved, depth + 1)
                    elif resolved.is_file():
                        ext = resolved.suffix[1:].lower() if resolved.suffix else ""
                        if ext in extensions:
                            results.append((resolved, resolved.stat().st_mtime))
                except (PermissionError, OSError):
                    continue
        except (PermissionError, OSError):
            return

    _recurse(root)
    return results


@router.get("/search", response_model=SearchResponse)
async def search_files(
    query: Annotated[str, Query(description="Search query (filename or keyword)")],
    ctx: Annotated[BrowseContext, Depends(get_browse_context)],
    extensions: Annotated[
        str | None,
        Query(
            description=(
                "Comma-separated file extensions to include (default: common data formats)"
            ),
        ),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> SearchResponse:
    """Search for data files across all granted directories.

    Recursively scans all granted root directories for data files matching
    the query. Results are ranked by relevance:
      - Exact name match (highest)
      - Name starts with query
      - Query is a word in the filename
      - Query is a substring
      - Subsequence match (lowest)

    Args:
        query: Search text to match against filenames.
        extensions: Comma-separated extensions to filter (e.g. "csv,parquet").
                    Defaults to common data file extensions.
        limit: Max results to return (1-100, default 20).

    Returns:
        Ranked list of matching files.
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query parameter required")

    query_text = query.strip()

    # Determine target extensions
    if extensions:
        ext_set = frozenset(
            e.strip().lower().lstrip(".") for e in extensions.split(",") if e.strip()
        )
    else:
        ext_set = DATA_EXTENSIONS

    # Collect all data files from all granted roots
    all_files: list[tuple[Path, float]] = []
    seen_paths: set[str] = set()

    for grant in ctx.file_paths:
        grant_path = Path(grant.path).resolve()
        if not grant_path.exists() or not grant_path.is_dir():
            continue
        allowed, _ = _is_path_allowed(grant_path, ctx.file_paths)
        if not allowed:
            continue

        files = _walk_data_files(grant_path, ctx.file_paths, ext_set)
        for fpath, mtime in files:
            path_str = str(fpath)
            if path_str not in seen_paths:
                seen_paths.add(path_str)
                all_files.append((fpath, mtime))

    total_scanned = len(all_files)

    # Score and rank
    scored: list[tuple[Path, float, float]] = []  # (path, score, mtime)
    for fpath, mtime in all_files:
        score = _fuzzy_score(query_text, fpath.name)
        if score > 0.0:
            scored.append((fpath, score, mtime))

    # Sort by score desc, then by modified desc (newest first) as tiebreaker
    scored.sort(key=lambda t: (-t[1], -t[2]))

    # Build results
    results: list[SearchResultEntry] = []
    for fpath, score, mtime in scored[:limit]:
        try:
            stat = fpath.stat()
            results.append(
                SearchResultEntry(
                    name=fpath.name,
                    path=str(fpath),
                    size=stat.st_size,
                    modified=datetime.fromtimestamp(mtime),
                    extension=fpath.suffix[1:] if fpath.suffix else None,
                    score=round(score, 3),
                )
            )
        except OSError:
            continue

    return SearchResponse(
        query=query_text,
        results=results,
        total_files_scanned=total_scanned,
    )
