"""Data source request/response models"""

from typing import Any

from pydantic import BaseModel, Field

from app.api.models.common import DataSchema
from app.api.models.execution import ValidationResult


class InspectRequest(BaseModel):
    """Request to inspect a data source (generic for all source types)"""

    source_type: str | None = Field(
        None,
        alias="sourceType",
        description="Data source type (csv, parquet, etc.). "
        "If not provided, will be inferred from file extension.",
    )
    source: str = Field(description="Path to the data source file")
    config: dict[str, Any] = Field(
        default_factory=dict, description="Source-specific configuration"
    )


class InspectResponse(BaseModel):
    """Response from data source inspection"""

    data_schema: DataSchema
    validation: ValidationResult | None = None


class PreviewOptions(BaseModel):
    """Options for data preview"""

    max_rows: int = Field(default=100, description="Maximum number of rows to return")
    offset: int = Field(default=0, description="Number of rows to skip")
    columns: list[str] | None = Field(
        None, description="Specific columns to include (null = all columns)"
    )


class PreviewRequest(BaseModel):
    """Request to preview data from a source (generic for all source types)"""

    source_type: str | None = Field(
        None,
        alias="sourceType",
        description="Data source type (csv, parquet, etc.). "
        "If not provided, will be inferred from file extension.",
    )
    source: str = Field(description="Path to the data source file")
    config: dict[str, Any] = Field(
        default_factory=dict, description="Source-specific configuration"
    )
    options: PreviewOptions | None = Field(
        None, description="Preview options (pagination, column selection)"
    )


class DatabaseSchemaRequest(BaseModel):
    """Request to introspect a database connection's tables and columns."""

    source_type: str = Field(
        alias="sourceType",
        description="Database source type (postgresql, mysql, sqlite, mssql).",
    )
    source: str = Field(description="Database connection URI")


class DatabaseColumnInfo(BaseModel):
    """A single column in a database table."""

    name: str = Field(description="Column name")
    type: str = Field(description="Database-reported column type")


class DatabaseTableInfo(BaseModel):
    """A database table with its columns."""

    name: str = Field(description="Table name")
    columns: list[DatabaseColumnInfo] = Field(
        default_factory=list, description="Columns in the table"
    )


class DatabaseSchemaResponse(BaseModel):
    """Response listing tables and columns for a database connection."""

    tables: list[DatabaseTableInfo] = Field(
        default_factory=list, description="Tables discovered in the database"
    )
