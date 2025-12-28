"""Pytest configuration and fixtures"""

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
