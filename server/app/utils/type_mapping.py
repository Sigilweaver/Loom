"""Type mapping utilities between Polars and API models"""

from typing import Any

import polars as pl

from app.domain.models.common import ColumnSchema, DataSchema, PolarsDataType

# Mapping from Polars types to our API enum
POLARS_TO_MODEL: dict[type, PolarsDataType] = {
    pl.Int8: PolarsDataType.INT8,
    pl.Int16: PolarsDataType.INT16,
    pl.Int32: PolarsDataType.INT32,
    pl.Int64: PolarsDataType.INT64,
    pl.UInt8: PolarsDataType.UINT8,
    pl.UInt16: PolarsDataType.UINT16,
    pl.UInt32: PolarsDataType.UINT32,
    pl.UInt64: PolarsDataType.UINT64,
    pl.Float32: PolarsDataType.FLOAT32,
    pl.Float64: PolarsDataType.FLOAT64,
    pl.Decimal: PolarsDataType.DECIMAL,
    pl.Boolean: PolarsDataType.BOOLEAN,
    pl.Utf8: PolarsDataType.UTF8,
    pl.String: PolarsDataType.STRING,
    pl.Date: PolarsDataType.DATE,
    pl.Datetime: PolarsDataType.DATETIME,
    pl.Time: PolarsDataType.TIME,
    pl.Duration: PolarsDataType.DURATION,
    pl.Categorical: PolarsDataType.CATEGORICAL,
    pl.List: PolarsDataType.LIST,
    pl.Struct: PolarsDataType.STRUCT,
}


def polars_dtype_to_model(dtype: pl.DataType) -> PolarsDataType:
    """
    Convert a Polars data type to our API model enum.

    Args:
        dtype: Polars data type

    Returns:
        PolarsDataType enum value
    """
    # Get the type class (not instance)
    dtype_class = type(dtype)

    # Look up in mapping, default to UTF8 if not found
    return POLARS_TO_MODEL.get(dtype_class, PolarsDataType.UTF8)


def schema_from_polars(df: pl.DataFrame | pl.LazyFrame) -> DataSchema:
    """
    Extract schema information from a Polars DataFrame or LazyFrame.

    Args:
        df: Polars DataFrame or LazyFrame

    Returns:
        DataSchema with column information
    """
    columns = []

    schema = df.collect_schema() if isinstance(df, pl.LazyFrame) else df.schema
    for name, dtype in schema.items():
        columns.append(
            ColumnSchema(
                name=name,
                dtype=polars_dtype_to_model(dtype),
                nullable=True,  # Polars doesn't track nullability in schema
            )
        )

    return DataSchema(columns=columns)


def dataframe_to_dict_list(df: pl.DataFrame) -> list[dict[str, Any]]:
    """
    Convert a Polars DataFrame to a list of dictionaries.

    Args:
        df: Polars DataFrame

    Returns:
        List of row dictionaries
    """
    return df.to_dicts()
