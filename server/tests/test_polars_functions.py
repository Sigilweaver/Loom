"""Tests for Polars functions endpoint"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


def test_polars_functions_endpoint(client):
    """Test Polars functions endpoint returns expected structure"""
    response = client.get("/api/polars/functions")

    assert response.status_code == 200
    data = response.json()

    # Check top-level structure
    assert "table_level" in data
    assert "column_methods" in data

    # Check table-level functions
    table_funcs = data["table_level"]
    assert len(table_funcs) > 0

    # Check for key table-level functions
    table_names = [fn["name"] for fn in table_funcs]
    assert "pl.col" in table_names
    assert "pl.lit" in table_names
    assert "pl.when" in table_names

    # Verify function structure
    for fn in table_funcs:
        assert "name" in fn
        assert "signature" in fn
        assert "description" in fn
        assert "snippet" in fn
        assert "category" in fn

    # Check column methods structure
    methods = data["column_methods"]
    assert "all" in methods
    assert "string" in methods
    assert "numeric" in methods
    assert "datetime" in methods

    # Check 'all' methods (applicable to all types)
    all_methods = methods["all"]
    assert len(all_methods) > 0
    all_names = [fn["name"] for fn in all_methods]
    assert ".is_null" in all_names
    assert ".is_not_null" in all_names
    assert ".cast" in all_names

    # Check string methods
    string_methods = methods["string"]
    assert len(string_methods) > 0
    string_names = [fn["name"] for fn in string_methods]
    assert ".str.to_uppercase" in string_names
    assert ".str.contains" in string_names

    # Check numeric methods
    numeric_methods = methods["numeric"]
    assert len(numeric_methods) > 0
    numeric_names = [fn["name"] for fn in numeric_methods]
    assert ".abs" in numeric_names
    assert ".round" in numeric_names

    # Check datetime methods
    datetime_methods = methods["datetime"]
    assert len(datetime_methods) > 0
    datetime_names = [fn["name"] for fn in datetime_methods]
    assert ".dt.year" in datetime_names
    assert ".dt.month" in datetime_names


def test_polars_functions_caching(client):
    """Test that functions endpoint can be called multiple times (for caching)"""
    # Call endpoint twice
    response1 = client.get("/api/polars/functions")
    response2 = client.get("/api/polars/functions")

    assert response1.status_code == 200
    assert response2.status_code == 200

    # Should return same data
    assert response1.json() == response2.json()
