"""Blocking tool cache - caches output of blocking operations to disk"""

import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

import polars as pl

logger = logging.getLogger(__name__)


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
