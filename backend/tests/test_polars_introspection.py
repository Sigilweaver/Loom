"""Tests for Polars dynamic introspection module."""

import inspect

import polars as pl

from app.utils.polars_introspection import (
    _categorize_datetime_method,
    _categorize_expr_method,
    _categorize_string_method,
    _extract_description,
    _generate_snippet,
    clear_cache,
    get_polars_functions,
)


class TestGetPolarsFunctions:
    """Tests for the main get_polars_functions function."""

    def setup_method(self):
        """Clear cache before each test."""
        clear_cache()

    def test_returns_expected_structure(self):
        """Should return dict with expected keys."""
        result = get_polars_functions()

        assert "table_level" in result
        assert "column_methods" in result
        assert "polars_version" in result
        assert result["polars_version"] == pl.__version__

    def test_column_methods_has_expected_categories(self):
        """Should have all, string, numeric, datetime categories."""
        result = get_polars_functions()

        assert "all" in result["column_methods"]
        assert "string" in result["column_methods"]
        assert "numeric" in result["column_methods"]
        assert "datetime" in result["column_methods"]

    def test_string_methods_include_split(self):
        """String methods should include split."""
        result = get_polars_functions()
        string_methods = result["column_methods"]["string"]

        names = [m["name"] for m in string_methods]
        assert ".str.split" in names

    def test_split_has_correct_snippet(self):
        """Split method should have proper snippet with quotes."""
        result = get_polars_functions()
        string_methods = result["column_methods"]["string"]

        split_method = next(m for m in string_methods if m["name"] == ".str.split")
        assert split_method["snippet"] == ".str.split('${1:by}')"

    def test_string_methods_include_all_expected(self):
        """String methods should include the complete list from Polars."""
        result = get_polars_functions()
        string_methods = result["column_methods"]["string"]
        names = [m["name"] for m in string_methods]

        # Check a sample of expected methods
        expected = [
            ".str.contains",
            ".str.to_uppercase",
            ".str.to_lowercase",
            ".str.replace",
            ".str.split",
            ".str.starts_with",
            ".str.ends_with",
            ".str.strip_chars",
            ".str.len_chars",
        ]

        for method in expected:
            assert method in names, f"Expected {method} in string methods"

    def test_datetime_methods_include_expected(self):
        """Datetime methods should include expected methods."""
        result = get_polars_functions()
        dt_methods = result["column_methods"]["datetime"]
        names = [m["name"] for m in dt_methods]

        expected = [".dt.year", ".dt.month", ".dt.day", ".dt.hour"]
        for method in expected:
            assert method in names, f"Expected {method} in datetime methods"

    def test_list_methods_include_expected(self):
        """List methods should include expected methods."""
        result = get_polars_functions()
        assert "list" in result["column_methods"], "Should have list methods category"
        list_methods = result["column_methods"]["list"]
        names = [m["name"] for m in list_methods]

        expected = [
            ".list.first",
            ".list.last",
            ".list.len",
            ".list.get",
            ".list.join",
            ".list.contains",
            ".list.sort",
            ".list.unique",
        ]
        for method in expected:
            assert method in names, f"Expected {method} in list methods"

    def test_table_level_includes_col(self):
        """Table level should include pl.col."""
        result = get_polars_functions()
        table_level = result["table_level"]
        names = [m["name"] for m in table_level]

        assert "pl.col" in names

    def test_method_has_required_fields(self):
        """Each method should have name, signature, description, snippet, category."""
        result = get_polars_functions()

        for method in result["column_methods"]["string"]:
            assert "name" in method
            assert "signature" in method
            assert "description" in method
            assert "snippet" in method
            assert "category" in method

    def test_caching_works(self):
        """Subsequent calls should return cached result."""
        result1 = get_polars_functions()
        result2 = get_polars_functions()

        # Should be the exact same object (cached)
        assert result1 is result2

    def test_clear_cache_works(self):
        """clear_cache should cause re-introspection."""
        result1 = get_polars_functions()
        clear_cache()
        result2 = get_polars_functions()

        # Should be different objects (re-introspected)
        assert result1 is not result2
        # But should have same content
        assert result1["polars_version"] == result2["polars_version"]


class TestExtractDescription:
    """Tests for _extract_description helper."""

    def test_extracts_first_paragraph(self):
        """Should extract first paragraph before Parameters."""
        docstring = """
        Split the string by a substring.

        Parameters
        ----------
        by
            Substring to split by.
        """
        result = _extract_description(docstring)
        assert result == "Split the string by a substring."

    def test_handles_none(self):
        """Should handle None docstring."""
        assert _extract_description(None) == ""

    def test_handles_empty(self):
        """Should handle empty docstring."""
        assert _extract_description("") == ""

    def test_stops_at_parameters(self):
        """Should stop extracting at Parameters section."""
        docstring = """First line.
        Second line.

        Parameters
        ----------
        Not included.
        """
        result = _extract_description(docstring)
        assert "Not included" not in result


class TestCategorization:
    """Tests for categorization functions."""

    def test_string_method_categories(self):
        """String methods should be categorized correctly."""
        assert _categorize_string_method("contains") == "string_search"
        assert _categorize_string_method("split") == "string_split"
        assert _categorize_string_method("to_uppercase") == "string_manipulation"
        assert _categorize_string_method("replace") == "string_replace"
        assert _categorize_string_method("extract") == "string_extract"

    def test_datetime_method_categories(self):
        """Datetime methods should be categorized correctly."""
        assert _categorize_datetime_method("year") == "datetime_components"
        assert _categorize_datetime_method("week") == "datetime_week"
        assert _categorize_datetime_method("truncate") == "datetime_offset"

    def test_expr_method_categories(self):
        """Expr methods should be categorized correctly."""
        assert _categorize_expr_method("is_null") == "null_handling"
        assert _categorize_expr_method("abs") == "math"
        assert _categorize_expr_method("sum") == "aggregation"
        assert _categorize_expr_method("alias") == "naming"


class TestGenerateSnippet:
    """Tests for _generate_snippet function."""

    def test_no_params(self):
        """Should generate simple snippet for no-param methods."""
        def simple_method():
            pass
        sig = inspect.signature(simple_method)
        result = _generate_snippet("test", sig)
        assert result == ".test()"

    def test_string_param(self):
        """Should wrap string params in quotes."""
        def string_method(pattern: str):
            pass
        sig = inspect.signature(string_method)
        result = _generate_snippet("contains", sig)
        assert result == ".contains('${1:pattern}')"

    def test_int_param(self):
        """Should use 0 default for int params."""
        def int_method(n: int):
            pass
        sig = inspect.signature(int_method)
        result = _generate_snippet("limit", sig)
        assert result == ".limit(${1:0})"

    def test_prefix_override(self):
        """Should respect prefix parameter."""
        def simple_method():
            pass
        sig = inspect.signature(simple_method)
        result = _generate_snippet("col", sig, prefix="pl.")
        assert result == "pl.col()"
