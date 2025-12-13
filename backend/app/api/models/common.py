"""Common data models shared across the API"""

from enum import Enum
from typing import Any

from pydantic import BaseModel


class PolarsDataType(str, Enum):
    """Polars data types matching frontend TypeScript enum"""

    INT8 = "Int8"
    INT16 = "Int16"
    INT32 = "Int32"
    INT64 = "Int64"
    UINT8 = "UInt8"
    UINT16 = "UInt16"
    UINT32 = "UInt32"
    UINT64 = "UInt64"
    FLOAT32 = "Float32"
    FLOAT64 = "Float64"
    DECIMAL = "Decimal"
    BOOLEAN = "Boolean"
    UTF8 = "Utf8"
    STRING = "String"
    DATE = "Date"
    DATETIME = "Datetime"
    TIME = "Time"
    DURATION = "Duration"
    CATEGORICAL = "Categorical"
    LIST = "List"
    STRUCT = "Struct"


class ColumnSchema(BaseModel):
    """Schema information for a single column"""

    name: str
    dtype: PolarsDataType
    nullable: bool
    description: str | None = None


class DataSchema(BaseModel):
    """Schema information for a dataset"""

    columns: list[ColumnSchema]
    row_count: int | None = None
    file_size_bytes: int | None = None


class DataPreview(BaseModel):
    """Data preview with schema and sample rows"""

    data_schema: DataSchema
    data: list[dict[str, Any]]
    total_rows: int | None = None  # None if unknown without full scan
    returned_rows: int
