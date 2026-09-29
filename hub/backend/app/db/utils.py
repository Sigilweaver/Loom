"""Small helpers shared by database-touching code."""

from typing import Any, cast

from sqlalchemy import CursorResult, Result


def rows_affected(result: Result[Any]) -> int:
    """Return the number of rows matched by an INSERT/UPDATE/DELETE statement.

    ``AsyncSession.execute`` is typed as returning a generic ``Result``, but
    DML statements always yield a ``CursorResult`` which carries ``rowcount``.
    """
    return int(cast("CursorResult[Any]", result).rowcount)
