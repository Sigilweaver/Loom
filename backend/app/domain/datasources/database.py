"""Database data source for schema inspection and data preview.

Handles database connections for:
- Schema inspection (table/query column information)
- Data preview (limited rows from query results)
- Configuration validation

Uses Polars' read_database_uri with connectorx engine.
"""

from typing import Any

import polars as pl

from app.api.models.common import (
    ColumnSchema,
    DataPreview,
    DataSchema,
    PolarsDataType,
)
from app.domain.datasources.base import DataSource
from app.utils.errors import DataSourceError


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

        except Exception as e:
            # If the LIMIT 0 wrapper fails, try original query with small limit
            try:
                df = pl.read_database_uri(
                    query=query,
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


class PostgreSQLDataSource(DatabaseDataSource):
    """PostgreSQL-specific data source."""
    
    def __init__(self):
        super().__init__(database_type="postgresql")
