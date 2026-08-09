"""
CacheManager - Decides what to cache and manages lineage hashes.

Separated from executor to:
1. Enable different caching strategies (memory, disk, distributed)
2. Isolate lineage computation logic
3. Support cache warming and precomputation
"""

import logging
from pathlib import Path
from typing import Any

import polars as pl

from app.api.models.workflow import Tool
from app.config import settings
from app.domain.execution.cache import BlockingToolCache
from app.domain.execution.planner import ExecutionPlan
from app.domain.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class CacheManager:
    """
    Manages caching decisions and lineage tracking.

    Responsibilities:
    - Compute lineage hashes for tools
    - Determine if a tool should be cached
    - Check cache hits and store results
    - Track lineage hashes for all tools (even non-cached ones)

    The CacheManager is initialized per-workflow and tracks state across
    tool executions within that workflow.
    """

    def __init__(self, workflow_id: str, force_refresh: bool = False):
        """
        Initialize cache manager for a workflow.

        Args:
            workflow_id: Unique identifier for the workflow
            force_refresh: If True, clears existing cache
        """
        self.workflow_id = workflow_id
        self._cache: BlockingToolCache | None = None
        self._lineage_hashes: dict[str, str] = {}

        # Initialize disk cache if enabled
        if settings.cache_enabled:
            try:
                self._cache = BlockingToolCache(
                    Path(settings.cache_path),
                    workflow_id,
                )
                if force_refresh:
                    self._cache.clear()
                    logger.info(f"Cache cleared for workflow {workflow_id} (force_refresh)")
            except Exception as e:
                logger.error(f"Failed to initialize cache: {e}")
                self._cache = None

    @property
    def is_enabled(self) -> bool:
        """Check if caching is enabled and initialized."""
        return self._cache is not None

    @property
    def lineage_hashes(self) -> dict[str, str]:
        """Get all computed lineage hashes."""
        return self._lineage_hashes.copy()

    def compute_lineage_hash(
        self,
        tool: Tool,
        plan: ExecutionPlan,
        invalidate_stale: bool = True,
    ) -> str:
        """
        Compute lineage hash for a tool.

        This hash represents the full computation lineage - it includes
        the tool's own config AND all upstream state via upstream hashes.
        Any change to upstream tools automatically changes this hash.

        Args:
            tool: Tool to compute hash for
            plan: Execution plan containing dependency information
            invalidate_stale: If True, remove stale cache files for this tool

        Returns:
            16-character hex string hash
        """
        if not self._cache:
            return ""

        # Get upstream tool IDs from the plan
        upstream_ids = plan.get_dependencies(tool.id)
        upstream_keys = [self._lineage_hashes.get(tid, "") for tid in upstream_ids]

        # Hash only the cache-relevant subset of config so cosmetic
        # edits (rename, UI flags) do not bust downstream caches. Falls
        # back to the full config when the tool type is not registered or
        # when cache_keys() raises.
        cache_config: dict[str, Any] = tool.config
        try:
            tool_impl = ToolRegistry.get(tool.type)
            cache_config = tool_impl.cache_keys(tool.config)
        except Exception as e:
            logger.debug(
                f"cache_keys() unavailable for {tool.type}, hashing full config: {e}"
            )

        lineage_hash = self._cache.compute_key(tool.id, tool.type, cache_config, upstream_keys)

        # Clean up stale cache files that don't match current lineage
        if invalidate_stale:
            self._cache.invalidate_stale(tool.id, lineage_hash)

        return lineage_hash

    def should_cache_tool(self, tool: Tool) -> bool:
        """
        Determine if a tool's output should be cached.

        Caching is appropriate for "blocking" tools that require full
        materialization (sort, summarize, join) to avoid re-computation.

        Args:
            tool: Tool to check

        Returns:
            True if tool output should be cached
        """
        if not self._cache:
            return False

        try:
            tool_impl = ToolRegistry.get(tool.type)
            return tool_impl.should_cache(tool.config)
        except Exception as e:
            logger.debug(f"should_cache check failed for tool {tool.id}: {e}")
            return False

    def check_cache(
        self,
        tool: Tool,
        lineage_hash: str,
    ) -> dict[str, pl.LazyFrame] | None:
        """
        Check if tool outputs exist in cache.

        Args:
            tool: Tool to check cache for
            lineage_hash: Precomputed lineage hash

        Returns:
            Dict of socket_id -> LazyFrame if all outputs cached, None otherwise
        """
        if not self._cache or not lineage_hash:
            return None

        # Get expected output sockets from tool definition
        output_sockets = [s.id for s in tool.sockets if s.direction == "output"]

        # Check if all outputs are cached
        all_cached = all(self._cache.exists(tool.id, sid, lineage_hash) for sid in output_sockets)

        if not all_cached:
            return None

        # Try to read all cached outputs
        cached_outputs = {}
        for sid in output_sockets:
            cached_lf = self._cache.get(tool.id, sid, lineage_hash)
            if cached_lf is None:
                # Cache read failed, invalidate
                return None
            cached_outputs[sid] = cached_lf

        return cached_outputs

    def store_in_cache(
        self,
        tool: Tool,
        lineage_hash: str,
        outputs: dict[str, pl.LazyFrame],
    ) -> dict[str, pl.LazyFrame]:
        """
        Store tool outputs in cache.

        After storing, returns LazyFrames that scan from cache files
        (more efficient for downstream operations).

        Args:
            tool: Tool whose outputs to cache
            lineage_hash: Precomputed lineage hash
            outputs: Dict of socket_id -> LazyFrame to cache

        Returns:
            Dict of socket_id -> LazyFrame (reading from cache files)
        """
        if not self._cache or not lineage_hash:
            return outputs

        try:
            result = {}
            for socket_id, lf in outputs.items():
                self._cache.put(tool.id, socket_id, lineage_hash, lf)
                # Re-read from cache to get a scannable LazyFrame
                cached_lf = self._cache.get(tool.id, socket_id, lineage_hash)
                result[socket_id] = cached_lf if cached_lf is not None else lf
            logger.debug(f"Cached outputs for tool {tool.id}")
            return result
        except Exception as e:
            # Cache write failed, but we have the computed result
            logger.warning(f"Failed to cache outputs for tool {tool.id}: {e}")
            return outputs

    def record_lineage_hash(self, tool_id: str, lineage_hash: str) -> None:
        """
        Record lineage hash for a tool (even if not cached).

        This is critical for downstream tools to compute their own hashes.

        Args:
            tool_id: Tool ID
            lineage_hash: Computed lineage hash
        """
        self._lineage_hashes[tool_id] = lineage_hash

    def get_cache_stats(self) -> dict[str, Any]:
        """
        Get statistics about the cache.

        Returns:
            Dict with cache statistics
        """
        if not self._cache:
            return {
                "enabled": False,
                "workflow_id": self.workflow_id,
            }

        stats = self._cache.get_cache_stats()
        stats["enabled"] = True
        return stats

    def clear(self) -> None:
        """Clear all cached data for this workflow."""
        if self._cache:
            self._cache.clear()
            logger.info(f"Cache cleared for workflow {self.workflow_id}")
        self._lineage_hashes.clear()
