"""Tests for the blocking tool cache."""

import tempfile
from pathlib import Path

import polars as pl
import pytest

from app.domain.execution.cache import BlockingToolCache


@pytest.fixture
def temp_cache_dir():
    """Create a temporary directory for cache tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def cache(temp_cache_dir):
    """Create a cache instance for testing."""
    return BlockingToolCache(temp_cache_dir, "test-workflow-123")


@pytest.fixture
def sample_lazyframe():
    """Create a sample LazyFrame for testing."""
    return pl.LazyFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "value": [100.0, 200.0, 150.0, 300.0, 250.0],
    })


class TestBlockingToolCache:
    """Tests for BlockingToolCache class."""

    def test_init_creates_directory(self, temp_cache_dir):
        """Test that initializing cache creates the workflow directory."""
        cache = BlockingToolCache(temp_cache_dir, "my-workflow")
        assert cache.cache_dir.exists()
        assert cache.cache_dir == temp_cache_dir / "my-workflow"

    def test_compute_key_deterministic(self, cache):
        """Test that compute_key returns the same hash for the same inputs."""
        key1 = cache.compute_key(
            tool_id="sort-1",
            tool_type="Sort",
            tool_config={"sortColumns": [{"column": "name", "direction": "asc"}]},
            upstream_keys=["abc123"],
        )
        key2 = cache.compute_key(
            tool_id="sort-1",
            tool_type="Sort",
            tool_config={"sortColumns": [{"column": "name", "direction": "asc"}]},
            upstream_keys=["abc123"],
        )
        assert key1 == key2
        assert len(key1) == 16  # 16-char hex string

    def test_compute_key_changes_with_config(self, cache):
        """Test that compute_key changes when config changes."""
        key1 = cache.compute_key(
            tool_id="sort-1",
            tool_type="Sort",
            tool_config={"sortColumns": [{"column": "name", "direction": "asc"}]},
            upstream_keys=["abc123"],
        )
        key2 = cache.compute_key(
            tool_id="sort-1",
            tool_type="Sort",
            tool_config={"sortColumns": [{"column": "name", "direction": "desc"}]},
            upstream_keys=["abc123"],
        )
        assert key1 != key2

    def test_compute_key_changes_with_upstream(self, cache):
        """Test that compute_key changes when upstream keys change."""
        key1 = cache.compute_key(
            tool_id="sort-1",
            tool_type="Sort",
            tool_config={"sortColumns": [{"column": "name", "direction": "asc"}]},
            upstream_keys=["abc123"],
        )
        key2 = cache.compute_key(
            tool_id="sort-1",
            tool_type="Sort",
            tool_config={"sortColumns": [{"column": "name", "direction": "asc"}]},
            upstream_keys=["xyz789"],
        )
        assert key1 != key2

    def test_cache_path_format(self, cache):
        """Test that cache_path returns correct format."""
        path = cache.cache_path("tool-1", "output", "abc123")
        assert path.name == "tool-1_output_abc123.parquet"
        assert path.parent == cache.cache_dir

    def test_cache_path_sanitizes_socket_id(self, cache):
        """Test that cache_path sanitizes socket IDs with hyphens."""
        path = cache.cache_path("join-1", "output-left", "abc123")
        assert path.name == "join-1_output_left_abc123.parquet"

    def test_exists_false_when_not_cached(self, cache):
        """Test that exists returns False when cache file doesn't exist."""
        assert not cache.exists("tool-1", "output", "abc123")

    def test_get_returns_none_when_not_cached(self, cache):
        """Test that get returns None when cache file doesn't exist."""
        result = cache.get("tool-1", "output", "abc123")
        assert result is None

    def test_put_and_get_round_trip(self, cache, sample_lazyframe):
        """Test that put and get correctly round-trip data."""
        cache.put("sort-1", "output", "abc123", sample_lazyframe)

        assert cache.exists("sort-1", "output", "abc123")

        result = cache.get("sort-1", "output", "abc123")
        assert result is not None

        # Verify data matches
        original_df = sample_lazyframe.collect()
        cached_df = result.collect()
        assert original_df.equals(cached_df)

    def test_put_creates_parquet_file(self, cache, sample_lazyframe):
        """Test that put creates a parquet file on disk."""
        cache.put("sort-1", "output", "abc123", sample_lazyframe)

        expected_path = cache.cache_path("sort-1", "output", "abc123")
        assert expected_path.exists()
        assert expected_path.suffix == ".parquet"

    def test_invalidate_tool_removes_all_sockets(self, cache, sample_lazyframe):
        """Test that invalidate_tool removes all cache entries for a tool."""
        # Cache multiple sockets for the same tool
        cache.put("join-1", "output-left", "abc123", sample_lazyframe)
        cache.put("join-1", "output-match", "abc123", sample_lazyframe)
        cache.put("join-1", "output-right", "abc123", sample_lazyframe)

        # Cache for different tool
        cache.put("sort-1", "output", "def456", sample_lazyframe)

        # Verify all cached
        assert cache.exists("join-1", "output-left", "abc123")
        assert cache.exists("join-1", "output-match", "abc123")
        assert cache.exists("join-1", "output-right", "abc123")
        assert cache.exists("sort-1", "output", "def456")

        # Invalidate join tool
        cache.invalidate_tool("join-1")

        # Verify join tool caches removed
        assert not cache.exists("join-1", "output-left", "abc123")
        assert not cache.exists("join-1", "output-match", "abc123")
        assert not cache.exists("join-1", "output-right", "abc123")

        # Verify other tool still cached
        assert cache.exists("sort-1", "output", "def456")

    def test_clear_removes_entire_workflow_cache(self, cache, sample_lazyframe):
        """Test that clear removes all cache files for the workflow."""
        # Cache multiple tools
        cache.put("sort-1", "output", "abc123", sample_lazyframe)
        cache.put("summarize-1", "output", "def456", sample_lazyframe)

        # Verify cached
        assert cache.exists("sort-1", "output", "abc123")
        assert cache.exists("summarize-1", "output", "def456")

        # Clear all
        cache.clear()

        # Verify all removed
        assert not cache.exists("sort-1", "output", "abc123")
        assert not cache.exists("summarize-1", "output", "def456")
        assert not cache.cache_dir.exists()

    def test_get_cache_stats(self, cache, sample_lazyframe):
        """Test that get_cache_stats returns correct information."""
        # Empty cache
        stats = cache.get_cache_stats()
        assert stats["workflow_id"] == "test-workflow-123"
        assert stats["file_count"] == 0
        assert stats["total_size_bytes"] == 0

        # After caching
        cache.put("sort-1", "output", "abc123", sample_lazyframe)
        cache.put("summarize-1", "output", "def456", sample_lazyframe)

        stats = cache.get_cache_stats()
        assert stats["file_count"] == 2
        assert stats["total_size_bytes"] > 0
        assert stats["total_size_mb"] >= 0

    def test_orphan_temp_file_cleanup(self, temp_cache_dir):
        """Test that orphaned temp files are cleaned up on init."""
        workflow_dir = temp_cache_dir / "cleanup-test"
        workflow_dir.mkdir(parents=True)

        # Create orphaned temp file
        orphan = workflow_dir / "tool-1_output_abc123.tmp"
        orphan.write_text("orphaned data")
        assert orphan.exists()

        # Init cache should clean up orphan
        BlockingToolCache(temp_cache_dir, "cleanup-test")
        assert not orphan.exists()


