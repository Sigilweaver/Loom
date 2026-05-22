"""Safety checks to prevent resource exhaustion during execution.

This module provides pre-execution validation to prevent tools from creating
outputs that could crash the application (e.g., pivot creating millions of columns).

WP-21: the three original per-tool functions delegate to a single generic
``check_cardinality`` helper. Public names/signatures are preserved.
"""

import logging
from dataclasses import dataclass

import polars as pl

from app.config import settings
from app.utils.errors import ToolError

logger = logging.getLogger(__name__)


@dataclass
class SafetyCheckResult:
    """Result of a safety check."""

    safe: bool
    message: str | None = None
    actual_value: int | None = None
    limit_value: int | None = None


def check_cardinality(
    label: str,
    count: int,
    limit: int,
    message: str | None = None,
) -> SafetyCheckResult:
    """Generic cardinality safety check (WP-21).

    Args:
        label: Short label for logs, e.g. "Pivot", "Cross join", "Unpivot".
        count: Computed/estimated cardinality (rows, columns, ...).
        limit: Maximum allowed cardinality. 0 disables the check.
        message: Optional custom message used when count > limit.
    """
    if limit == 0:
        return SafetyCheckResult(safe=True)

    if count > limit:
        return SafetyCheckResult(
            safe=False,
            message=message
            or f"{label} would exceed safety limit ({count:,} > {limit:,}).",
            actual_value=count,
            limit_value=limit,
        )

    logger.debug(f"{label} safety check passed: {count} (limit: {limit})")
    return SafetyCheckResult(safe=True, actual_value=count, limit_value=limit)


def check_pivot_safety(lf: pl.LazyFrame, on_column: str) -> SafetyCheckResult:
    """Check pivot safety by counting unique values in the 'on' column."""
    limit = settings.safety_max_pivot_columns
    if limit == 0:
        return SafetyCheckResult(safe=True)

    try:
        unique_count = lf.select(pl.col(on_column).n_unique()).collect().item()
    except Exception as e:
        logger.warning(f"Could not perform pivot safety check: {e}")
        return SafetyCheckResult(safe=True)

    message = None
    if unique_count > limit:
        message = (
            f"Pivot would create {unique_count:,} columns "
            f"(limit: {limit:,}). "
            f"Column '{on_column}' has too many unique values. "
            "Consider filtering your data first or choosing "
            "a different column to pivot on."
        )
    return check_cardinality("Pivot", unique_count, limit, message=message)


def check_cross_join_safety(
    left_lf: pl.LazyFrame,
    right_lf: pl.LazyFrame,
) -> SafetyCheckResult:
    """Check cross-join safety by estimating output row count."""
    limit = settings.safety_max_cross_join_rows
    if limit == 0:
        return SafetyCheckResult(safe=True)

    try:
        left_count = left_lf.select(pl.len()).collect().item()
        right_count = right_lf.select(pl.len()).collect().item()
    except Exception as e:
        logger.warning(f"Could not perform cross join safety check: {e}")
        return SafetyCheckResult(safe=True)

    estimated_output = left_count * right_count
    message = None
    if estimated_output > limit:
        message = (
            f"Cross join would produce {estimated_output:,} rows "
            f"({left_count:,} x {right_count:,}, limit: {limit:,}). "
            f"Consider adding join keys or filtering your inputs first."
        )
    return check_cardinality("Cross join", estimated_output, limit, message=message)


def check_unpivot_safety(
    lf: pl.LazyFrame, columns_to_unpivot: list[str]
) -> SafetyCheckResult:
    """Check unpivot safety by estimating output row count."""
    limit = settings.safety_max_unpivot_rows
    if limit == 0:
        return SafetyCheckResult(safe=True)

    try:
        row_count = lf.select(pl.len()).collect().item()
    except Exception as e:
        logger.warning(f"Could not perform unpivot safety check: {e}")
        return SafetyCheckResult(safe=True)

    column_count = len(columns_to_unpivot)
    estimated_output = row_count * column_count
    message = None
    if estimated_output > limit:
        message = (
            f"Unpivot would produce {estimated_output:,} rows "
            f"({row_count:,} rows x {column_count} columns, limit: {limit:,}). "
            f"Consider unpivoting fewer columns or filtering your data first."
        )
    return check_cardinality("Unpivot", estimated_output, limit, message=message)


def raise_if_unsafe(result: SafetyCheckResult) -> None:
    """Raise ToolError if safety check failed."""
    if not result.safe:
        raise ToolError(result.message or "Safety check failed")
