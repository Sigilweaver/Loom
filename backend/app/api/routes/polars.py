"""Polars functions API for autocomplete"""

from typing import Any
from fastapi import APIRouter

router = APIRouter(prefix="/polars", tags=["polars"])


# TODO: Replace hardcoded functions with dynamic introspection of Polars library
# This will allow users to use different Polars versions without backend changes
def _get_polars_functions() -> dict[str, Any]:
    """
    Get Polars functions for autocomplete, categorized by scope.
    
    NOTE: Currently hardcoded. Future enhancement: dynamically introspect
    the installed Polars library to support different versions.
    """
    return {
        "table_level": [
            {
                "name": "pl.col",
                "signature": "pl.col(name: str)",
                "description": "Reference a column by name",
                "snippet": "pl.col('${1:column_name}')",
                "category": "selection",
            },
            {
                "name": "pl.lit",
                "signature": "pl.lit(value)",
                "description": "Create a literal value",
                "snippet": "pl.lit(${1:value})",
                "category": "literals",
            },
            {
                "name": "pl.when",
                "signature": "pl.when(condition).then(value).otherwise(value)",
                "description": "Conditional expression (if-then-else)",
                "snippet": "pl.when(${1:condition}).then(${2:value}).otherwise(${3:value})",
                "category": "conditional",
            },
        ],
        "column_methods": {
            "all": [
                {
                    "name": ".is_null",
                    "signature": ".is_null()",
                    "description": "Check if value is null",
                    "snippet": ".is_null()",
                    "category": "null_handling",
                },
                {
                    "name": ".is_not_null",
                    "signature": ".is_not_null()",
                    "description": "Check if value is not null",
                    "snippet": ".is_not_null()",
                    "category": "null_handling",
                },
                {
                    "name": ".fill_null",
                    "signature": ".fill_null(value)",
                    "description": "Replace null values with specified value",
                    "snippet": ".fill_null(${1:value})",
                    "category": "null_handling",
                },
                {
                    "name": ".cast",
                    "signature": ".cast(dtype)",
                    "description": "Convert column to different data type",
                    "snippet": ".cast(pl.${1:Float64})",
                    "category": "type_conversion",
                },
            ],
            "string": [
                {
                    "name": ".str.to_uppercase",
                    "signature": ".str.to_uppercase()",
                    "description": "Convert string to uppercase",
                    "snippet": ".str.to_uppercase()",
                    "category": "string_manipulation",
                },
                {
                    "name": ".str.to_lowercase",
                    "signature": ".str.to_lowercase()",
                    "description": "Convert string to lowercase",
                    "snippet": ".str.to_lowercase()",
                    "category": "string_manipulation",
                },
                {
                    "name": ".str.contains",
                    "signature": ".str.contains(pattern: str)",
                    "description": "Check if string contains pattern",
                    "snippet": ".str.contains('${1:pattern}')",
                    "category": "string_search",
                },
                {
                    "name": ".str.slice",
                    "signature": ".str.slice(offset: int, length: int)",
                    "description": "Extract substring",
                    "snippet": ".str.slice(${1:0}, ${2:10})",
                    "category": "string_manipulation",
                },
                {
                    "name": ".str.strip_chars",
                    "signature": ".str.strip_chars()",
                    "description": "Remove leading and trailing whitespace",
                    "snippet": ".str.strip_chars()",
                    "category": "string_manipulation",
                },
                {
                    "name": ".str.replace",
                    "signature": ".str.replace(pattern: str, value: str)",
                    "description": "Replace pattern in string",
                    "snippet": ".str.replace('${1:pattern}', '${2:replacement}')",
                    "category": "string_manipulation",
                },
            ],
            "numeric": [
                {
                    "name": ".abs",
                    "signature": ".abs()",
                    "description": "Absolute value",
                    "snippet": ".abs()",
                    "category": "math",
                },
                {
                    "name": ".round",
                    "signature": ".round(decimals: int)",
                    "description": "Round to specified decimal places",
                    "snippet": ".round(${1:2})",
                    "category": "math",
                },
                {
                    "name": ".floor",
                    "signature": ".floor()",
                    "description": "Round down to nearest integer",
                    "snippet": ".floor()",
                    "category": "math",
                },
                {
                    "name": ".ceil",
                    "signature": ".ceil()",
                    "description": "Round up to nearest integer",
                    "snippet": ".ceil()",
                    "category": "math",
                },
                {
                    "name": ".sqrt",
                    "signature": ".sqrt()",
                    "description": "Square root",
                    "snippet": ".sqrt()",
                    "category": "math",
                },
                {
                    "name": ".pow",
                    "signature": ".pow(exponent)",
                    "description": "Raise to power",
                    "snippet": ".pow(${1:2})",
                    "category": "math",
                },
            ],
            "datetime": [
                {
                    "name": ".dt.year",
                    "signature": ".dt.year()",
                    "description": "Extract year from datetime",
                    "snippet": ".dt.year()",
                    "category": "datetime_components",
                },
                {
                    "name": ".dt.month",
                    "signature": ".dt.month()",
                    "description": "Extract month from datetime",
                    "snippet": ".dt.month()",
                    "category": "datetime_components",
                },
                {
                    "name": ".dt.day",
                    "signature": ".dt.day()",
                    "description": "Extract day from datetime",
                    "snippet": ".dt.day()",
                    "category": "datetime_components",
                },
                {
                    "name": ".dt.hour",
                    "signature": ".dt.hour()",
                    "description": "Extract hour from datetime",
                    "snippet": ".dt.hour()",
                    "category": "datetime_components",
                },
            ],
        },
    }


@router.get("/functions")
async def get_polars_functions():
    """
    Get available Polars functions for autocomplete.
    
    Returns functions categorized by scope (table_level vs column_methods)
    and by applicable types (string, numeric, datetime, etc.).
    
    This endpoint should be called once on app startup and cached.
    
    Future: Will dynamically introspect the installed Polars library
    to support different versions without backend changes.
    """
    return _get_polars_functions()
