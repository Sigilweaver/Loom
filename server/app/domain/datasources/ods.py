"""ODS (OpenDocument Spreadsheet) data source implementation"""

from typing import Any

import polars as pl

from app.domain.datasources.base import DataSource
from app.domain.models.common import DataPreview, DataSchema
from app.utils.errors import DataSourceError
from app.utils.security import validate_file_path
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars


class ODSDataSource(DataSource):
    """ODS file data source using Polars

    OpenDocument Spreadsheet (.ods) files from LibreOffice and OpenOffice.
    Similar to Excel, ODS only supports eager reading in Polars.
    """

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect ODS file and return schema.

        Reads a minimal number of rows to get schema information.
        """
        # Validate file path
        file_path = validate_file_path(source)

        # Build Polars read configuration
        read_kwargs = self._build_read_kwargs(config)

        try:
            # Default to full file scan for schema inference (eager read anyway)
            # Override with config value if provided, otherwise use None for full scan
            read_kwargs["infer_schema_length"] = config.get("infer_schema_length", None)
            df = pl.read_ods(str(file_path), **read_kwargs)

            # Get schema
            schema = schema_from_polars(df)

            # Get file info
            schema.file_size_bytes = file_path.stat().st_size

            return schema

        except Exception as e:
            raise DataSourceError(f"Failed to inspect ODS file: {str(e)}") from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read preview rows from ODS file.

        Note: ODS does not support offset or lazy reading.
        We read the entire sheet and slice in memory.
        """
        file_path = validate_file_path(source)
        read_kwargs = self._build_read_kwargs(config)

        try:
            # Read the ODS file
            df = pl.read_ods(str(file_path), **read_kwargs)

            # Apply offset and limit via slicing
            if offset > 0:
                df = df.slice(offset, max_rows)
            else:
                df = df.head(max_rows)

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
            raise DataSourceError(f"Failed to preview ODS file: {str(e)}") from e

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate ODS configuration.
        """
        errors = []

        # Validate sheet selection
        sheet_id = config.get("sheet_id")
        sheet_name = config.get("sheet_name")

        if sheet_id is not None and sheet_name is not None:
            errors.append("Cannot specify both sheet_id and sheet_name")

        if sheet_id is not None:
            if not isinstance(sheet_id, int) or sheet_id < 0:
                errors.append("sheet_id must be a non-negative integer (0 = all sheets)")

        # Validate infer_schema_length
        infer_len = config.get("infer_schema_length")
        if infer_len is not None:
            if not isinstance(infer_len, int) or infer_len <= 0:
                errors.append("infer_schema_length must be a positive integer")

        return errors

    def _build_read_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Build kwargs for pl.read_ods from config"""
        kwargs: dict[str, Any] = {}

        # Sheet selection (only one can be set)
        if "sheet_id" in config and config["sheet_id"] is not None:
            kwargs["sheet_id"] = config["sheet_id"]
        elif "sheet_name" in config and config["sheet_name"] is not None:
            kwargs["sheet_name"] = config["sheet_name"]
        # Default: sheet_id=1 (first sheet) if neither specified

        # Map config keys to Polars parameters
        key_mapping = {
            "has_header": "has_header",
            "columns": "columns",
            "infer_schema_length": "infer_schema_length",
            "drop_empty_rows": "drop_empty_rows",
            "drop_empty_cols": "drop_empty_cols",
            "raise_if_empty": "raise_if_empty",
        }

        for config_key, polars_key in key_mapping.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:
                    kwargs[polars_key] = value

        return kwargs
