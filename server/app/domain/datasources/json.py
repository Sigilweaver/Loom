"""JSON data source implementation

Supports two JSON formats:
- Standard JSON (.json): Array of objects, eager read only via pl.read_json
- NDJSON (.jsonl, .ndjson): Newline-delimited JSON, supports lazy scan via pl.scan_ndjson
"""

from pathlib import Path
from typing import Any

import polars as pl

from app.api.models.common import DataPreview, DataSchema
from app.domain.datasources.base import DataSource
from app.utils.errors import DataSourceError
from app.utils.security import validate_file_path
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars


class JSONDataSource(DataSource):
    """JSON file data source using Polars

    Supports both standard JSON (array of objects) and NDJSON (newline-delimited).
    Format is auto-detected based on file extension:
    - .json: Standard JSON (eager only)
    - .jsonl, .ndjson: NDJSON (supports lazy scan)
    """

    # Extensions that indicate NDJSON format
    NDJSON_EXTENSIONS = {".jsonl", ".ndjson"}

    def _is_ndjson(self, file_path: str | Path) -> bool:
        """Check if file is NDJSON based on extension"""
        path = Path(file_path)
        return path.suffix.lower() in self.NDJSON_EXTENSIONS

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect JSON file and return schema.

        For NDJSON, uses scan_ndjson (lazy) to avoid reading entire file.
        For standard JSON, reads a sample to infer schema.
        """
        file_path = validate_file_path(source)
        is_ndjson = self._is_ndjson(file_path)

        try:
            if is_ndjson:
                # NDJSON: Use lazy scan for efficiency
                scan_kwargs = self._build_ndjson_kwargs(config)
                lf = pl.scan_ndjson(str(file_path), **scan_kwargs)
                schema = schema_from_polars(lf)
            else:
                # Standard JSON: Eager read (no lazy option)
                read_kwargs = self._build_json_kwargs(config)
                df = pl.read_json(str(file_path), **read_kwargs)
                schema = schema_from_polars(df)

            # Get file info
            schema.file_size_bytes = file_path.stat().st_size

            return schema

        except Exception as e:
            raise DataSourceError(f"Failed to inspect JSON: {str(e)}") from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read preview rows from JSON.
        """
        file_path = validate_file_path(source)
        is_ndjson = self._is_ndjson(file_path)

        try:
            if is_ndjson:
                # NDJSON: Use lazy scan then collect
                scan_kwargs = self._build_ndjson_kwargs(config)
                lf = pl.scan_ndjson(str(file_path), **scan_kwargs)

                # Apply column filter if specified
                if columns:
                    lf = lf.select(columns)

                # Skip rows and limit
                if offset > 0:
                    lf = lf.slice(offset, max_rows)
                else:
                    lf = lf.head(max_rows)

                df = lf.collect()
            else:
                # Standard JSON: Eager read entire file (no streaming)
                read_kwargs = self._build_json_kwargs(config)
                df = pl.read_json(str(file_path), **read_kwargs)

                # Apply column filter if specified
                if columns:
                    df = df.select(columns)

                # Apply offset and limit
                if offset > 0:
                    df = df.slice(offset, max_rows)
                else:
                    df = df.head(max_rows)

            # Convert to response format
            return DataPreview(
                data_schema=schema_from_polars(df),
                data=dataframe_to_dict_list(df),
                total_rows=None,  # Would require full scan
                returned_rows=len(df),
            )

        except Exception as e:
            raise DataSourceError(f"Failed to preview JSON: {str(e)}") from e

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate JSON configuration.
        """
        errors = []

        # Validate infer_schema_length
        if "infer_schema_length" in config:
            isl = config["infer_schema_length"]
            if isl is not None and (not isinstance(isl, int) or isl <= 0):
                errors.append("infer_schema_length must be > 0 or null")

        # Validate n_rows (NDJSON only)
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")

        # Validate batch_size (NDJSON only)
        if "batch_size" in config:
            batch_size = config["batch_size"]
            if batch_size is not None and (not isinstance(batch_size, int) or batch_size <= 0):
                errors.append("batch_size must be > 0 or null")

        # Validate row_index_offset (NDJSON only)
        if "row_index_offset" in config:
            offset = config["row_index_offset"]
            if not isinstance(offset, int) or offset < 0:
                errors.append("row_index_offset must be >= 0")

        return errors

    def _build_json_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars read_json kwargs.

        Standard JSON has limited options compared to NDJSON.
        """
        kwargs: dict[str, Any] = {}

        # Key mapping: frontend -> polars
        key_mapping = {
            "infer_schema_length": "infer_schema_length",
        }

        # Transfer config values
        for frontend_key, polars_key in key_mapping.items():
            if frontend_key in config:
                value = config[frontend_key]
                if value is not None:
                    kwargs[polars_key] = value

        return kwargs

    def _build_ndjson_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars scan_ndjson / read_ndjson kwargs.

        NDJSON has more options including lazy scan support.
        """
        kwargs: dict[str, Any] = {}

        # Key mapping: frontend -> polars
        key_mapping = {
            "infer_schema_length": "infer_schema_length",
            "batch_size": "batch_size",
            "n_rows": "n_rows",
            "low_memory": "low_memory",
            "rechunk": "rechunk",
            "row_index_name": "row_index_name",
            "row_index_offset": "row_index_offset",
            "ignore_errors": "ignore_errors",
        }

        # Transfer config values
        for frontend_key, polars_key in key_mapping.items():
            if frontend_key in config:
                value = config[frontend_key]
                if value is not None:
                    kwargs[polars_key] = value

        return kwargs
