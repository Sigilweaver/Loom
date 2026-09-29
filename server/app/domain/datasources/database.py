"""Database data source for schema inspection and data preview.

Handles database connections for:
- Schema inspection (table/query column information)
- Data preview (limited rows from query results)
- Configuration validation

Uses Polars' read_database_uri with connectorx engine.
"""

from typing import Any

import polars as pl

from app.domain.connections.query_policy import (
    ReadOnlyQueryError,
    validate_readonly_query,
)
from app.domain.datasources.base import DataSource
from app.domain.models.common import (
    ColumnSchema,
    DataPreview,
    DataSchema,
    PolarsDataType,
)
from app.utils.errors import DataSourceError


def _validate_readonly_query(query: str) -> None:
    """Reject anything but a SELECT (shared connection policy), as a DataSourceError."""
    try:
        validate_readonly_query(query)
    except ReadOnlyQueryError as e:
        raise DataSourceError(str(e)) from e


def _dtype_to_polars_type(dtype: pl.DataType) -> PolarsDataType:
    """Convert a Polars dtype to our PolarsDataType enum."""
    dtype_str = str(dtype)
    # Handle common type mappings
    dtype_mapping = {
        "Int8": PolarsDataType.INT8,
        "Int16": PolarsDataType.INT16,
        "Int32": PolarsDataType.INT32,
        "Int64": PolarsDataType.INT64,
        "UInt8": PolarsDataType.UINT8,
        "UInt16": PolarsDataType.UINT16,
        "UInt32": PolarsDataType.UINT32,
        "UInt64": PolarsDataType.UINT64,
        "Float32": PolarsDataType.FLOAT32,
        "Float64": PolarsDataType.FLOAT64,
        "Boolean": PolarsDataType.BOOLEAN,
        "Utf8": PolarsDataType.UTF8,
        "String": PolarsDataType.STRING,
        "Date": PolarsDataType.DATE,
        "Time": PolarsDataType.TIME,
    }

    # Check for exact match first
    if dtype_str in dtype_mapping:
        return dtype_mapping[dtype_str]

    # Handle parameterized types (Datetime, Duration, List, etc.)
    if dtype_str.startswith("Datetime"):
        return PolarsDataType.DATETIME
    if dtype_str.startswith("Duration"):
        return PolarsDataType.DURATION
    if dtype_str.startswith("Decimal"):
        return PolarsDataType.DECIMAL
    if dtype_str.startswith("List"):
        return PolarsDataType.LIST
    if dtype_str.startswith("Struct"):
        return PolarsDataType.STRUCT
    if dtype_str.startswith("Categorical"):
        return PolarsDataType.CATEGORICAL

    # Default to String for unknown types
    return PolarsDataType.STRING


def _schema_introspection_query(database_type: str) -> str:
    """Return a read-only catalog query listing tables and their columns.

    The query yields rows with normalized lowercase aliases:
    ``table_name``, ``column_name``, ``data_type`` and ``ordinal_position``.

    Args:
        database_type: One of postgresql, mysql, sqlite, mssql.

    Raises:
        DataSourceError: If the database type is not supported.
    """
    db = database_type.lower()

    if db == "postgresql":
        return (
            "SELECT table_name, column_name, data_type, ordinal_position "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' "
            "ORDER BY table_name, ordinal_position"
        )

    if db == "mysql":
        return (
            "SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, "
            "COLUMN_TYPE AS data_type, ORDINAL_POSITION AS ordinal_position "
            "FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "ORDER BY TABLE_NAME, ORDINAL_POSITION"
        )

    if db == "mssql":
        return (
            "SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, "
            "DATA_TYPE AS data_type, ORDINAL_POSITION AS ordinal_position "
            "FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA') "
            "ORDER BY TABLE_NAME, ORDINAL_POSITION"
        )

    if db == "sqlite":
        return (
            "SELECT m.name AS table_name, p.name AS column_name, "
            "p.type AS data_type, p.cid AS ordinal_position "
            "FROM sqlite_master m, pragma_table_info(m.name) p "
            "WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' "
            "ORDER BY m.name, p.cid"
        )

    raise DataSourceError(
        f"Schema introspection is not supported for database type: {database_type}"
    )


