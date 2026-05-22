"""Pytest configuration and fixtures"""

import os

# Default test runs to AUTH_MODE=disabled. Production default is "ephemeral"
# (see WP-02); tests that exercise auth use create_test_app() with explicit
# settings, so disabling auth here keeps existing fixtures unauthenticated.
os.environ.setdefault("AUTH_MODE", "disabled")

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def sample_csv() -> Path:
    """Path to sample CSV file for testing"""
    return Path(__file__).parent / "fixtures" / "sample.csv"
