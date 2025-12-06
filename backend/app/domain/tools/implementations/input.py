"""Input tool implementation - Load data from files"""

from typing import Any

import polars as pl

from app.api.models.common import DataSchema
from app.domain.datasources.factory import DataSourceFactory
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError


@register_tool("Input")
class InputTool(BaseTool):
    """
    Load data from various file sources (CSV, Parquet, etc.)

    Uses the data source factory to handle different file types.
    Always returns LazyFrame for efficient lazy evaluation.
    """

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """
        Load data from file source.

        Config should contain:
        - category: "file"
        - type: "csv" | "parquet" | etc.
        - csvMode: "scan" | "read" | "batched" (for CSV)
        - parquetMode: "scan" | "read" (for Parquet)
        - source: file path
        - ... other source-specific config
        """
        # Input tools have no inputs
        if inputs:
            raise ToolError("Input tool should not have inputs")

        # Get source type
        source_type = config.get("type")
        if not source_type:
            raise ToolError("Input tool config missing 'type' field")

        # Load data based on type
        if source_type == "csv":
            csv_mode: str = config.get("csvMode", "scan") or "scan"
            lf = await self._load_csv(config, csv_mode)
        elif source_type == "parquet":
            parquet_mode: str = config.get("parquetMode", "scan") or "scan"
            lf = await self._load_parquet(config, parquet_mode)
        elif source_type == "excel":
            lf = await self._load_excel(config)
        elif source_type == "json":
            json_mode: str = config.get("jsonMode", "scan") or "scan"
            lf = await self._load_json(config, json_mode)
        elif source_type == "ipc":
            ipc_mode: str = config.get("ipcMode", "scan") or "scan"
            lf = await self._load_ipc(config, ipc_mode)
        elif source_type == "avro":
            lf = await self._load_avro(config)
        elif source_type == "ods":
            lf = await self._load_ods(config)
        else:
            raise ToolError(f"Unsupported data source type: {source_type}")

        # Return on output socket
        return {"output": lf}

    async def _load_csv(
        self, config: dict[str, Any], mode: str = "scan"
    ) -> pl.LazyFrame:
        """Load CSV file using appropriate mode"""
        source = config.get("source")
        if not source:
            raise ToolError("CSV config missing 'source' field")

        # Build Polars scan kwargs from config
        scan_kwargs = self._build_csv_kwargs(config)

        # Load based on mode
        if mode == "scan":
            # Lazy loading (most efficient)
            lf = pl.scan_csv(source, **scan_kwargs)
        elif mode == "read":
            # Eager loading, convert to lazy
            df = pl.read_csv(source, **scan_kwargs)
            lf = df.lazy()
        elif mode == "batched":
            # For now, treat batched as scan (can optimize later)
            lf = pl.scan_csv(source, **scan_kwargs)
        else:
            raise ToolError(f"Unknown CSV mode: {mode}")

        return lf

    async def _load_parquet(
        self, config: dict[str, Any], mode: str = "scan"
    ) -> pl.LazyFrame:
        """Load Parquet file using appropriate mode"""
        source = config.get("source")
        if not source:
            raise ToolError("Parquet config missing 'source' field")

        # Build Polars scan kwargs from config
        scan_kwargs = self._build_parquet_kwargs(config)

        # Load based on mode
        if mode == "scan":
            # Lazy loading (most efficient)
            lf = pl.scan_parquet(source, **scan_kwargs)
        elif mode == "read":
            # Eager loading, convert to lazy
            df = pl.read_parquet(source, **scan_kwargs)
            lf = df.lazy()
        else:
            raise ToolError(f"Unknown Parquet mode: {mode}")

        # Handle column selection (not supported as scan parameter)
        if "columns" in config and config["columns"]:
            lf = lf.select(config["columns"])

        return lf

    async def _load_json(
        self, config: dict[str, Any], mode: str = "scan"
    ) -> pl.LazyFrame:
        """Load JSON file using appropriate mode

        Supports two JSON formats:
        - Standard JSON (.json): Array of objects, always eager (read_json)
        - NDJSON (.jsonl, .ndjson): Newline-delimited, supports lazy scan (scan_ndjson)

        The mode parameter only affects NDJSON files.
        Standard JSON files always use read mode (no lazy support).
        """
        from pathlib import Path

        source = config.get("source")
        if not source:
            raise ToolError("JSON config missing 'source' field")

        # Detect JSON format from extension
        path = Path(source)
        is_ndjson = path.suffix.lower() in {".jsonl", ".ndjson"}

        if is_ndjson:
            # NDJSON: supports scan (lazy) and read (eager) modes
            ndjson_kwargs = self._build_ndjson_kwargs(config)

            if mode == "scan":
                # Lazy loading (most efficient for large files)
                lf = pl.scan_ndjson(source, **ndjson_kwargs)
            elif mode == "read":
                # Eager loading, convert to lazy
                df = pl.read_ndjson(source, **ndjson_kwargs)
                lf = df.lazy()
            else:
                raise ToolError(f"Unknown JSON mode: {mode}")
        else:
            # Standard JSON: only eager read supported
            json_kwargs = self._build_json_kwargs(config)
            df = pl.read_json(source, **json_kwargs)
            lf = df.lazy()

        # Handle column selection after reading
        if "columns" in config and config["columns"]:
            lf = lf.select(config["columns"])

        return lf

    async def _load_excel(
        self, config: dict[str, Any]
    ) -> pl.LazyFrame:
        """Load Excel file (always eager, converted to lazy)

        Excel files only support eager reading via read_excel.
        Supports .xlsx, .xls, and .xlsb files.
        """
        source = config.get("source")
        if not source:
            raise ToolError("Excel config missing 'source' field")

        # Build Polars read kwargs from config
        read_kwargs = self._build_excel_kwargs(config)

        # Excel only supports eager reading, convert to lazy
        df: pl.DataFrame = pl.read_excel(source, **read_kwargs)
        lf = df.lazy()

        # Handle column selection after reading
        if "columns" in config and config["columns"]:
            lf = lf.select(config["columns"])

        return lf

    async def _load_ipc(
        self, config: dict[str, Any], mode: str = "scan"
    ) -> pl.LazyFrame:
        """Load IPC/Arrow file using appropriate mode

        Supports .arrow, .ipc, and .feather file extensions.
        IPC is Apache Arrow's native binary format for zero-copy data sharing.
        """
        source = config.get("source")
        if not source:
            raise ToolError("IPC config missing 'source' field")

        # Build Polars scan kwargs from config
        scan_kwargs = self._build_ipc_kwargs(config)

        # Load based on mode
        if mode == "scan":
            # Lazy loading (most efficient)
            lf = pl.scan_ipc(source, **scan_kwargs)
        elif mode == "read":
            # Eager loading, convert to lazy
            # read_ipc has a subset of scan_ipc parameters
            read_kwargs = {
                k: v for k, v in scan_kwargs.items()
                if k in {"n_rows", "memory_map", "row_index_name", "row_index_offset", "rechunk"}
            }
            df = pl.read_ipc(source, **read_kwargs)
            lf = df.lazy()
        else:
            raise ToolError(f"Unknown IPC mode: {mode}")

        # Handle column selection (not supported as scan parameter)
        if "columns" in config and config["columns"]:
            lf = lf.select(config["columns"])

        return lf

    async def _load_avro(
        self, config: dict[str, Any]
    ) -> pl.LazyFrame:
        """Load Avro file (always eager, converted to lazy)

        Avro files only support eager reading via read_avro.
        Apache Avro is a row-based binary format commonly used
        in big data ecosystems (Hadoop, Kafka, Spark).
        """
        source = config.get("source")
        if not source:
            raise ToolError("Avro config missing 'source' field")

        # Build Polars read kwargs from config
        read_kwargs = self._build_avro_kwargs(config)

        # Avro only supports eager reading, convert to lazy
        df = pl.read_avro(source, **read_kwargs)
        lf = df.lazy()

        return lf

    async def _load_ods(
        self, config: dict[str, Any]
    ) -> pl.LazyFrame:
        """Load ODS file (always eager, converted to lazy)

        OpenDocument Spreadsheet files only support eager reading via read_ods.
        Supports .ods files from LibreOffice and OpenOffice.
        """
        source = config.get("source")
        if not source:
            raise ToolError("ODS config missing 'source' field")

        # Build Polars read kwargs from config
        read_kwargs = self._build_ods_kwargs(config)

        # ODS only supports eager reading, convert to lazy
        df: pl.DataFrame = pl.read_ods(source, **read_kwargs)
        lf = df.lazy()

        return lf

    def _build_csv_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Convert frontend config to Polars scan_csv kwargs"""
        kwargs = {}

        # Map config keys to Polars parameters
        key_mapping = {
            "separator": "separator",
            "has_header": "has_header",
            "skip_rows": "skip_rows",
            "skip_rows_after_header": "skip_rows_after_header",
            "n_rows": "n_rows",
            "encoding": "encoding",
            "quote_char": "quote_char",
            "eol_char": "eol_char",
            "columns": "columns",
            "new_columns": "new_columns",
            "infer_schema_length": "infer_schema_length",
            "null_values": "null_values",
            "ignore_errors": "ignore_errors",
            "try_parse_dates": "try_parse_dates",
            "comment_prefix": "comment_prefix",
            "row_index_name": "row_index_name",
            "row_index_offset": "row_index_offset",
            "rechunk": "rechunk",
            "low_memory": "low_memory",
            "truncate_ragged_lines": "truncate_ragged_lines",
            "decimal_comma": "decimal_comma",
            "missing_utf8_is_empty_string": "missing_utf8_is_empty_string",
        }

        for config_key, polars_key in key_mapping.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:  # Skip None values to use Polars defaults
                    kwargs[polars_key] = value

        return kwargs

    def _build_parquet_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Convert frontend config to Polars scan_parquet kwargs"""
        kwargs = {}

        # Map config keys to Polars parameters
        # Note: 'columns' is handled separately via .select() after scan
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

        for config_key, polars_key in key_mapping.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:  # Skip None values to use Polars defaults
                    kwargs[polars_key] = value

        return kwargs

    def _build_excel_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Convert frontend config to Polars read_excel kwargs"""
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

        # Engine is always calamine (fastest, default in Polars)
        kwargs["engine"] = "calamine"

        return kwargs

    def _build_json_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Convert frontend config to Polars read_json kwargs

        Standard JSON has limited options compared to NDJSON.
        """
        kwargs: dict[str, Any] = {}

        # Key mapping: frontend -> polars
        key_mapping = {
            "infer_schema_length": "infer_schema_length",
        }

        for config_key, polars_key in key_mapping.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:
                    kwargs[polars_key] = value

        return kwargs

    def _build_ndjson_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Convert frontend config to Polars scan_ndjson / read_ndjson kwargs

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

        for config_key, polars_key in key_mapping.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:
                    kwargs[polars_key] = value

        return kwargs

    def _build_ipc_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Convert frontend config to Polars scan_ipc kwargs

        IPC (Arrow) has similar options to Parquet with memory mapping support.
        """
        kwargs: dict[str, Any] = {}

        # Key mapping: frontend -> polars
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

    def _build_avro_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Convert frontend config to Polars read_avro kwargs

        Avro read has limited options:
        - columns: list[int] | list[str] | None
        - n_rows: int | None
        """
        kwargs: dict[str, Any] = {}

        # Columns can be list of names (str) or indices (int)
        if "columns" in config:
            value = config["columns"]
            if value is not None and value:  # Non-empty list
                kwargs["columns"] = value

        # Limit rows
        if "n_rows" in config:
            value = config["n_rows"]
            if value is not None:
                kwargs["n_rows"] = value

        return kwargs

    def _build_ods_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Convert frontend config to Polars read_ods kwargs

        Similar to Excel, with sheet selection and data options.
        """
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

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Get schema by inspecting the data source.

        Uses the datasource inspect endpoint to get schema without loading data.
        """
        source_type = config.get("type")
        if not source_type:
            raise ToolError("Input tool config missing 'type' field")

        # Use datasource factory to inspect
        datasource = DataSourceFactory.create(source_type)
        source_path = config.get("source")

        if not source_path:
            raise ToolError("Input tool config missing 'source' field")

        # Inspect to get schema
        schema = await datasource.inspect(source_path, config)

        return {"output": schema}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate input tool configuration"""
        errors = []

        if "type" not in config:
            errors.append("Missing required field: type")

        if "source" not in config:
            errors.append("Missing required field: source")

        # Validate source type
        source_type = config.get("type")
        if source_type and source_type not in ["avro", "csv", "excel", "ipc", "json", "ods", "parquet"]:
            errors.append(f"Unsupported source type: {source_type}")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Input tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines = []
        source_type = config.get("type", "csv")
        source_path = config.get("source", "")

        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        if not source_path:
            lines.append(f'{var_name} = None  # ERROR: No source file specified')
            return (lines, {"output": var_name})

        if source_type == "csv":
            mode = config.get("csvMode", "scan")
            func_name = "read_csv" if mode == "read" else "scan_csv"

            # Build CSV options
            options = []
            csv_kwargs = self._build_csv_kwargs(config)

            for key, value in csv_kwargs.items():
                if isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f'{key}={str(value)}')
                elif isinstance(value, (int, float)):
                    options.append(f'{key}={value}')
                elif isinstance(value, list) and value:
                    # For columns, new_columns, null_values
                    if all(isinstance(v, str) for v in value):
                        escaped = [f'"{PythonCodeGenerator.escape_string(v)}"' for v in value]
                        options.append(f'{key}=[{", ".join(escaped)}]')

            escaped_path = PythonCodeGenerator.escape_path(source_path)
            if options:
                lines.append(f'{var_name} = pl.{func_name}("{escaped_path}", {", ".join(options)})')
            else:
                lines.append(f'{var_name} = pl.{func_name}("{escaped_path}")')

            # If read mode, convert to lazy
            if mode == "read":
                lines.append(f'{var_name} = {var_name}.lazy()')

        elif source_type == "parquet":
            mode = config.get("parquetMode", "scan")
            func_name = "read_parquet" if mode == "read" else "scan_parquet"

            # Build Parquet options
            options = []
            parquet_kwargs = self._build_parquet_kwargs(config)

            for key, value in parquet_kwargs.items():
                if isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f'{key}={str(value)}')
                elif isinstance(value, (int, float)):
                    options.append(f'{key}={value}')
                elif isinstance(value, list) and value:
                    # For columns
                    if all(isinstance(v, str) for v in value):
                        escaped = [f'"{PythonCodeGenerator.escape_string(v)}"' for v in value]
                        options.append(f'{key}=[{", ".join(escaped)}]')
                elif isinstance(value, dict):
                    # For hive_schema
                    options.append(f'{key}={value}')

            escaped_path = PythonCodeGenerator.escape_path(source_path)
            if options:
                lines.append(f'{var_name} = pl.{func_name}("{escaped_path}", {", ".join(options)})')
            else:
                lines.append(f'{var_name} = pl.{func_name}("{escaped_path}")')

            # If read mode, convert to lazy
            if mode == "read":
                lines.append(f'{var_name} = {var_name}.lazy()')

        elif source_type == "excel":
            # Excel only supports eager reading
            options = []
            excel_kwargs = self._build_excel_kwargs(config)

            for key, value in excel_kwargs.items():
                if key == "engine":
                    options.append(f'{key}="{value}"')
                elif isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f'{key}={str(value)}')
                elif isinstance(value, (int, float)):
                    options.append(f'{key}={value}')

            escaped_path = PythonCodeGenerator.escape_path(source_path)
            if options:
                lines.append(f'{var_name} = pl.read_excel("{escaped_path}", {", ".join(options)})')
            else:
                lines.append(f'{var_name} = pl.read_excel("{escaped_path}")')

            # Always convert to lazy for consistency
            lines.append(f'{var_name} = {var_name}.lazy()')

        elif source_type == "json":
            from pathlib import Path
            path = Path(source_path)
            is_ndjson = path.suffix.lower() in {".jsonl", ".ndjson"}

            if is_ndjson:
                # NDJSON: supports scan and read modes
                mode = config.get("jsonMode", "scan")
                func_name = "read_ndjson" if mode == "read" else "scan_ndjson"

                options = []
                ndjson_kwargs = self._build_ndjson_kwargs(config)

                for key, value in ndjson_kwargs.items():
                    if isinstance(value, str):
                        options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                    elif isinstance(value, bool):
                        options.append(f'{key}={str(value)}')
                    elif isinstance(value, (int, float)):
                        options.append(f'{key}={value}')

                escaped_path = PythonCodeGenerator.escape_path(source_path)
                if options:
                    lines.append(f'{var_name} = pl.{func_name}("{escaped_path}", {", ".join(options)})')
                else:
                    lines.append(f'{var_name} = pl.{func_name}("{escaped_path}")')

                # If read mode, convert to lazy
                if mode == "read":
                    lines.append(f'{var_name} = {var_name}.lazy()')
            else:
                # Standard JSON: only eager read supported
                options = []
                json_kwargs = self._build_json_kwargs(config)

                for key, value in json_kwargs.items():
                    if isinstance(value, (int, float)):
                        options.append(f'{key}={value}')

                escaped_path = PythonCodeGenerator.escape_path(source_path)
                if options:
                    lines.append(f'{var_name} = pl.read_json("{escaped_path}", {", ".join(options)})')
                else:
                    lines.append(f'{var_name} = pl.read_json("{escaped_path}")')

                # Always convert to lazy for consistency
                lines.append(f'{var_name} = {var_name}.lazy()')

        elif source_type == "ipc":
            mode = config.get("ipcMode", "scan")
            func_name = "read_ipc" if mode == "read" else "scan_ipc"

            # Build IPC options
            options = []
            ipc_kwargs = self._build_ipc_kwargs(config)

            for key, value in ipc_kwargs.items():
                if isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f'{key}={str(value)}')
                elif isinstance(value, (int, float)):
                    options.append(f'{key}={value}')
                elif isinstance(value, dict):
                    # For hive_schema
                    options.append(f'{key}={value}')

            escaped_path = PythonCodeGenerator.escape_path(source_path)
            if options:
                lines.append(f'{var_name} = pl.{func_name}("{escaped_path}", {", ".join(options)})')
            else:
                lines.append(f'{var_name} = pl.{func_name}("{escaped_path}")')

            # If read mode, convert to lazy
            if mode == "read":
                lines.append(f'{var_name} = {var_name}.lazy()')

        elif source_type == "avro":
            # Avro only supports eager reading
            options = []
            avro_kwargs = self._build_avro_kwargs(config)

            for key, value in avro_kwargs.items():
                if isinstance(value, (int, float)):
                    options.append(f'{key}={value}')
                elif isinstance(value, list) and value:
                    # For columns (list of strings or ints)
                    if all(isinstance(v, str) for v in value):
                        escaped = [f'"{PythonCodeGenerator.escape_string(v)}"' for v in value]
                        options.append(f'{key}=[{", ".join(escaped)}]')
                    else:
                        options.append(f'{key}={value}')

            escaped_path = PythonCodeGenerator.escape_path(source_path)
            if options:
                lines.append(f'{var_name} = pl.read_avro("{escaped_path}", {", ".join(options)})')
            else:
                lines.append(f'{var_name} = pl.read_avro("{escaped_path}")')

            # Always convert to lazy for consistency
            lines.append(f'{var_name} = {var_name}.lazy()')

        elif source_type == "ods":
            # ODS only supports eager reading
            options = []
            ods_kwargs = self._build_ods_kwargs(config)

            for key, value in ods_kwargs.items():
                if isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f'{key}={str(value)}')
                elif isinstance(value, (int, float)):
                    options.append(f'{key}={value}')
                elif isinstance(value, list) and value:
                    # For columns
                    if all(isinstance(v, str) for v in value):
                        escaped = [f'"{PythonCodeGenerator.escape_string(v)}"' for v in value]
                        options.append(f'{key}=[{", ".join(escaped)}]')
                    else:
                        options.append(f'{key}={value}')

            escaped_path = PythonCodeGenerator.escape_path(source_path)
            if options:
                lines.append(f'{var_name} = pl.read_ods("{escaped_path}", {", ".join(options)})')
            else:
                lines.append(f'{var_name} = pl.read_ods("{escaped_path}")')

            # Always convert to lazy for consistency
            lines.append(f'{var_name} = {var_name}.lazy()')

        else:
            lines.append(f'# TODO: {source_type} input not yet supported in code generation')

        return (lines, {"output": var_name})
