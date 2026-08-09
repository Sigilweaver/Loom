"""Shared policy for SQL queries executed through Loom connections."""

import re


class ReadOnlyQueryError(ValueError):
    """Raised when a query contains an operation Loom does not permit."""


_FORBIDDEN_SQL_PATTERN = re.compile(
    r"\b(DROP|ALTER|CREATE|DELETE|UPDATE|INSERT|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|CALL)\b",
    re.IGNORECASE,
)


def validate_readonly_query(query: str) -> None:
    """Reject DDL and write DML after removing SQL comments.

    This is a defense-in-depth policy, not a SQL parser. Database credentials
    should still have the minimum permissions needed by a workflow.
    """
    stripped = re.sub(r"--[^\n]*", "", query)
    stripped = re.sub(r"/\*.*?\*/", "", stripped, flags=re.DOTALL)

    if _FORBIDDEN_SQL_PATTERN.search(stripped):
        raise ReadOnlyQueryError(
            "Only SELECT queries are allowed. DDL and write operations "
            "(DROP, ALTER, CREATE, DELETE, UPDATE, INSERT, TRUNCATE) are forbidden."
        )
