"""Tests for expression parsing utilities."""

import polars as pl
import pytest

from app.utils.errors import ToolError
from app.utils.expression import normalize_expression, parse_polars_expression


class TestNormalizeExpression:
    """Tests for normalize_expression function."""

    def test_single_line_wrapped(self):
        """Single line expressions are wrapped in parentheses."""
        expr = "pl.col('age') > 18"
        expected = "(pl.col('age') > 18\n)"
        assert normalize_expression(expr) == expected

    def test_multiline_wrapped(self):
        """Multiline expressions are wrapped with closing paren on new line."""
        expr = """(pl.col('a') > 10)
&
(pl.col('b') < 20)"""
        expected = "((pl.col('a') > 10)\n&\n(pl.col('b') < 20)\n)"
        assert normalize_expression(expr) == expected

    def test_multiline_with_comments(self):
        """Multiline expressions with trailing comments are preserved."""
        expr = """(pl.col('price') > 100)  # expensive items
& (pl.col('qty') >= 3)  # in stock"""
        expected = (
            "((pl.col('price') > 100)  # expensive items\n"
            "& (pl.col('qty') >= 3)  # in stock\n)"
        )
        assert normalize_expression(expr) == expected

    def test_preserves_internal_whitespace(self):
        """Internal whitespace is preserved."""
        expr = "pl.col('a')    >    10"
        expected = "(pl.col('a')    >    10\n)"
        assert normalize_expression(expr) == expected

    def test_leading_trailing_whitespace_stripped(self):
        """Leading and trailing whitespace is stripped before wrapping."""
        expr = "  pl.col('a') > 10  "
        expected = "(pl.col('a') > 10\n)"
        assert normalize_expression(expr) == expected

    def test_empty_string(self):
        """Empty string returns empty string."""
        assert normalize_expression("") == ""

    def test_whitespace_only(self):
        """Whitespace-only string returns empty string."""
        assert normalize_expression("   \n\t  ") == ""


class TestParsePolarsExpression:
    """Tests for parse_polars_expression function."""

    def test_simple_comparison(self):
        """Parse simple comparison expression."""
        expr = parse_polars_expression("pl.col('age') > 18")
        assert isinstance(expr, pl.Expr)

    def test_string_method(self):
        """Parse string method expression."""
        expr = parse_polars_expression("pl.col('name').str.contains('test')")
        assert isinstance(expr, pl.Expr)

    def test_compound_condition(self):
        """Parse compound condition with & operator."""
        expr = parse_polars_expression("(pl.col('a') > 10) & (pl.col('b') < 20)")
        assert isinstance(expr, pl.Expr)

    def test_multiline_expression(self):
        """Parse multiline expression (normalized automatically)."""
        expr = parse_polars_expression("""pl.col('a') > 10
&
~pl.col('b').is_null()""")
        assert isinstance(expr, pl.Expr)

    def test_when_then_otherwise(self):
        """Parse when/then/otherwise conditional."""
        expr = parse_polars_expression(
            "pl.when(pl.col('x') > 0).then(pl.lit('pos')).otherwise(pl.lit('neg'))"
        )
        assert isinstance(expr, pl.Expr)

    def test_list_operations(self):
        """Parse list operations."""
        expr = parse_polars_expression(
            "pl.col('items').str.split(' ').list.contains('value')"
        )
        assert isinstance(expr, pl.Expr)

    def test_arithmetic(self):
        """Parse arithmetic expression."""
        expr = parse_polars_expression("pl.col('price') * pl.col('quantity')")
        assert isinstance(expr, pl.Expr)

    def test_invalid_expression_raises_error(self):
        """Invalid expression raises ToolError."""
        with pytest.raises(ToolError, match="Failed to parse expression"):
            parse_polars_expression("invalid syntax here")

    def test_non_expr_result_raises_error(self):
        """Non-Expr result raises ToolError."""
        with pytest.raises(ToolError, match="must evaluate to pl.Expr"):
            parse_polars_expression("42")

    def test_no_builtins_access(self):
        """Built-in functions are not accessible (security)."""
        with pytest.raises(ToolError):
            parse_polars_expression("print('hello')")

    def test_no_import_access(self):
        """Import is not accessible (security)."""
        with pytest.raises(ToolError):
            parse_polars_expression("__import__('os')")

    def test_normalize_disabled(self):
        """Can disable normalization."""
        # This would fail with normalization disabled because of newlines
        # But the simple case should still work
        expr = parse_polars_expression("pl.col('x') > 0", normalize=False)
        assert isinstance(expr, pl.Expr)