class TestBlockingToolCacheEdgeCases:
    """Edge case tests for BlockingToolCache."""

    def test_multiple_workflows_isolated(self, temp_cache_dir, sample_lazyframe):
        """Test that different workflows have isolated caches."""
        cache1 = BlockingToolCache(temp_cache_dir, "workflow-1")
        cache2 = BlockingToolCache(temp_cache_dir, "workflow-2")

        # Cache in workflow-1
        cache1.put("sort-1", "output", "abc123", sample_lazyframe)

        # Should exist in workflow-1, not in workflow-2
        assert cache1.exists("sort-1", "output", "abc123")
        assert not cache2.exists("sort-1", "output", "abc123")

    def test_empty_upstream_keys(self, cache):
        """Test compute_key with empty upstream keys (input tools)."""
        key = cache.compute_key(
            tool_id="input-1",
            tool_type="Input",
            tool_config={"source": "/path/to/file.csv"},
            upstream_keys=[],
        )
        assert len(key) == 16

    def test_compute_key_with_mtime(self, cache):
        """Test that source_mtime affects the key."""
        key1 = cache.compute_key(
            tool_id="input-1",
            tool_type="Input",
            tool_config={"source": "/path/to/file.csv"},
            upstream_keys=[],
            source_mtime=1000.0,
        )
        key2 = cache.compute_key(
            tool_id="input-1",
            tool_type="Input",
            tool_config={"source": "/path/to/file.csv"},
            upstream_keys=[],
            source_mtime=2000.0,
        )
        assert key1 != key2

    def test_complex_config_in_key(self, cache):
        """Test compute_key with complex nested config."""
        key = cache.compute_key(
            tool_id="summarize-1",
            tool_type="Summarize",
            tool_config={
                "groupByColumns": ["category", "region"],
                "aggregations": [
                    {"column": "amount", "operation": "Sum", "outputName": "total"},
                    {"column": "count", "operation": "Mean", "outputName": "avg_count"},
                ],
            },
            upstream_keys=["upstream1", "upstream2"],
        )
        assert len(key) == 16

    def test_upstream_keys_order_independent(self, cache):
        """Test that upstream key order doesn't affect hash (sorted internally)."""
        key1 = cache.compute_key(
            tool_id="join-1",
            tool_type="Join",
            tool_config={"leftKeys": ["id"]},
            upstream_keys=["aaa", "bbb", "ccc"],
        )
        key2 = cache.compute_key(
            tool_id="join-1",
            tool_type="Join",
            tool_config={"leftKeys": ["id"]},
            upstream_keys=["ccc", "aaa", "bbb"],
        )
        assert key1 == key2


