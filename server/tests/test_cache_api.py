"""Tests for cache API routes."""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def temp_cache_dir():
    """Create a temporary directory for cache tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


class TestCacheAPIRoutes:
    """Tests for cache API endpoints."""

    def test_get_cache_stats_disabled(self, client):
        """Test stats endpoint when cache is disabled."""
        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False
            mock_settings.cache_max_size_gb = 20.0
            mock_settings.cache_retention_days = 7

            response = client.get("/api/cache/stats")
            assert response.status_code == 200
            data = response.json()
            assert data["enabled"] is False

    def test_get_cache_stats_enabled(self, client, temp_cache_dir):
        """Test stats endpoint when cache is enabled."""
        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_path = str(temp_cache_dir)
            mock_settings.cache_max_size_gb = 20.0
            mock_settings.cache_retention_days = 7

            response = client.get("/api/cache/stats")
            assert response.status_code == 200
            data = response.json()
            assert data["enabled"] is True
            assert "workflow_count" in data
            assert "file_count" in data
            assert data["quota_gb"] == 20.0
            assert data["retention_days"] == 7

    def test_clear_workflow_cache(self, client, temp_cache_dir):
        """Test clearing a specific workflow's cache."""
        import polars as pl

        from app.domain.execution.cache import BlockingToolCache

        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_path = str(temp_cache_dir)

            # Create some cache data
            cache = BlockingToolCache(temp_cache_dir, "test-workflow-123")
            lf = pl.LazyFrame({"a": [1, 2, 3]})
            cache.put("tool-1", "output", "key123", lf)
            assert cache.exists("tool-1", "output", "key123")

            # Clear via API
            response = client.post("/api/cache/clear", json={"workflow_id": "test-workflow-123"})
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "cleared"
            assert data["workflow_id"] == "test-workflow-123"

            # Verify cleared
            assert not cache.cache_dir.exists()

    def test_clear_cache_disabled(self, client):
        """Test clear endpoint when cache is disabled."""
        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False

            response = client.post("/api/cache/clear", json={"workflow_id": "test-workflow"})
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "cache_disabled"

    def test_legacy_workflow_cache_clear_path_matches_cache_clear(self, client, temp_cache_dir):
        """/api/workflow/cache/clear (used by existing Studio builds) shares the implementation."""
        import polars as pl

        from app.domain.execution.cache import BlockingToolCache

        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_path = str(temp_cache_dir)
            cache = BlockingToolCache(temp_cache_dir, "legacy-path")
            cache.put("tool-1", "output", "key", pl.LazyFrame({"a": [1]}))

            response = client.post("/api/workflow/cache/clear", json={"workflow_id": "legacy-path"})

            assert response.status_code == 200
            assert response.json() == {"status": "cleared", "workflow_id": "legacy-path"}
            assert not cache.exists("tool-1", "output", "key")

    def test_legacy_workflow_cache_clear_when_disabled(self, client):
        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False
            response = client.post("/api/workflow/cache/clear", json={"workflow_id": "w"})
        assert response.json() == {"status": "cache_disabled", "workflow_id": "w"}

    def test_close_workflow_cache_clears_when_enabled(self, client, temp_cache_dir):
        """Test close endpoint clears cache when setting is enabled."""
        import polars as pl

        from app.domain.execution.cache import BlockingToolCache

        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_clear_on_close = True
            mock_settings.cache_path = str(temp_cache_dir)

            # Create some cache data
            cache = BlockingToolCache(temp_cache_dir, "close-test-workflow")
            lf = pl.LazyFrame({"a": [1, 2, 3]})
            cache.put("tool-1", "output", "key123", lf)

            # Close via API
            response = client.post("/api/cache/close", json={"workflow_id": "close-test-workflow"})
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "cleared_on_close"

            # Verify cleared
            assert not cache.cache_dir.exists()

    def test_close_workflow_cache_skips_when_disabled(self, client, temp_cache_dir):
        """Test close endpoint skips clear when setting is disabled."""
        import polars as pl

        from app.domain.execution.cache import BlockingToolCache

        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_clear_on_close = False
            mock_settings.cache_path = str(temp_cache_dir)

            # Create some cache data
            cache = BlockingToolCache(temp_cache_dir, "keep-test-workflow")
            lf = pl.LazyFrame({"a": [1, 2, 3]})
            cache.put("tool-1", "output", "key123", lf)

            # Close via API
            response = client.post("/api/cache/close", json={"workflow_id": "keep-test-workflow"})
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "close_acknowledged"

            # Verify NOT cleared
            assert cache.exists("tool-1", "output", "key123")

    def test_close_workflow_caches_batch(self, client, temp_cache_dir):
        """Test batch close endpoint clears multiple workflow caches."""
        import polars as pl

        from app.domain.execution.cache import BlockingToolCache

        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_clear_on_close = True
            mock_settings.cache_path = str(temp_cache_dir)

            # Create cache data for multiple workflows
            workflows = ["batch-wf-1", "batch-wf-2", "batch-wf-3"]
            caches = []
            for wf_id in workflows:
                cache = BlockingToolCache(temp_cache_dir, wf_id)
                lf = pl.LazyFrame({"a": [1, 2, 3]})
                cache.put("tool-1", "output", "key123", lf)
                caches.append(cache)
                assert cache.cache_dir.exists()

            # Close all via batch API
            response = client.post("/api/cache/close/batch", json={"workflow_ids": workflows})
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "cleared_on_close"
            assert data["cleared_count"] == 3
            assert data["workflow_ids"] == workflows

            # Verify all cleared
            for cache in caches:
                assert not cache.cache_dir.exists()

    def test_close_workflow_caches_batch_empty_list(self, client):
        """Test batch close endpoint with empty list."""
        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_clear_on_close = True

            response = client.post("/api/cache/close/batch", json={"workflow_ids": []})
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "cleared_on_close"
            assert data["cleared_count"] == 0

    def test_close_workflow_caches_batch_disabled(self, client):
        """Test batch close endpoint when cache_clear_on_close is disabled."""
        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_clear_on_close = False

            response = client.post(
                "/api/cache/close/batch", json={"workflow_ids": ["wf-1", "wf-2"]}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "close_acknowledged"
            assert data["cleared_count"] == 0

    def test_run_maintenance(self, client, temp_cache_dir):
        """Test manual maintenance endpoint."""
        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_path = str(temp_cache_dir)
            mock_settings.cache_retention_days = 7
            mock_settings.cache_max_size_gb = 20.0

            response = client.post("/api/cache/maintenance")
            assert response.status_code == 200
            data = response.json()
            assert "ttl_files_deleted" in data
            assert "lru_files_evicted" in data
            assert "message" in data

    def test_run_maintenance_disabled(self, client):
        """Test maintenance endpoint when cache is disabled."""
        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False

            response = client.post("/api/cache/maintenance")
            assert response.status_code == 200
            data = response.json()
            assert data["message"] == "Cache is disabled"


class TestStartupMaintenance:
    """Tests for startup maintenance function."""

    def test_run_startup_maintenance_disabled(self):
        """Test startup maintenance when cache is disabled."""
        from app.api.routes.cache import run_startup_maintenance

        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = False

            result = run_startup_maintenance()
            assert result["enabled"] is False
            assert result["ttl_deleted"] == 0
            assert result["lru_evicted"] == 0

    def test_run_startup_maintenance_enabled(self, temp_cache_dir):
        """Test startup maintenance when cache is enabled."""
        from app.api.routes.cache import run_startup_maintenance

        with patch("app.api.routes.cache.settings") as mock_settings:
            mock_settings.cache_enabled = True
            mock_settings.cache_path = str(temp_cache_dir)
            mock_settings.cache_retention_days = 7
            mock_settings.cache_max_size_gb = 20.0

            result = run_startup_maintenance()
            assert result["enabled"] is True
            assert "ttl_deleted" in result
            assert "lru_evicted" in result
