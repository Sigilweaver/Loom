"""Column name resolution utilities.

Provides case-insensitive column name matching to handle common AI agent
errors where column name casing doesn't match the actual data (e.g. the
agent writes "Sex" but the column is "sex").

When a column name doesn't match exactly, we attempt a case-insensitive
lookup and log a warning. This prevents hard failures while keeping the
pipeline flowing.
"""

import re

import structlog

logger = structlog.get_logger(__name__)


def resolve_column_name(
    requested: str,
    available: list[str],
    *,
    context: str = "",
) -> str:
    """Resolve a column name against available columns, with case-insensitive fallback.

    If the exact name is found, returns it unchanged. If not, tries a
    case-insensitive match. Returns the corrected name on match, or the
    original name if no match is found (letting Polars raise its own error).

    Args:
        requested: The column name requested by the tool config.
        available: List of actual column names from the LazyFrame schema.
        context: Optional context string for log messages (e.g. "Summarize groupBy").

    Returns:
        The resolved column name (corrected casing if needed).
    """
    if requested in available:
        return requested

    # Build a case-insensitive lookup
    lower_map: dict[str, list[str]] = {}
    for col in available:
        lower_map.setdefault(col.lower(), []).append(col)

    matches = lower_map.get(requested.lower(), [])
    if len(matches) == 1:
        corrected = matches[0]
        logger.warning(
            "Auto-corrected column name casing",
            requested=requested,
            corrected=corrected,
            context=context,
        )
        return corrected

    # Multiple matches (unlikely) or no match - return original and let Polars error
    return requested


def resolve_column_names(
    requested: list[str],
    available: list[str],
    *,
    context: str = "",
) -> list[str]:
    """Resolve a list of column names with case-insensitive fallback.

    Args:
        requested: List of column names requested by the tool config.
        available: List of actual column names from the LazyFrame schema.
        context: Optional context string for log messages.

    Returns:
        List of resolved column names.
    """
    return [resolve_column_name(r, available, context=context) for r in requested]


# Matches pl.col("name") or pl.col('name') - captures the quote char and column name
_PL_COL_PATTERN = re.compile(r"""pl\.col\((['"])(.*?)\1\)""")


def resolve_expression_columns(
    expression: str,
    available: list[str],
    *,
    context: str = "",
) -> str:
    """Resolve column references in a Polars expression string.

    Finds all ``pl.col("name")`` and ``pl.col('name')`` references and
    corrects the casing if a case-insensitive match exists. Leaves the
    expression unchanged if all column names already match or if no
    case-insensitive match is found.

    Args:
        expression: Polars expression string.
        available: List of actual column names from the LazyFrame schema.
        context: Optional context string for log messages.

    Returns:
        Expression with corrected column name casing.
    """
    # Build case-insensitive lookup once
    lower_map: dict[str, list[str]] = {}
    for col in available:
        lower_map.setdefault(col.lower(), []).append(col)

    def _replace(match: re.Match[str]) -> str:
        quote = match.group(1)
        col_name = match.group(2)

        if col_name in available:
            return match.group(0)  # exact match, no change

        matches = lower_map.get(col_name.lower(), [])
        if len(matches) == 1:
            corrected = matches[0]
            logger.warning(
                "Auto-corrected column name in expression",
                requested=col_name,
                corrected=corrected,
                context=context,
            )
            return f"pl.col({quote}{corrected}{quote})"

        return match.group(0)  # no match or ambiguous - leave as-is

    return _PL_COL_PATTERN.sub(_replace, expression)