class TestToolCachingBehavior:
    """Tests for tool caching behavior (is_blocking, should_cache)."""

    def test_sort_is_blocking(self):
        """Test that SortTool is marked as blocking."""
        from app.domain.tools.implementations.sort import SortTool
        tool = SortTool()
        assert tool.is_blocking() is True
        assert tool.should_cache({}) is True

    def test_summarize_is_blocking(self):
        """Test that SummarizeTool is marked as blocking."""
        from app.domain.tools.implementations.summarize import SummarizeTool
        tool = SummarizeTool()
        assert tool.is_blocking() is True
        assert tool.should_cache({}) is True

    def test_join_is_blocking(self):
        """Test that JoinTool is marked as blocking."""
        from app.domain.tools.implementations.join import JoinTool
        tool = JoinTool()
        assert tool.is_blocking() is True
        assert tool.should_cache({}) is True

    def test_input_file_not_cached(self):
        """Test that file Input tools are not cached."""
        from app.domain.tools.implementations.input import InputTool
        tool = InputTool()
        assert tool.is_blocking() is False
        assert tool.should_cache({"category": "file"}) is False

    def test_input_database_cached(self):
        """Test that database Input tools are cached."""
        from app.domain.tools.implementations.input import InputTool
        tool = InputTool()
        assert tool.is_blocking() is False
        assert tool.should_cache({"category": "database"}) is True

    def test_filter_not_blocking(self):
        """Test that FilterTool is not blocking."""
        from app.domain.tools.implementations.filter import FilterTool
        tool = FilterTool()
        assert tool.is_blocking() is False
        assert tool.should_cache({}) is False

    def test_select_not_blocking(self):
        """Test that SelectTool is not blocking."""
        from app.domain.tools.implementations.select import SelectTool
        tool = SelectTool()
        assert tool.is_blocking() is False
        assert tool.should_cache({}) is False

    def test_formula_not_blocking(self):
        """Test that FormulaTool is not blocking."""
        from app.domain.tools.implementations.formula import FormulaTool
        tool = FormulaTool()
        assert tool.is_blocking() is False
        assert tool.should_cache({}) is False

    def test_sample_first_n_not_blocking(self):
        """Test that SampleTool with FirstN mode is not blocking."""
        from app.domain.tools.implementations.sample import SampleTool
        tool = SampleTool()
        assert tool.is_blocking({"mode": "FirstN"}) is False
        assert tool.should_cache({"mode": "FirstN"}) is False

    def test_sample_every_n_not_blocking(self):
        """Test that SampleTool with EveryN mode is not blocking."""
        from app.domain.tools.implementations.sample import SampleTool
        tool = SampleTool()
        assert tool.is_blocking({"mode": "EveryN"}) is False
        assert tool.should_cache({"mode": "EveryN"}) is False

    def test_sample_last_n_is_blocking(self):
        """Test that SampleTool with LastN mode is blocking."""
        from app.domain.tools.implementations.sample import SampleTool
        tool = SampleTool()
        assert tool.is_blocking({"mode": "LastN"}) is True
        assert tool.should_cache({"mode": "LastN"}) is True

    def test_sample_random_is_blocking(self):
        """Test that SampleTool with Random mode is blocking."""
        from app.domain.tools.implementations.sample import SampleTool
        tool = SampleTool()
        assert tool.is_blocking({"mode": "Random"}) is True
        assert tool.should_cache({"mode": "Random"}) is True

    def test_sample_random_percent_is_blocking(self):
        """Test that SampleTool with RandomPercent mode is blocking."""
        from app.domain.tools.implementations.sample import SampleTool
        tool = SampleTool()
        assert tool.is_blocking({"mode": "RandomPercent"}) is True
        assert tool.should_cache({"mode": "RandomPercent"}) is True

    def test_sample_first_percent_is_blocking(self):
        """Test that SampleTool with FirstPercent mode is blocking."""
        from app.domain.tools.implementations.sample import SampleTool
        tool = SampleTool()
        assert tool.is_blocking({"mode": "FirstPercent"}) is True
        assert tool.should_cache({"mode": "FirstPercent"}) is True


