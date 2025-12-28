"""Excel data source implementation"""

from typing import Any

import polars as pl

from app.api.models.common import DataPreview, DataSchema
from app.domain.datasources.base import DataSource
from app.utils.errors import DataSourceError
from app.utils.security import validate_file_path
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars


class ExcelDataSource(DataSource):
    """Excel file data source using Polars

    Supports .xlsx, .xls, and .xlsb files via the calamine engine (fastexcel).
    Note: Excel files only support eager reading (no lazy scan).
    """

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect Excel file and return schema.

        Reads a small sample to infer schema without loading entire file.
        """
        # Validate file path
        file_path = validate_file_path(source)

        # Build Polars read configuration
        read_kwargs = self._build_read_kwargs(config)
        # Default to full file scan for schema inference (eager read anyway)
        read_kwargs["infer_schema_length"] = config.get("infer_schema_length", None)

        try:
            # Read Excel (eager - no lazy support for Excel)
            df = pl.read_excel(str(file_path), **read_kwargs)

            # Convert to lazy for schema extraction
            lf = df.lazy()

            # Get schema
            schema = schema_from_polars(lf)

            # Get file info
            schema.file_size_bytes = file_path.stat().st_size

            return schema

        except Exception as e:
            raise DataSourceError(f"Failed to inspect Excel: {str(e)}") from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read preview rows from Excel.
        """
        file_path = validate_file_path(source)
        read_kwargs = self._build_read_kwargs(config)

        try:
            # Read the Excel file
            df = pl.read_excel(str(file_path), **read_kwargs)

            # Apply column filter if specified
            if columns:
                df = df.select(columns)

            # Skip rows and limit
            if offset > 0:
                df = df.slice(offset, max_rows)
            else:
                df = df.head(max_rows)

            # Convert to response format
            return DataPreview(
                data_schema=schema_from_polars(df),
                data=dataframe_to_dict_list(df),
                total_rows=None,  # Would require reading entire file
                returned_rows=len(df),
            )

        except Exception as e:
            raise DataSourceError(f"Failed to preview Excel: {str(e)}") from e

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate Excel configuration.
        """
        errors = []

        # Validate sheet_id
        if "sheet_id" in config:
            sheet_id = config["sheet_id"]
            if sheet_id is not None:
                if not isinstance(sheet_id, int) or sheet_id < 0:
                    errors.append("sheet_id must be >= 0 or null")

        # Validate sheet_name
        if "sheet_name" in config:
            sheet_name = config["sheet_name"]
            if sheet_name is not None and not isinstance(sheet_name, str):
                errors.append("sheet_name must be a string or null")

        # Validate infer_schema_length
        if "infer_schema_length" in config:
            infer_schema_length = config["infer_schema_length"]
            if infer_schema_length is not None and (
                not isinstance(infer_schema_length, int) or infer_schema_length <= 0
            ):
                errors.append("infer_schema_length must be > 0 or null")

        # Ensure sheet_id and sheet_name are not both specified
        if config.get("sheet_id") is not None and config.get("sheet_name") is not None:
            errors.append("Cannot specify both sheet_id and sheet_name")

        return errors

    def _build_read_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars read_excel kwargs.

        Maps frontend configuration keys to Polars parameter names.
        """
        kwargs: dict[str, Any] = {}

        # Sheet selection (only one can be set)
        # sheet_id: 1-indexed sheet number (0 = all sheets)
        # sheet_name: sheet name string
        if "sheet_id" in config and config["sheet_id"] is not None:
            kwargs["sheet_id"] = config["sheet_id"]
        elif "sheet_name" in config and config["sheet_name"] is not None:
            kwargs["sheet_name"] = config["sheet_name"]
        # Default: sheet_id=1 (first sheet) if neither specified

        # Key mapping: frontend -> polars
        key_mapping = {
            "has_header": "has_header",
            "infer_schema_length": "infer_schema_length",
            "drop_empty_rows": "drop_empty_rows",
            "drop_empty_cols": "drop_empty_cols",
            "raise_if_empty": "raise_if_empty",
        }

        # Transfer config values
        for frontend_key, polars_key in key_mapping.items():
            if frontend_key in config:
                value = config[frontend_key]
                if value is not None:
                    kwargs[polars_key] = value

        # Engine is always calamine (fastest, default in Polars)
        kwargs["engine"] = "calamine"

        return kwargs
