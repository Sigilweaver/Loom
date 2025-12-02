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
        description="Data source type (csv, parquet, etc.). If not provided, will be inferred from file extension.",
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
        description="Data source type (csv, parquet, etc.). If not provided, will be inferred from file extension.",
    )
    source: str = Field(description="Path to the data source file")
    config: dict[str, Any] = Field(
        default_factory=dict, description="Source-specific configuration"
    )
    options: PreviewOptions | None = Field(
        None, description="Preview options (pagination, column selection)"
    )