class TestCacheEviction:
    """Tests for cache eviction strategies."""

    def test_invalidate_stale_removes_old_keys(self, cache, sample_lazyframe):
        """Test that invalidate_stale removes files with different keys."""
        # Cache with old key
        cache.put("sort-1", "output", "old_key_123", sample_lazyframe)
        assert cache.exists("sort-1", "output", "old_key_123")

        # Invalidate stale with new key
        removed = cache.invalidate_stale("sort-1", "new_key_456")
        assert removed == 1
        assert not cache.exists("sort-1", "output", "old_key_123")

    def test_invalidate_stale_keeps_current_key(self, cache, sample_lazyframe):
        """Test that invalidate_stale keeps files matching current key."""
        # Cache with current key
        cache.put("sort-1", "output", "current_key", sample_lazyframe)
        assert cache.exists("sort-1", "output", "current_key")

        # Invalidate stale with same key
        removed = cache.invalidate_stale("sort-1", "current_key")
        assert removed == 0
        assert cache.exists("sort-1", "output", "current_key")

    def test_invalidate_stale_only_affects_target_tool(self, cache, sample_lazyframe):
        """Test that invalidate_stale only affects the specified tool."""
        # Cache for two different tools
        cache.put("sort-1", "output", "old_key", sample_lazyframe)
        cache.put("sort-2", "output", "old_key", sample_lazyframe)

        # Invalidate stale for sort-1 only
        removed = cache.invalidate_stale("sort-1", "new_key")
        assert removed == 1
        assert not cache.exists("sort-1", "output", "old_key")
        assert cache.exists("sort-2", "output", "old_key")

    def test_invalidate_stale_handles_multiple_sockets(self, cache, sample_lazyframe):
        """Test that invalidate_stale handles tools with multiple output sockets."""
        # Cache multiple sockets for same tool with old key
        cache.put("join-1", "left", "old_key", sample_lazyframe)
        cache.put("join-1", "match", "old_key", sample_lazyframe)
        cache.put("join-1", "right", "old_key", sample_lazyframe)

        # Invalidate stale
        removed = cache.invalidate_stale("join-1", "new_key")
        assert removed == 3

    def test_invalidate_stale_empty_cache(self, cache):
        """Test that invalidate_stale handles empty cache gracefully."""
        removed = cache.invalidate_stale("nonexistent", "key")
        assert removed == 0


