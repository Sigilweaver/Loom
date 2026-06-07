"""Shared column-resolution helpers for tool implementations.

This module is the canonical location for column-name resolution used by
filter, sort, join, summarize, pivot, unpivot, etc.

It builds on the lenient helpers in :mod:`app.utils.columns` and adds:

* a *strict* variant that raises :class:`ColumnNotFoundError` (with
  suggestions) instead of silently returning the original name when no
  match is found, and
* a list variant that resolves names in batch.

Tools may use either flavor depending on their preferred error semantics.
"""

from __future__ import annotations

from difflib import get_close_matches

from app.utils.columns import resolve_column_name as _lenient_resolve_column_name
from app.utils.columns import resolve_column_names as _lenient_resolve_column_names

__all__ = [
    "ColumnNotFoundError",
    "resolve_column",
    "resolve_columns",
    "resolve_column_lenient",
    "resolve_columns_lenient",
]


class ColumnNotFoundError(LookupError):
    """Raised when a column name cannot be resolved against a schema.

    Carries a list of suggestion strings (closest matches) so callers and
    API error handlers can surface "did you mean ...?" hints.
    """

    def __init__(self, name: str, suggestions: list[str], context: str = "") -> None:
        self.name = name
        self.suggestions = suggestions
        self.context = context
        ctx = f" ({context})" if context else ""
        if suggestions:
            hint = ", ".join(repr(s) for s in suggestions)
            super().__init__(
                f"Column {name!r} not found{ctx}. Did you mean: {hint}?"
            )
        else:
            super().__init__(f"Column {name!r} not found{ctx}.")


def resolve_column(
    name: str,
    schema: list[str],
    *,
    case_insensitive: bool = True,
    context: str = "",
) -> str:
    """Strict column resolution. Raises :class:`ColumnNotFoundError` on miss.

    Args:
        name: Column name from tool config.
        schema: Actual column names available in the input LazyFrame.
        case_insensitive: If True (default) accept a unique case-insensitive
            match and return the canonically-cased name. If False, only an
            exact match is accepted.
        context: Optional label used in error messages (e.g. "Sort").
    """
    if name in schema:
        return name

    if case_insensitive:
        lower_map: dict[str, list[str]] = {}
        for col in schema:
            lower_map.setdefault(col.lower(), []).append(col)
        matches = lower_map.get(name.lower(), [])
        if len(matches) == 1:
            return matches[0]

    suggestions = get_close_matches(name, schema, n=3, cutoff=0.6)
    raise ColumnNotFoundError(name, suggestions, context=context)


def resolve_columns(
    names: list[str],
    schema: list[str],
    *,
    case_insensitive: bool = True,
    context: str = "",
) -> list[str]:
    """Strict batch column resolution. Raises on the first miss."""
    return [
        resolve_column(n, schema, case_insensitive=case_insensitive, context=context)
        for n in names
    ]


# Lenient re-exports for tools that prefer the "log a warning and pass
# the original name through" semantics already implemented in
# :mod:`app.utils.columns`.
resolve_column_lenient = _lenient_resolve_column_name
resolve_columns_lenient = _lenient_resolve_column_names
