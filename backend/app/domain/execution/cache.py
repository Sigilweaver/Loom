"""Blocking tool cache - caches output of blocking operations to disk"""

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import polars as pl

logger = logging.getLogger(__name__)


def get_file_access_time(path: Path) -> float:
    """
    Get file access time, preferring atime but falling back to mtime.

    Some filesystems disable atime for performance. This function tries
    atime first, but if it equals mtime (common when atime is disabled),
    falls back to mtime which is always reliable.

    Args:
        path: Path to the file

    Returns:
        Unix timestamp of last access/modification
    """
    stat = path.stat()
    # If atime equals mtime, atime tracking is likely disabled
    # In that case, mtime is more meaningful
    if stat.st_atime == stat.st_mtime:
        return stat.st_mtime
    return stat.st_atime


class BlockingToolCache:
    """
    Disk-based cache for blocking tool outputs.

    Blocking operations (sort, summarize, join) require full data materialization,
    breaking Polars streaming optimization. By caching their outputs to disk,
    subsequent previews of downstream tools can read from cache instead of
    re-executing the entire upstream chain.

    Cache keys are computed from tool configuration AND upstream lineage,
    ensuring automatic invalidation when any upstream tool changes.
    """

    def __init__(self, cache_root: Path, workflow_id: str):
        """
        Initialize cache for a specific workflow.

        Args:
            cache_root: Root directory for all workflow caches
            workflow_id: Unique identifier for the workflow
        """
        self.cache_root = cache_root
        self.workflow_id = workflow_id
        self.cache_dir = cache_root / workflow_id
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Clean up orphaned temp files from interrupted writes
        for orphan in self.cache_dir.glob("*.tmp"):
            try:
                orphan.unlink(missing_ok=True)
            except Exception as e:
                logger.warning(f"Failed to clean up orphan temp file {orphan}: {e}")

    def compute_key(
        self,
        tool_id: str,
        tool_type: str,
        tool_config: dict[str, Any],
        upstream_keys: list[str],
        source_mtime: float | None = None,
    ) -> str:
        """
        Compute deterministic lineage hash for a tool.

        This hash represents the full computation lineage - it includes
        the tool's own config AND all upstream state via upstream_keys.
        Any change to upstream tools automatically changes this hash.

        Args:
            tool_id: Unique identifier for the tool instance
            tool_type: Tool type (e.g., "Sort", "Input")
            tool_config: Tool's configuration dictionary
            upstream_keys: List of lineage hashes from upstream tools
            source_mtime: File modification time for file inputs (invalidates on file change)

        Returns:
            16-character hex string hash
        """
        key_data = {
            "tool_id": tool_id,
            "tool_type": tool_type,
            "config": tool_config,
            "upstream": sorted(upstream_keys),
            "mtime": source_mtime,
        }
        key_json = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.sha256(key_json.encode()).hexdigest()[:16]

    def cache_path(self, tool_id: str, socket_id: str, cache_key: str) -> Path:
        """
        Get path to cache file for a specific output socket.

        Args:
            tool_id: Tool identifier
            socket_id: Output socket identifier
            cache_key: Lineage hash

        Returns:
            Path to the Parquet cache file
        """
        # Sanitize socket_id to be filesystem-safe (replace problematic chars)
        safe_socket_id = socket_id.replace("-", "_")
        return self.cache_dir / f"{tool_id}_{safe_socket_id}_{cache_key}.parquet"

    def exists(self, tool_id: str, socket_id: str, cache_key: str) -> bool:
        """
        Check if cache entry exists for a specific socket.

        Args:
            tool_id: Tool identifier
            socket_id: Output socket identifier
            cache_key: Lineage hash

        Returns:
            True if cache file exists
        """
        return self.cache_path(tool_id, socket_id, cache_key).exists()

    def get(self, tool_id: str, socket_id: str, cache_key: str) -> pl.LazyFrame | None:
        """
        Load cached result for a specific socket if exists.

        Args:
            tool_id: Tool identifier
            socket_id: Output socket identifier
            cache_key: Lineage hash

        Returns:
            LazyFrame if cache exists, None otherwise
        """
        path = self.cache_path(tool_id, socket_id, cache_key)
        if path.exists():
            try:
                return pl.scan_parquet(path)
            except Exception as e:
                logger.warning(f"Failed to read cache file {path}: {e}")
                # Remove corrupted cache file
                try:
                    path.unlink(missing_ok=True)
                except Exception:
                    pass
                return None
        return None

    def put(
        self, tool_id: str, socket_id: str, cache_key: str, lf: pl.LazyFrame
    ) -> None:
        """
        Write result to cache for a specific socket.

        This collects the LazyFrame and writes it to disk as Parquet.
        Uses atomic write (temp file + rename) to prevent corruption
        if two processes write simultaneously.

        Args:
            tool_id: Tool identifier
            socket_id: Output socket identifier
            cache_key: Lineage hash
            lf: LazyFrame to cache
        """
        final_path = self.cache_path(tool_id, socket_id, cache_key)
        temp_path = final_path.with_suffix(".tmp")

        try:
            # Collect and write to temp file first
            df = lf.collect()
            df.write_parquet(temp_path)

            # Use os.replace() for atomic swap (works on both POSIX and Windows)
            os.replace(temp_path, final_path)
            logger.debug(f"Cached {tool_id}/{socket_id} to {final_path}")
        except Exception as e:
            logger.error(f"Failed to write cache file {final_path}: {e}")
            # Clean up temp file if it exists
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                pass
            raise

    def invalidate_tool(self, tool_id: str) -> None:
        """
        Remove all cache entries for a tool.

        Args:
            tool_id: Tool identifier to invalidate
        """
        count = 0
        for path in self.cache_dir.glob(f"{tool_id}_*.parquet"):
            try:
                path.unlink()
                count += 1
            except Exception as e:
                logger.warning(f"Failed to delete cache file {path}: {e}")
        if count:
            logger.info(f"Invalidated {count} cache entries for tool {tool_id}")

    def clear(self) -> None:
        """
        Clear entire workflow cache.
        """
        import shutil

        if self.cache_dir.exists():
            try:
                shutil.rmtree(self.cache_dir)
                logger.info(f"Cleared cache for workflow {self.workflow_id}")
            except Exception as e:
                logger.error(f"Failed to clear cache directory {self.cache_dir}: {e}")
                raise

    def get_cache_stats(self) -> dict[str, Any]:
        """
        Get statistics about the cache.

        Returns:
            Dict with cache statistics (file count, total size, etc.)
        """
        if not self.cache_dir.exists():
            return {
                "workflow_id": self.workflow_id,
                "file_count": 0,
                "total_size_bytes": 0,
                "total_size_mb": 0.0,
            }

        files = list(self.cache_dir.glob("*.parquet"))
        total_size = sum(f.stat().st_size for f in files)

        return {
            "workflow_id": self.workflow_id,
            "file_count": len(files),
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
        }

    def invalidate_stale(self, tool_id: str, current_key: str) -> int:
        """
        Remove stale cache entries for a tool that don't match the current key.

        When a tool's lineage changes (upstream config changed), old cache files
        become stale. This method removes them to prevent unbounded disk growth.

        Args:
            tool_id: Tool identifier
            current_key: The current valid lineage hash

        Returns:
            Number of stale files removed
        """
        if not self.cache_dir.exists():
            return 0

        count = 0
        for path in self.cache_dir.glob(f"{tool_id}_*.parquet"):
            # Filename format: {tool_id}_{safe_socket_id}_{key}.parquet
            # The key is always the 16-char hash at the end before .parquet
            # We check if the filename ends with _{current_key}.parquet
            expected_suffix = f"_{current_key}.parquet"
            if not path.name.endswith(expected_suffix):
                try:
                    path.unlink()
                    count += 1
                    logger.debug(f"Removed stale cache file: {path.name}")
                except Exception as e:
                    logger.warning(f"Failed to delete stale cache file {path}: {e}")

        if count:
            logger.info(
                f"Invalidated {count} stale cache entries for tool {tool_id}"
            )
        return count