class TestTTLCleanup:
    """Tests for TTL-based cache cleanup."""

    def test_cleanup_old_cache_files_removes_expired(self, temp_cache_dir, sample_lazyframe):
        """Test that cleanup removes files older than retention period."""
        import time
        from app.domain.execution.cache import cleanup_old_cache_files

        # Create a workflow cache with old file
        cache = BlockingToolCache(temp_cache_dir, "old-workflow")
        cache.put("sort-1", "output", "abc123", sample_lazyframe)

        # Manually set old mtime (8 days ago)
        cache_file = cache.cache_path("sort-1", "output", "abc123")
        old_time = time.time() - (8 * 86400)
        import os
        os.utime(cache_file, (old_time, old_time))

        # Cleanup with 7 day retention
        deleted = cleanup_old_cache_files(temp_cache_dir, 7)
        assert deleted == 1
        assert not cache.exists("sort-1", "output", "abc123")

    def test_cleanup_old_cache_files_keeps_recent(self, temp_cache_dir, sample_lazyframe):
        """Test that cleanup keeps files newer than retention period."""
        from app.domain.execution.cache import cleanup_old_cache_files

        # Create a workflow cache with recent file
        cache = BlockingToolCache(temp_cache_dir, "recent-workflow")
        cache.put("sort-1", "output", "abc123", sample_lazyframe)

        # Cleanup with 7 day retention (file is just created, should be kept)
        deleted = cleanup_old_cache_files(temp_cache_dir, 7)
        assert deleted == 0
        assert cache.exists("sort-1", "output", "abc123")

    def test_cleanup_old_cache_files_zero_retention(self, temp_cache_dir, sample_lazyframe):
        """Test that cleanup with 0 retention does nothing."""
        from app.domain.execution.cache import cleanup_old_cache_files

        cache = BlockingToolCache(temp_cache_dir, "workflow")
        cache.put("sort-1", "output", "abc123", sample_lazyframe)

        deleted = cleanup_old_cache_files(temp_cache_dir, 0)
        assert deleted == 0
        assert cache.exists("sort-1", "output", "abc123")

    def test_cleanup_old_cache_files_removes_empty_dirs(self, temp_cache_dir, sample_lazyframe):
        """Test that cleanup removes empty workflow directories."""
        import time
        import os
        from app.domain.execution.cache import cleanup_old_cache_files

        cache = BlockingToolCache(temp_cache_dir, "to-be-empty")
        cache.put("sort-1", "output", "abc123", sample_lazyframe)

        # Make file old
        cache_file = cache.cache_path("sort-1", "output", "abc123")
        old_time = time.time() - (8 * 86400)
        os.utime(cache_file, (old_time, old_time))

        # Cleanup
        cleanup_old_cache_files(temp_cache_dir, 7)

        # Directory should be removed
        assert not cache.cache_dir.exists()


