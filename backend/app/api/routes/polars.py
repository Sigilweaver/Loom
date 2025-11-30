"""Polars functions API for autocomplete"""

from fastapi import APIRouter

from app.utils.polars_introspection import get_polars_functions, clear_cache

router = APIRouter(prefix="/polars", tags=["polars"])


@router.get("/functions")
async def get_functions():
    """
    Get available Polars functions for autocomplete.
    
    Returns functions categorized by scope (table_level vs column_methods)
    and by applicable types (string, numeric, datetime, etc.).
    
    This endpoint dynamically introspects the installed Polars library,
    so it automatically supports new Polars versions without code changes.
    
    Response includes:
    - polars_version: The installed Polars version
    - table_level: Functions like pl.col, pl.lit, pl.when
    - column_methods:
      - all: Methods available on any column expression
      - string: Methods in the .str namespace
      - numeric: Math-related methods
      - datetime: Methods in the .dt namespace
    
    The result is cached - subsequent calls return the cached data.
    """
    return get_polars_functions()


@router.post("/functions/refresh")
async def refresh_functions():
    """
    Clear the cached functions and re-introspect Polars.
    
    Useful after upgrading Polars or for development/testing.
    Returns status and triggers re-introspection on next GET request.
    """
    clear_cache()
    return {"status": "ok", "message": "Cache cleared, next request will re-introspect"}
