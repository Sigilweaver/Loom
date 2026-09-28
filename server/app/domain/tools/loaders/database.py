"""Database loader for SQL query execution against database connections.

This loader handles database connections using Polars' read_database_uri function
with the connectorx engine. Unlike file-based loaders, this requires:
1. A connection URI (built from resolved connection credentials)
2. A SQL query to execute

The loader always produces eager DataFrames (converted to LazyFrames for consistency)
since connectorx doesn't support lazy evaluation.
"""

from typing import Any

import polars as pl

from app.domain.connections.query_policy import (
    ReadOnlyQueryError,
    validate_readonly_query,
)
from app.domain.connections.uri import guard_database_uri
from app.domain.tools.loaders.base import FileLoader
from app.utils.errors import ToolError


class DatabaseLoader(FileLoader):
    """
    Loader for executing SQL queries against database connections.

    This loader uses Polars' read_database_uri with connectorx engine
    to execute SQL queries and return the results as a LazyFrame.

    Note: Unlike file loaders, the 'source' parameter is a connection URI,
    not a file path. The URI format depends on the database type:
    - PostgreSQL: postgresql://user:password@host:port/database
    - MySQL: mysql://user:password@host:port/database
    - SQLite: sqlite:///path/to/database.db
    - SQL Server: mssql://user:password@host:port/database?encrypt=true&trust_server_certificate=true
    """

    def __init__(self, database_type: str = "postgresql"):
        """
        Initialize database loader.

        Args:
            database_type: Type of database (postgresql, mysql, etc.)
        """
        self.database_type = database_type

    async def load(
        self,
        config: dict[str, Any],
    ) -> pl.LazyFrame:
        """
        Execute a SQL query against a database connection.

        Args:
            config: Configuration dict containing:
                - source: Connection URI (e.g., postgresql://user:pass@host:port/db)
                - query: SQL query to execute (required)

        Returns:
            LazyFrame containing query results

        Raises:
            ToolError: If query fails or connection cannot be established
        """
        source = config.get("source", "")
        if not source:
            raise ToolError("Database connection URI is required")

        query = config.get("query")
        if not query:
            raise ToolError("SQL query is required for database loading")

        query = query.strip()
        if not query:
            raise ToolError("SQL query cannot be empty")

        try:
            validate_readonly_query(query)
        except ReadOnlyQueryError as e:
            raise ToolError(str(e)) from e

        # Security: SQLite URIs name a local file, so apply the file-access rules.
        source = guard_database_uri(source)

        try:
            # read_database_uri returns a DataFrame (eager)
            # We convert to LazyFrame for consistency with the rest of the system
            df = pl.read_database_uri(
                query=query,
                uri=source,
                engine="connectorx",
            )
            return df.lazy()

        except Exception as e:
            error_msg = str(e)

            # Provide more helpful error messages for common issues
            if "connection refused" in error_msg.lower():
                raise ToolError(
                    f"Cannot connect to {self.database_type} database. "
                    "Please verify the server is running and the connection details are correct."
                )
            elif "authentication failed" in error_msg.lower() or "password" in error_msg.lower():
                raise ToolError(
                    f"Authentication failed for {self.database_type} database. "
                    "Please verify your username and password."
                )
            elif "does not exist" in error_msg.lower() and "database" in error_msg.lower():
                raise ToolError("Database does not exist. Please verify the database name.")
            elif "syntax error" in error_msg.lower():
                raise ToolError(f"SQL syntax error: {error_msg}")
            else:
                raise ToolError(f"Database query failed: {error_msg}")

    async def load_eager(
        self,
        config: dict[str, Any],
    ) -> pl.DataFrame:
        """
        Execute a SQL query and return a DataFrame directly.

        Args:
            config: Configuration dict containing source URI and query

        Returns:
            DataFrame containing query results
        """
        lf = await self.load(config)
        return lf.collect()

    def build_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Build kwargs for database query.

        For databases, this is minimal since most config is in the URI and query.

        Args:
            config: Configuration dict

        Returns:
            Dict with engine specification
        """
        return {
            "engine": "connectorx",
        }

    def to_python_code(
        self,
        var_name: str,
        config: dict[str, Any],
    ) -> list[str]:
        """
        Generate Python code for database loading.

        Note: The actual connection URI is replaced with a placeholder
        for security - users should never see credentials in generated code.

        Args:
            var_name: Variable name to assign result to
            config: Configuration dict

        Returns:
            List of Python code lines
        """
        query = config.get("query", "SELECT 1")

        # Escape the query for multi-line string
        escaped_query = query.replace('"""', '\\"\\"\\"')

        lines = [
            f"# Database query from {self.database_type}",
            "# NOTE: Replace CONNECTION_URI with your actual connection string",
            f'CONNECTION_URI = "{self.database_type}://user:password@host:port/database"',
            f"{var_name} = pl.read_database_uri(",
            f'    query="""{escaped_query}""",',
            "    uri=CONNECTION_URI,",
            '    engine="connectorx",',
            ").lazy()",
        ]

        return lines