def cleanup_old_cache_files(cache_root: Path, retention_days: int) -> int:
    """
    Remove cache files older than the retention period.

    This is a global cleanup function that runs across all workflow caches.
    Should be called on application startup.

    Args:
        cache_root: Root directory containing all workflow cache directories
        retention_days: Delete files older than this many days (0 = skip cleanup)

    Returns:
        Number of files deleted
    """
    if retention_days <= 0:
        return 0

    if not cache_root.exists():
        return 0

    cutoff = time.time() - (retention_days * 86400)
    deleted = 0

    try:
        for workflow_dir in cache_root.iterdir():
            if not workflow_dir.is_dir():
                continue

            # Check each parquet file in the workflow cache
            for cache_file in workflow_dir.glob("*.parquet"):
                try:
                    if cache_file.stat().st_mtime < cutoff:
                        cache_file.unlink()
                        deleted += 1
                        logger.debug(f"Removed expired cache file: {cache_file}")
                except Exception as e:
                    logger.warning(f"Failed to check/delete cache file {cache_file}: {e}")

            # Remove empty workflow directories
            try:
                if workflow_dir.exists() and not any(workflow_dir.iterdir()):
                    workflow_dir.rmdir()
                    logger.debug(f"Removed empty cache directory: {workflow_dir}")
            except Exception as e:
                logger.warning(f"Failed to remove empty directory {workflow_dir}: {e}")

    except Exception as e:
        logger.error(f"Error during cache cleanup: {e}")

    if deleted:
        logger.info(f"TTL cleanup: removed {deleted} cache files older than {retention_days} days")

    return deleted


