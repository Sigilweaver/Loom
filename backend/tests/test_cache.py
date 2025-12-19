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
