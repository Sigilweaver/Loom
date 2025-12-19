"""Tests for CacheManager"""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import polars as pl
import pytest

from app.api.models.workflow import Socket, Tool
from app.domain.execution.cache_manager import CacheManager
from app.domain.execution.planner import ExecutionPlan


@pytest.fixture
def temp_cache_dir():
    """Create a temporary directory for cache tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def cache_settings(temp_cache_dir):
    """Mock settings with cache enabled."""
    with patch("app.domain.execution.cache_manager.settings") as mock_settings:
        mock_settings.cache_enabled = True
        mock_settings.cache_path = str(temp_cache_dir)
        yield mock_settings


@pytest.fixture
def cache_disabled_settings():
    """Mock settings with cache disabled."""
    with patch("app.domain.execution.cache_manager.settings") as mock_settings:
        mock_settings.cache_enabled = False
        yield mock_settings


@pytest.fixture
def sample_tool():
    """Create a sample tool for testing."""
    return Tool(
        id="sort-1",
        type="Sort",
        x=0,
        y=0,
        config={"sortColumns": [{"column": "name", "direction": "asc"}]},
        sockets=[
            Socket(id="input", direction="input"),
            Socket(id="output", direction="output"),
        ],
    )


@pytest.fixture
def sample_plan():
    """Create a sample execution plan."""
    return ExecutionPlan(
        workflow_id="test-123",
        execution_order=("input-1", "sort-1"),
        tool_inputs={"sort-1": {"input": [("input-1", "output")]}},
        tool_map={},
        dependencies={"sort-1": ["input-1"], "input-1": []},
    )


@pytest.fixture
def sample_lazyframe():
    """Create a sample LazyFrame for testing."""
    return pl.LazyFrame({
        "id": [1, 2, 3],
        "name": ["Alice", "Bob", "Charlie"],
    })


class TestCacheManagerInit:
    """Tests for CacheManager initialization."""

    def test_init_with_cache_enabled(self, cache_settings, temp_cache_dir):
        """Test initialization when caching is enabled."""
        mgr = CacheManager("test-workflow")

        assert mgr.is_enabled
        assert mgr.workflow_id == "test-workflow"

    def test_init_with_cache_disabled(self, cache_disabled_settings):
        """Test initialization when caching is disabled."""
        mgr = CacheManager("test-workflow")

        assert not mgr.is_enabled

    def test_init_with_force_refresh(self, cache_settings, temp_cache_dir):
        """Test that force_refresh clears the cache."""
        # Create some cache data first
        cache_dir = temp_cache_dir / "test-workflow"
        cache_dir.mkdir(parents=True)
        (cache_dir / "dummy.parquet").write_text("test")

        # Initialize with force_refresh
        mgr = CacheManager("test-workflow", force_refresh=True)

        assert mgr.is_enabled
        # Cache should be cleared
        assert not (cache_dir / "dummy.parquet").exists()


class TestLineageHash:
    """Tests for lineage hash computation."""

    def test_compute_lineage_hash(self, cache_settings, sample_tool, sample_plan):
        """Test that lineage hash is computed correctly."""
        mgr = CacheManager("test-workflow")

        # Record upstream hash first
        mgr.record_lineage_hash("input-1", "abc123")

        hash_value = mgr.compute_lineage_hash(sample_tool, sample_plan)

        assert hash_value
        assert len(hash_value) == 16  # 16-char hex string

    def test_compute_lineage_hash_deterministic(self, cache_settings, sample_tool, sample_plan):
        """Test that same inputs produce same hash."""
        mgr = CacheManager("test-workflow")
        mgr.record_lineage_hash("input-1", "abc123")

        hash1 = mgr.compute_lineage_hash(sample_tool, sample_plan)
        hash2 = mgr.compute_lineage_hash(sample_tool, sample_plan)

        assert hash1 == hash2

    def test_compute_lineage_hash_changes_with_upstream(
        self, cache_settings, sample_tool, sample_plan
    ):
        """Test that hash changes when upstream changes."""
        mgr = CacheManager("test-workflow")

        mgr.record_lineage_hash("input-1", "abc123")
        hash1 = mgr.compute_lineage_hash(sample_tool, sample_plan)

        mgr.record_lineage_hash("input-1", "xyz789")
        hash2 = mgr.compute_lineage_hash(sample_tool, sample_plan)

        assert hash1 != hash2

    def test_compute_lineage_hash_disabled(self, cache_disabled_settings, sample_tool, sample_plan):
        """Test that hash is empty when cache disabled."""
        mgr = CacheManager("test-workflow")

        hash_value = mgr.compute_lineage_hash(sample_tool, sample_plan)

        assert hash_value == ""

    def test_record_lineage_hash(self, cache_settings):
        """Test recording lineage hashes."""
        mgr = CacheManager("test-workflow")

        mgr.record_lineage_hash("tool-1", "hash123")
        mgr.record_lineage_hash("tool-2", "hash456")

        hashes = mgr.lineage_hashes
        assert hashes["tool-1"] == "hash123"
        assert hashes["tool-2"] == "hash456"

    def test_lineage_hashes_returns_copy(self, cache_settings):
        """Test that lineage_hashes returns a copy."""
        mgr = CacheManager("test-workflow")
        mgr.record_lineage_hash("tool-1", "hash123")

        hashes = mgr.lineage_hashes
        hashes["tool-1"] = "modified"

        assert mgr.lineage_hashes["tool-1"] == "hash123"


class TestShouldCacheTool:
    """Tests for should_cache_tool method."""

    def test_should_cache_sort_tool(self, cache_settings, sample_tool):
        """Test that Sort tool should be cached."""
        mgr = CacheManager("test-workflow")

        # Mock the tool registry
        with patch("app.domain.execution.cache_manager.ToolRegistry") as mock_registry:
            mock_impl = MagicMock()
            mock_impl.should_cache.return_value = True
            mock_registry.get.return_value = mock_impl

            assert mgr.should_cache_tool(sample_tool)

    def test_should_not_cache_when_disabled(self, cache_disabled_settings, sample_tool):
        """Test that caching returns False when disabled."""
        mgr = CacheManager("test-workflow")

        assert not mgr.should_cache_tool(sample_tool)


class TestCacheOperations:
    """Tests for cache check and store operations."""

    def test_check_cache_miss(self, cache_settings, sample_tool):
        """Test cache miss returns None."""
        mgr = CacheManager("test-workflow")

        result = mgr.check_cache(sample_tool, "nonexistent_hash")

        assert result is None

    def test_store_and_check_cache(self, cache_settings, sample_tool, sample_lazyframe):
        """Test storing and retrieving from cache."""
        mgr = CacheManager("test-workflow")

        # Store in cache
        outputs = {"output": sample_lazyframe}
        stored = mgr.store_in_cache(sample_tool, "test_hash", outputs)

        # Should return LazyFrames
        assert "output" in stored
        assert isinstance(stored["output"], pl.LazyFrame)

        # Check cache should now hit
        cached = mgr.check_cache(sample_tool, "test_hash")
        assert cached is not None
        assert "output" in cached

        # Verify data matches
        original_df = sample_lazyframe.collect()
        cached_df = cached["output"].collect()
        assert original_df.equals(cached_df)

    def test_check_cache_disabled(self, cache_disabled_settings, sample_tool):
        """Test cache check returns None when disabled."""
        mgr = CacheManager("test-workflow")

        result = mgr.check_cache(sample_tool, "any_hash")

        assert result is None

    def test_store_in_cache_disabled(self, cache_disabled_settings, sample_tool, sample_lazyframe):
        """Test store returns original outputs when disabled."""
        mgr = CacheManager("test-workflow")

        outputs = {"output": sample_lazyframe}
        result = mgr.store_in_cache(sample_tool, "any_hash", outputs)

        assert result is outputs


class TestCacheStats:
    """Tests for cache statistics."""

    def test_get_cache_stats_enabled(self, cache_settings, sample_tool, sample_lazyframe):
        """Test cache stats when enabled."""
        mgr = CacheManager("test-workflow")

        # Store some data
        mgr.store_in_cache(sample_tool, "test_hash", {"output": sample_lazyframe})

        stats = mgr.get_cache_stats()

        assert stats["enabled"]
        assert stats["file_count"] >= 1
        assert stats["total_size_bytes"] > 0

    def test_get_cache_stats_disabled(self, cache_disabled_settings):
        """Test cache stats when disabled."""
        mgr = CacheManager("test-workflow")

        stats = mgr.get_cache_stats()

        assert not stats["enabled"]
        assert stats["workflow_id"] == "test-workflow"


class TestClear:
    """Tests for cache clearing."""

    def test_clear_removes_cached_data(self, cache_settings, sample_tool, sample_lazyframe):
        """Test that clear removes all cached data."""
        mgr = CacheManager("test-workflow")

        # Store some data
        mgr.store_in_cache(sample_tool, "test_hash", {"output": sample_lazyframe})
        mgr.record_lineage_hash("tool-1", "hash123")

        # Verify data exists
        assert mgr.check_cache(sample_tool, "test_hash") is not None
        assert mgr.lineage_hashes

        # Clear
        mgr.clear()

        # Verify cleared
        assert mgr.check_cache(sample_tool, "test_hash") is None
        assert not mgr.lineage_hashes

    def test_clear_when_disabled(self, cache_disabled_settings):
        """Test that clear works when cache disabled."""
        mgr = CacheManager("test-workflow")
        mgr.record_lineage_hash("tool-1", "hash123")

        # Should not raise
        mgr.clear()

        assert not mgr.lineage_hashes