class DatabaseDataSource(DataSource):
    """Data source for database connections using SQL queries."""

    def __init__(self, database_type: str = "postgresql"):
        """
        Initialize database data source.

        Args:
            database_type: Type of database (postgresql, mysql, etc.)
        """
        self.database_type = database_type

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect a database query and return schema information.

        Args:
            source: Connection URI
            config: Configuration containing SQL query

        Returns:
            DataSchema with column information

        Raises:
            DataSourceError: If inspection fails
        """
        query = config.get("query", "")
        if not query.strip():
            return DataSchema(columns=[], row_count=None)

        _validate_readonly_query(query)

        try:
            # Execute query with LIMIT 0 to get schema without data
            # Wrap the query to avoid modifying complex queries
            schema_query = f"SELECT * FROM ({query}) AS _schema_query LIMIT 0"

            df = pl.read_database_uri(
                query=schema_query,
                uri=source,
                engine="connectorx",
            )

            columns = [
                ColumnSchema(
                    name=col,
                    dtype=_dtype_to_polars_type(df.schema[col]),
                    nullable=True,  # Polars doesn't expose nullability from DB
                )
                for col in df.columns
            ]

            return DataSchema(columns=columns, row_count=None)

        except Exception:
            # If the LIMIT 0 wrapper fails, try original query with a small limit
            try:
                limited_query = f"SELECT * FROM ({query}) AS _schema_fallback LIMIT 1"
                df = pl.read_database_uri(
                    query=limited_query,
                    uri=source,
                    engine="connectorx",
                )

                columns = [
                    ColumnSchema(
                        name=col,
                        dtype=_dtype_to_polars_type(df.schema[col]),
                        nullable=True,
                    )
                    for col in df.columns
                ]

                return DataSchema(columns=columns, row_count=len(df))

            except Exception as inner_e:
                raise DataSourceError(f"Failed to inspect database query: {inner_e}")

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Preview data from a database query.

        Args:
            source: Connection URI
            config: Configuration containing SQL query
            max_rows: Maximum number of rows to return
            offset: Number of rows to skip (note: may not be efficient for large offsets)
            columns: Specific columns to include (None = all)

        Returns:
            DataPreview with schema and sample data

        Raises:
            DataSourceError: If preview fails
        """
        query = config.get("query", "")
        if not query.strip():
            return DataPreview(
                data_schema=DataSchema(columns=[], row_count=None),
                data=[],
                total_rows=0,
                returned_rows=0,
            )

        _validate_readonly_query(query)

        try:
            # For preview, we add LIMIT/OFFSET to the query
            # Note: This wraps the user query, which handles most cases
            # but may not be optimal for all databases
            limited_query = f"""
                SELECT * FROM ({query}) AS _preview_query
                LIMIT {max_rows}
                OFFSET {offset}
            """

            df = pl.read_database_uri(
                query=limited_query,
                uri=source,
                engine="connectorx",
            )

            # Apply column filter if specified
            if columns:
                available = [c for c in columns if c in df.columns]
                if available:
                    df = df.select(available)

            # Build schema
            schema_columns = [
                ColumnSchema(
                    name=col,
                    dtype=_dtype_to_polars_type(df.schema[col]),
                    nullable=True,
                )
                for col in df.columns
            ]

            # Convert to row format
            rows = df.to_dicts()

            return DataPreview(
                data_schema=DataSchema(columns=schema_columns, row_count=None),
                data=rows,
                total_rows=None,  # We don't know the true total without another query
                returned_rows=len(rows),
            )

        except Exception as e:
            raise DataSourceError(f"Failed to preview database query: {e}")

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate configuration for database data source.

        Args:
            config: Configuration to validate

        Returns:
            List of error messages (empty if valid)
        """
        errors: list[str] = []

        # Connection URI is required (passed as source, not in config)
        # But we validate query is present
        query = config.get("query")
        if not query:
            errors.append("SQL query is required")
        elif not query.strip():
            errors.append("SQL query cannot be empty")

        return errors

    async def list_schema(self, source: str) -> list[dict[str, Any]]:
        """Introspect the database and list tables with their columns.

        Args:
            source: Connection URI.

        Returns:
            A list of tables, each as ``{"name": str, "columns": [...]}``
            where every column is ``{"name": str, "type": str}``.

        Raises:
            DataSourceError: If introspection fails.
        """
        introspection_query = _schema_introspection_query(self.database_type)

        try:
            df = pl.read_database_uri(
                query=introspection_query,
                uri=source,
                engine="connectorx",
            )
        except Exception as e:
            raise DataSourceError(f"Failed to introspect database schema: {e}")

        # Normalize column names to lowercase so dialect casing differences
        # (e.g. MySQL uppercase aliases) do not matter when reading rows.
        df = df.rename({col: col.lower() for col in df.columns})

        tables: dict[str, list[dict[str, str]]] = {}
        for row in df.to_dicts():
            table_name = row.get("table_name")
            column_name = row.get("column_name")
            if table_name is None or column_name is None:
                continue
            data_type = row.get("data_type")
            tables.setdefault(str(table_name), []).append(
                {
                    "name": str(column_name),
                    "type": str(data_type) if data_type is not None else "unknown",
                }
            )

        return [{"name": name, "columns": columns} for name, columns in tables.items()]


class PostgreSQLDataSource(DatabaseDataSource):
    """PostgreSQL-specific data source."""

    def __init__(self) -> None:
        super().__init__(database_type="postgresql")


class MySQLDataSource(DatabaseDataSource):
    """MySQL-specific data source."""

    def __init__(self) -> None:
        super().__init__(database_type="mysql")


class SQLiteDataSource(DatabaseDataSource):
    """SQLite-specific data source."""

    def __init__(self) -> None:
        super().__init__(database_type="sqlite")


class MsSQLDataSource(DatabaseDataSource):
    """Microsoft SQL Server-specific data source."""

    def __init__(self) -> None:
        super().__init__(database_type="mssql")
