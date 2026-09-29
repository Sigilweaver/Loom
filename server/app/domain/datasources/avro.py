"""Avro data source implementation"""

from typing import Any

import polars as pl

from app.domain.datasources.base import DataSource
from app.domain.models.common import DataPreview, DataSchema
from app.utils.errors import DataSourceError
from app.utils.security import validate_file_path
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars


class AvroDataSource(DataSource):
    """Avro file data source using Polars

    Apache Avro is a row-based binary data format commonly used in
    big data ecosystems (Hadoop, Kafka, Spark).

    Note: Polars only supports eager read for Avro (no lazy scan).
    """

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect Avro file and return schema.

        Note: Avro does not support lazy scanning in Polars,
        so we read a minimal number of rows to get the schema.
        """
        # Validate file path
        file_path = validate_file_path(source)

        try:
            # Read minimal rows to get schema (Avro has no lazy scan)
            df = pl.read_avro(str(file_path), n_rows=1)

            # Get schema
            schema = schema_from_polars(df)

            # Get file info
            schema.file_size_bytes = file_path.stat().st_size

            return schema

        except Exception as e:
            raise DataSourceError(f"Failed to inspect Avro file: {str(e)}") from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read preview rows from Avro file.

        Note: Avro does not support lazy scanning, so we read eagerly.
        Offset is handled by slicing the DataFrame after read.
        """
        file_path = validate_file_path(source)
        read_kwargs = self._build_read_kwargs(config)

        try:
            # For preview with offset, we need to read more rows
            # then slice. n_rows in read_avro is from start of file.
            if offset > 0:
                # Read offset + max_rows
                read_kwargs["n_rows"] = offset + max_rows
                df = pl.read_avro(str(file_path), **read_kwargs)
                # Apply offset via slicing
                df = df.slice(offset, max_rows)
            else:
                read_kwargs["n_rows"] = max_rows
                df = pl.read_avro(str(file_path), **read_kwargs)

            # Apply column filter if specified
            if columns:
                df = df.select(columns)

            # Convert to response format
            return DataPreview(
                data_schema=schema_from_polars(df),
                data=dataframe_to_dict_list(df),
                total_rows=None,  # Would require full read
                returned_rows=len(df),
            )

        except Exception as e:
            raise DataSourceError(f"Failed to preview Avro file: {str(e)}") from e

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate Avro configuration.
        """
        errors = []

        # Validate n_rows
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")

        # Validate columns (if provided, must be list)
        if "columns" in config:
            columns = config["columns"]
            if columns is not None:
                if not isinstance(columns, list):
                    errors.append("columns must be a list")
                elif not all(isinstance(c, (str, int)) for c in columns):
                    errors.append("columns must be a list of strings or integers")

        return errors

    def _build_read_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Build kwargs for pl.read_avro from config"""
        kwargs: dict[str, Any] = {}

        # read_avro parameters:
        # - columns: list[int] | list[str] | None
        # - n_rows: int | None

        if "columns" in config:
            value = config["columns"]
            if value is not None and value:  # Non-empty list
                kwargs["columns"] = value

        if "n_rows" in config:
            value = config["n_rows"]
            if value is not None:
                kwargs["n_rows"] = value

        return kwargs