class TestLRUEviction:
    """Tests for LRU-based cache quota enforcement."""

    def test_enforce_quota_evicts_when_over_limit(self, temp_cache_dir, sample_lazyframe):
        """Test that enforce_quota evicts files when over limit."""
        from app.domain.execution.cache import enforce_cache_quota

        # Create multiple cache files
        cache = BlockingToolCache(temp_cache_dir, "workflow")
        for i in range(5):
            cache.put(f"tool-{i}", "output", f"key{i}", sample_lazyframe)

        # Get current size
        files = list(cache.cache_dir.glob("*.parquet"))
        total_size = sum(f.stat().st_size for f in files)

        # Enforce a quota smaller than total size (half)
        quota = total_size // 2
        evicted = enforce_cache_quota(temp_cache_dir, quota)

        # Some files should be evicted
        assert evicted > 0

        # Remaining size should be under quota
        remaining_files = list(cache.cache_dir.glob("*.parquet"))
        remaining_size = sum(f.stat().st_size for f in remaining_files)
        assert remaining_size <= quota

    def test_enforce_quota_no_eviction_when_under_limit(self, temp_cache_dir, sample_lazyframe):
        """Test that enforce_quota does nothing when under limit."""
        from app.domain.execution.cache import enforce_cache_quota

        cache = BlockingToolCache(temp_cache_dir, "workflow")
        cache.put("sort-1", "output", "abc123", sample_lazyframe)

        # Enforce a large quota (1GB)
        evicted = enforce_cache_quota(temp_cache_dir, 1024**3)
        assert evicted == 0
        assert cache.exists("sort-1", "output", "abc123")

    def test_enforce_quota_zero_means_unlimited(self, temp_cache_dir, sample_lazyframe):
        """Test that quota of 0 means unlimited (no eviction)."""
        from app.domain.execution.cache import enforce_cache_quota

        cache = BlockingToolCache(temp_cache_dir, "workflow")
        for i in range(5):
            cache.put(f"tool-{i}", "output", f"key{i}", sample_lazyframe)

        evicted = enforce_cache_quota(temp_cache_dir, 0)
        assert evicted == 0


class TestGlobalCacheStats:
    """Tests for global cache statistics."""

    def test_get_global_cache_stats_empty(self, temp_cache_dir):
        """Test stats for empty cache directory."""
        from app.domain.execution.cache import get_global_cache_stats

        stats = get_global_cache_stats(temp_cache_dir)
        assert stats["workflow_count"] == 0
        assert stats["file_count"] == 0
        assert stats["total_size_bytes"] == 0

    def test_get_global_cache_stats_with_data(self, temp_cache_dir, sample_lazyframe):
        """Test stats with multiple workflows."""
        from app.domain.execution.cache import get_global_cache_stats

        # Create caches for multiple workflows
        cache1 = BlockingToolCache(temp_cache_dir, "workflow-1")
        cache2 = BlockingToolCache(temp_cache_dir, "workflow-2")

        cache1.put("sort-1", "output", "key1", sample_lazyframe)
        cache1.put("sort-2", "output", "key2", sample_lazyframe)
        cache2.put("sort-1", "output", "key1", sample_lazyframe)

        stats = get_global_cache_stats(temp_cache_dir)
        assert stats["workflow_count"] == 2
        assert stats["file_count"] == 3
        assert stats["total_size_bytes"] > 0

    def test_get_global_cache_stats_nonexistent_dir(self, temp_cache_dir):
        """Test stats for nonexistent directory."""
        from app.domain.execution.cache import get_global_cache_stats

        nonexistent = temp_cache_dir / "does_not_exist"
        stats = get_global_cache_stats(nonexistent)
        assert stats["workflow_count"] == 0


class TestFileAccessTime:
    """Tests for file access time helper."""

    def test_get_file_access_time(self, temp_cache_dir, sample_lazyframe):
        """Test that get_file_access_time returns a valid timestamp."""
        from app.domain.execution.cache import get_file_access_time

        cache = BlockingToolCache(temp_cache_dir, "workflow")
        cache.put("sort-1", "output", "abc123", sample_lazyframe)

        cache_file = cache.cache_path("sort-1", "output", "abc123")
        access_time = get_file_access_time(cache_file)

        assert access_time > 0
        # Should be recent (within last minute)
        import time
        assert time.time() - access_time < 60
