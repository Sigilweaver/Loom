"""Safety checks to prevent resource exhaustion during execution.

This module provides pre-execution validation to prevent tools from creating
outputs that could crash the application (e.g., pivot creating millions of columns).
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


def check_pivot_safety(lf: pl.LazyFrame, on_column: str) -> SafetyCheckResult:
    """
    Check if a pivot operation is safe by counting unique values in the 'on' column.

    Pivot creates one column per unique value, so a column with 1M unique values
    would create 1M columns, crashing the application.

    Args:
        lf: Input LazyFrame
        on_column: Column whose unique values become new columns

    Returns:
        SafetyCheckResult indicating if the operation is safe
    """
    limit = settings.safety_max_pivot_columns
    if limit == 0:
        return SafetyCheckResult(safe=True)

    try:
        # Count unique values efficiently - this is a quick aggregation
        unique_count = lf.select(pl.col(on_column).n_unique()).collect().item()

        if unique_count > limit:
            return SafetyCheckResult(
                safe=False,
                message=(
                    f"Pivot would create {unique_count:,} columns "
                    f"(limit: {limit:,}). "
                    f"Column '{on_column}' has too many unique values. "
                    f"Consider filtering your data first or choosing a different column to pivot on."
                ),
                actual_value=unique_count,
                limit_value=limit,
            )

        logger.debug(f"Pivot safety check passed: {unique_count} unique values (limit: {limit})")
        return SafetyCheckResult(safe=True, actual_value=unique_count, limit_value=limit)

    except Exception as e:
        # If we can't check, log warning and allow (fail open)
        logger.warning(f"Could not perform pivot safety check: {e}")
        return SafetyCheckResult(safe=True)


def check_cross_join_safety(
    left_lf: pl.LazyFrame,
    right_lf: pl.LazyFrame,
) -> SafetyCheckResult:
    """
    Check if a cross join operation is safe by estimating output row count.

    Cross join produces left_rows * right_rows output rows.

    Args:
        left_lf: Left input LazyFrame
        right_lf: Right input LazyFrame

    Returns:
        SafetyCheckResult indicating if the operation is safe
    """
    limit = settings.safety_max_cross_join_rows
    if limit == 0:
        return SafetyCheckResult(safe=True)

    try:
        # Get row counts - may require collection for some data sources
        left_count = left_lf.select(pl.len()).collect().item()
        right_count = right_lf.select(pl.len()).collect().item()
        estimated_output = left_count * right_count

        if estimated_output > limit:
            return SafetyCheckResult(
                safe=False,
                message=(
                    f"Cross join would produce {estimated_output:,} rows "
                    f"({left_count:,} x {right_count:,}, limit: {limit:,}). "
                    f"Consider adding join keys or filtering your inputs first."
                ),
                actual_value=estimated_output,
                limit_value=limit,
            )

        logger.debug(
            f"Cross join safety check passed: "
            f"{left_count} x {right_count} = {estimated_output} rows (limit: {limit})"
        )
        return SafetyCheckResult(safe=True, actual_value=estimated_output, limit_value=limit)

    except Exception as e:
        logger.warning(f"Could not perform cross join safety check: {e}")
        return SafetyCheckResult(safe=True)


def check_unpivot_safety(lf: pl.LazyFrame, columns_to_unpivot: list[str]) -> SafetyCheckResult:
    """
    Check if an unpivot operation is safe by estimating output row count.

    Unpivot multiplies row count by number of columns being unpivoted.

    Args:
        lf: Input LazyFrame
        columns_to_unpivot: Columns being unpivoted (melted)

    Returns:
        SafetyCheckResult indicating if the operation is safe
    """
    limit = settings.safety_max_unpivot_rows
    if limit == 0:
        return SafetyCheckResult(safe=True)

    try:
        row_count = lf.select(pl.len()).collect().item()
        column_count = len(columns_to_unpivot)
        estimated_output = row_count * column_count

        if estimated_output > limit:
            return SafetyCheckResult(
                safe=False,
                message=(
                    f"Unpivot would produce {estimated_output:,} rows "
                    f"({row_count:,} rows x {column_count} columns, limit: {limit:,}). "
                    f"Consider unpivoting fewer columns or filtering your data first."
                ),
                actual_value=estimated_output,
                limit_value=limit,
            )

        logger.debug(
            f"Unpivot safety check passed: "
            f"{row_count} x {column_count} = {estimated_output} rows (limit: {limit})"
        )
        return SafetyCheckResult(safe=True, actual_value=estimated_output, limit_value=limit)

    except Exception as e:
        logger.warning(f"Could not perform unpivot safety check: {e}")
        return SafetyCheckResult(safe=True)


def raise_if_unsafe(result: SafetyCheckResult) -> None:
    """Raise ToolError if safety check failed."""
    if not result.safe:
        raise ToolError(result.message or "Safety check failed")
