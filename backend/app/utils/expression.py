"""Expression parsing utilities for Polars expressions.

Shared logic for parsing and normalizing Polars expression strings.
Used by Filter, Formula, and other expression-based tools.
"""

from typing import Any

import polars as pl

from app.utils.errors import ToolError


def normalize_expression(expression: str) -> str:
    """
    Normalize expression whitespace for consistent parsing.

    Replaces newlines and multiple spaces with single spaces,
    allowing users to write multi-line expressions for readability.

    Args:
        expression: Raw expression string (may contain newlines)

    Returns:
        Normalized expression with single spaces

    Example:
        >>> normalize_expression('''pl.col("a") > 10
        ... &
        ... pl.col("b") < 20''')
        'pl.col("a") > 10 & pl.col("b") < 20'
    """
    return " ".join(expression.split())


def parse_polars_expression(expression: str, normalize: bool = True) -> pl.Expr:
    """
    Parse a Polars expression string into a pl.Expr object.

    Uses eval with a restricted namespace containing only the Polars module.
    Optionally normalizes whitespace to support multi-line expressions.

    Args:
        expression: Polars expression string (e.g., "pl.col('age') > 18")
        normalize: Whether to normalize whitespace (default: True)

    Returns:
        Parsed Polars expression object

    Raises:
        ToolError: If expression is invalid or doesn't evaluate to pl.Expr

    Examples:
        >>> expr = parse_polars_expression("pl.col('age') > 18")
        >>> expr = parse_polars_expression("pl.col('name').str.contains('test')")
        >>> expr = parse_polars_expression('''
        ...     pl.col('a') > 10
        ...     &
        ...     pl.col('b') < 20
        ... ''')
    """
    if normalize:
        expression = normalize_expression(expression)

    # Restricted namespace - only Polars available
    namespace: dict[str, Any] = {
        "pl": pl,
    }

    try:
        result = eval(expression, {"__builtins__": {}}, namespace)

        if not isinstance(result, pl.Expr):
            raise ToolError(
                f"Expression must evaluate to pl.Expr, got {type(result).__name__}"
            )

        return result

    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Failed to parse expression: {str(e)}") from e
