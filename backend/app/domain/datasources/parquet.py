"""Parquet data source implementation"""

from typing import Any

import polars as pl

from app.api.models.common import DataPreview, DataSchema
from app.domain.datasources.base import DataSource
from app.utils.errors import DataSourceError
from app.utils.security import validate_file_path
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars


class ParquetDataSource(DataSource):
    """Parquet file data source using Polars"""

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect Parquet file and return schema.

        Uses Polars scan_parquet (lazy) to avoid reading entire file.
        """
        # Validate file path
        file_path = validate_file_path(source)

        # Build Polars scan configuration
        scan_kwargs = self._build_scan_kwargs(config)

        try:
            # Scan Parquet (lazy - doesn't read all data)
            lf = pl.scan_parquet(str(file_path), **scan_kwargs)

            # Get schema
            schema = schema_from_polars(lf)

            # Get file info
            schema.file_size_bytes = file_path.stat().st_size

            # Optionally get row count (requires full scan - expensive)
            # schema.row_count = lf.select(pl.len()).collect().item()

            return schema

        except Exception as e:
            raise DataSourceError(f"Failed to inspect Parquet: {str(e)}") from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read preview rows from Parquet.
        """
        file_path = validate_file_path(source)
        scan_kwargs = self._build_scan_kwargs(config)

        try:
            # Scan and collect preview
            lf = pl.scan_parquet(str(file_path), **scan_kwargs)

            # Apply column filter if specified
            if columns:
                lf = lf.select(columns)

            # Skip rows and limit
            if offset > 0:
                lf = lf.slice(offset, max_rows)
            else:
                lf = lf.head(max_rows)

            # Collect the data
            df = lf.collect()

            # Convert to response format
            return DataPreview(
                data_schema=schema_from_polars(df),
                data=dataframe_to_dict_list(df),
                total_rows=None,  # Would require full scan
                returned_rows=len(df),
            )

        except Exception as e:
            raise DataSourceError(f"Failed to preview Parquet: {str(e)}") from e

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate Parquet configuration.
        """
        errors = []

        # Validate n_rows
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")

        # Validate row_index parameters
        if "row_index_name" in config:
            row_index_name = config["row_index_name"]
            if row_index_name is not None and not isinstance(row_index_name, str):
                errors.append("row_index_name must be a string or null")

        if "row_index_offset" in config:
            row_index_offset = config["row_index_offset"]
            if not isinstance(row_index_offset, int) or row_index_offset < 0:
                errors.append("row_index_offset must be >= 0")

        return errors

    def _build_scan_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars scan_parquet kwargs.

        Maps frontend configuration keys to Polars parameter names.
        Note: Column selection should be done via .select() after scan,
        not as a scan parameter.
        """
        kwargs: dict[str, Any] = {}

        # Key mapping: frontend -> polars
        key_mapping = {
            "n_rows": "n_rows",
            "row_index_name": "row_index_name",
            "row_index_offset": "row_index_offset",
            "parallel": "parallel",
            "use_statistics": "use_statistics",
            "hive_partitioning": "hive_partitioning",
            "hive_schema": "hive_schema",
            "try_parse_hive_dates": "try_parse_hive_dates",
            "rechunk": "rechunk",
            "low_memory": "low_memory",
            "cache": "cache",
            "retries": "retries",
        }

        # Transfer config values
        for frontend_key, polars_key in key_mapping.items():
            if frontend_key in config:
                value = config[frontend_key]
                if value is not None:
                    kwargs[polars_key] = value

        return kwargs
