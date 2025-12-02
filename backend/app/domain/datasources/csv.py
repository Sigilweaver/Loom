"""CSV data source implementation"""

from typing import Any

import polars as pl

from app.api.models.common import DataPreview, DataSchema
from app.domain.datasources.base import DataSource
from app.utils.errors import DataSourceError
from app.utils.security import validate_file_path
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars


class CSVDataSource(DataSource):
    """CSV file data source using Polars"""

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect CSV file and return schema.
        
        Uses Polars scan_csv (lazy) to avoid reading entire file.
        """
        # Validate file path
        file_path = validate_file_path(source)

        # Build Polars scan configuration
        scan_kwargs = self._build_scan_kwargs(config)

        try:
            # Scan CSV (lazy - doesn't read all data)
            lf = pl.scan_csv(str(file_path), **scan_kwargs)

            # Get schema
            schema = schema_from_polars(lf)

            # Get file info
            schema.file_size_bytes = file_path.stat().st_size

            # Optionally get row count (requires full scan - expensive)
            # schema.row_count = lf.select(pl.len()).collect().item()

            return schema

        except Exception as e:
            raise DataSourceError(f"Failed to inspect CSV: {str(e)}") from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read preview rows from CSV.
        """
        file_path = validate_file_path(source)
        scan_kwargs = self._build_scan_kwargs(config)

        try:
            # Scan and collect preview
            lf = pl.scan_csv(str(file_path), **scan_kwargs)

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
            raise DataSourceError(f"Failed to preview CSV: {str(e)}") from e

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate CSV configuration.
        """
        errors = []

        # Validate separator
        if "separator" in config:
            sep = config["separator"]
            if not isinstance(sep, str) or len(sep) == 0:
                errors.append("separator must be a non-empty string")

        # Validate skip_rows
        if "skip_rows" in config:
            skip_rows = config["skip_rows"]
            if not isinstance(skip_rows, int) or skip_rows < 0:
                errors.append("skip_rows must be >= 0")

        # Validate n_rows
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")

        return errors

    def _build_scan_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars scan_csv kwargs.
        
        Maps frontend configuration keys to Polars parameter names.
        """
        kwargs: dict[str, Any] = {}

        # Key mapping: frontend -> polars
        key_mapping = {
            "separator": "separator",
            "has_header": "has_header",
            "skip_rows": "skip_rows",
            "skip_rows_after_header": "skip_rows_after_header",
            "n_rows": "n_rows",
            "encoding": "encoding",
            "quote_char": "quote_char",
            "eol_char": "eol_char",
            "null_values": "null_values",
            "comment_prefix": "comment_prefix",
            "infer_schema_length": "infer_schema_length",
            "ignore_errors": "ignore_errors",
            "try_parse_dates": "try_parse_dates",
            "truncate_ragged_lines": "truncate_ragged_lines",
            "decimal_comma": "decimal_comma",
            "rechunk": "rechunk",
            "low_memory": "low_memory",
            "cache": "cache",
        }

        # Transfer config values
        for frontend_key, polars_key in key_mapping.items():
            if frontend_key in config:
                value = config[frontend_key]
                if value is not None:
                    kwargs[polars_key] = value

        return kwargs
