"""YXDB (Alteryx Database) data source implementation

Uses SigilYX for reading YXDB files - a high-performance Rust-based
reader/writer for the Alteryx .yxdb format.

Not affiliated with Alteryx, Inc.
"""

from typing import Any

import sigilyx  # type: ignore[import-untyped]

from app.api.models.common import ColumnSchema, DataPreview, DataSchema, PolarsDataType
from app.domain.datasources.base import DataSource
from app.utils.errors import DataSourceError
from app.utils.security import validate_file_path
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars

# Mapping from YXDB field types (as reported by sigilyx.read_schema) to PolarsDataType.
# This allows inspect() to derive the schema from metadata alone — no data read needed.
_YXDB_TYPE_MAP: dict[str, PolarsDataType] = {
    "Bool": PolarsDataType.BOOLEAN,
    "Byte": PolarsDataType.INT16,
    "Int16": PolarsDataType.INT16,
    "Int32": PolarsDataType.INT32,
    "Int64": PolarsDataType.INT64,
    "Float": PolarsDataType.FLOAT32,
    "Double": PolarsDataType.FLOAT64,
    "FixedDecimal": PolarsDataType.FLOAT64,
    "String": PolarsDataType.STRING,
    "WString": PolarsDataType.STRING,
    "VString": PolarsDataType.STRING,
    "VWString": PolarsDataType.STRING,
    "Date": PolarsDataType.DATE,
    "Time": PolarsDataType.TIME,
    "DateTime": PolarsDataType.DATETIME,
    "Blob": PolarsDataType.STRING,
    "SpatialObj": PolarsDataType.STRING,
}


class YxdbDataSource(DataSource):
    """YXDB file data source using SigilYX

    Reads Alteryx .yxdb files with full support for all 17 YXDB field types.
    Uses a high-performance Rust core for parsing.
    """

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect YXDB file and return schema.

        Uses header-only reads (read_schema + record_count) to extract field
        information and row count without loading any data rows into memory.
        """
        file_path = validate_file_path(source)

        try:
            # Header-only: extract field metadata without reading data rows
            fields = sigilyx.read_schema(str(file_path))

            columns = [
                ColumnSchema(
                    name=f["name"],
                    dtype=_YXDB_TYPE_MAP.get(f["type"], PolarsDataType.STRING),
                    nullable=True,
                )
                for f in fields
            ]

            return DataSchema(
                columns=columns,
                row_count=sigilyx.record_count(str(file_path)),
                file_size_bytes=file_path.stat().st_size,
            )

        except Exception as e:
            raise DataSourceError(f"Failed to inspect YXDB file: {e!s}") from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read preview rows from YXDB file.
        """
        file_path = validate_file_path(source)

        try:
            # YXDB is row-based with LZF compression — partial reads require
            # sequential decompression, so the full file is read and sliced.
            df = sigilyx.read_yxdb(str(file_path))

            # Apply column filter if specified
            if columns:
                df = df.select(columns)

            total_rows = df.height

            # Apply offset and limit
            if offset > 0:
                df = df.slice(offset, max_rows)
            else:
                df = df.head(max_rows)

            return DataPreview(
                data_schema=schema_from_polars(df.lazy()),
                data=dataframe_to_dict_list(df),
                total_rows=total_rows,
                returned_rows=len(df),
            )

        except Exception as e:
            raise DataSourceError(f"Failed to preview YXDB file: {e!s}") from e

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate YXDB configuration.

        YXDB has minimal configuration - just a file path.
        """
        errors: list[str] = []

        # Validate n_rows if provided
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")

        return errors
