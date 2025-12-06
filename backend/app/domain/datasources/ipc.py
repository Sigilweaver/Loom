"""IPC/Arrow data source implementation"""

from typing import Any

import polars as pl

from app.api.models.common import DataPreview, DataSchema
from app.domain.datasources.base import DataSource
from app.utils.errors import DataSourceError
from app.utils.security import validate_file_path
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars


class IPCDataSource(DataSource):
    """IPC/Arrow file data source using Polars

    Supports .arrow, .ipc, and .feather file extensions.
    IPC (Inter-Process Communication) is Apache Arrow's native binary format,
    designed for zero-copy data sharing and maximum read/write performance.
    """

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect IPC file and return schema.

        Uses Polars scan_ipc (lazy) to avoid reading entire file.
        """
        # Validate file path
        file_path = validate_file_path(source)

        # Build Polars scan configuration
        scan_kwargs = self._build_scan_kwargs(config)

        try:
            # Scan IPC (lazy - doesn't read all data)
            lf = pl.scan_ipc(str(file_path), **scan_kwargs)

            # Get schema
            schema = schema_from_polars(lf)

            # Get file info
            schema.file_size_bytes = file_path.stat().st_size

            return schema

        except Exception as e:
            raise DataSourceError(f"Failed to inspect IPC file: {str(e)}") from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read preview rows from IPC file.
        """
        file_path = validate_file_path(source)
        scan_kwargs = self._build_scan_kwargs(config)

        try:
            # Scan and collect preview
            lf = pl.scan_ipc(str(file_path), **scan_kwargs)

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
            raise DataSourceError(f"Failed to preview IPC file: {str(e)}") from e

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate IPC configuration.
        """
        errors = []

        # Validate n_rows
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")

        # Validate row_index_offset
        if "row_index_offset" in config:
            offset = config["row_index_offset"]
            if offset is not None and (not isinstance(offset, int) or offset < 0):
                errors.append("row_index_offset must be >= 0")

        # Validate retries
        if "retries" in config:
            retries = config["retries"]
            if retries is not None and (not isinstance(retries, int) or retries < 0):
                errors.append("retries must be >= 0")

        return errors

    def _build_scan_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Build kwargs for pl.scan_ipc from config"""
        kwargs: dict[str, Any] = {}

        # Map config keys to Polars parameters
        key_mapping = {
            "n_rows": "n_rows",
            "cache": "cache",
            "rechunk": "rechunk",
            "row_index_name": "row_index_name",
            "row_index_offset": "row_index_offset",
            "memory_map": "memory_map",
            "retries": "retries",
            "hive_partitioning": "hive_partitioning",
            "hive_schema": "hive_schema",
            "try_parse_hive_dates": "try_parse_hive_dates",
        }

        for config_key, polars_key in key_mapping.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:
                    kwargs[polars_key] = value

        return kwargs