def enforce_cache_quota(cache_root: Path, max_size_bytes: int) -> int:
    """
    Enforce cache size quota using LRU eviction.

    When total cache size exceeds the quota, removes least-recently-used
    files until under the limit. Uses file access time (atime) if available,
    falling back to modification time (mtime).

    Args:
        cache_root: Root directory containing all workflow cache directories
        max_size_bytes: Maximum total cache size in bytes (0 = no limit)

    Returns:
        Number of files evicted
    """
    if max_size_bytes <= 0:
        return 0

    if not cache_root.exists():
        return 0

    # Collect all cache files with their size and access time
    cache_files: list[tuple[Path, int, float]] = []  # (path, size, access_time)

    try:
        for workflow_dir in cache_root.iterdir():
            if not workflow_dir.is_dir():
                continue
            for cache_file in workflow_dir.glob("*.parquet"):
                try:
                    stat = cache_file.stat()
                    access_time = get_file_access_time(cache_file)
                    cache_files.append((cache_file, stat.st_size, access_time))
                except Exception as e:
                    logger.warning(f"Failed to stat cache file {cache_file}: {e}")
    except Exception as e:
        logger.error(f"Error scanning cache files: {e}")
        return 0

    # Calculate total size
    total_size = sum(size for _, size, _ in cache_files)

    if total_size <= max_size_bytes:
        return 0

    # Sort by access time (oldest first = LRU)
    cache_files.sort(key=lambda x: x[2])

    evicted = 0
    for path, size, _ in cache_files:
        if total_size <= max_size_bytes:
            break

        try:
            path.unlink()
            total_size -= size
            evicted += 1
            logger.debug(f"LRU evicted cache file: {path}")
        except Exception as e:
            logger.warning(f"Failed to evict cache file {path}: {e}")

    # Clean up empty directories
    try:
        for workflow_dir in cache_root.iterdir():
            if workflow_dir.is_dir() and not any(workflow_dir.iterdir()):
                workflow_dir.rmdir()
                logger.debug(f"Removed empty cache directory: {workflow_dir}")
    except Exception:
        pass  # Best effort cleanup

    if evicted:
        logger.info(
            f"LRU eviction: removed {evicted} files to enforce "
            f"{max_size_bytes / (1024**3):.1f}GB quota"
        )

    return evicted


def get_global_cache_stats(cache_root: Path) -> dict[str, Any]:
    """
    Get statistics about the entire cache across all workflows.

    Args:
        cache_root: Root directory containing all workflow cache directories

    Returns:
        Dict with global cache statistics
    """
    if not cache_root.exists():
        return {
            "workflow_count": 0,
            "file_count": 0,
            "total_size_bytes": 0,
            "total_size_mb": 0.0,
            "total_size_gb": 0.0,
        }

    workflow_count = 0
    file_count = 0
    total_size = 0

    try:
        for workflow_dir in cache_root.iterdir():
            if not workflow_dir.is_dir():
                continue
            workflow_count += 1
            for cache_file in workflow_dir.glob("*.parquet"):
                try:
                    file_count += 1
                    total_size += cache_file.stat().st_size
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"Error getting cache stats: {e}")

    return {
        "workflow_count": workflow_count,
        "file_count": file_count,
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024**2), 2),
        "total_size_gb": round(total_size / (1024**3), 3),
    }
