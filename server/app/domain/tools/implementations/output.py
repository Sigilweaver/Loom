"""Output tool implementation - Save data to files"""

from pathlib import Path
from typing import Any

import polars as pl
from pydantic import BaseModel, ConfigDict, Field

from app.api.models.common import DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import CommonSockets
from app.utils.errors import ToolError
from app.utils.security import validate_file_path_for_write


class OutputToolConfig(BaseModel):
    """Typed config for Output.

    Output configs are polymorphic across writer formats (CSV, Parquet,
    Excel, IPC, JSON, etc.) so extra fields are allowed and only the
    dispatch fields are typed here.
    """

    model_config = ConfigDict(extra="allow")

    type: str | None = Field(default=None, description="Writer type, e.g. 'csv'.")
    destination: str | None = Field(default=None, description="Destination path.")


@register_tool("Output")
class OutputTool(BaseTool):
    """
    Save data to various file formats (CSV, Parquet, etc.)

    Handles different output modes (sink vs write) for CSV with shared options.
    No output sockets - terminal node in workflow.
    """

    @classmethod
    def config_model(cls) -> type[OutputToolConfig]:
        return OutputToolConfig

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """
        Save data to file.

        Config should contain:
        - type: "csv" | "parquet" | etc.
        - csvMode: "sink" | "write" (for CSV)
        - destination: file path
        - ... other format-specific config
        """
        # Output tools require exactly one input
        if len(inputs) != 1 or CommonSockets.INPUT not in inputs:
            raise ToolError("Output tool requires exactly one input on socket 'input'")

        input_data = inputs[CommonSockets.INPUT]
        # Extract single LazyFrame (Output tool doesn't support list inputs)
        if isinstance(input_data, list):
            raise ToolError("Output tool does not support multiple inputs")
        lf: pl.LazyFrame = input_data

        # Get output type
        output_type = config.get("type")
        if not output_type:
            raise ToolError("Output tool config missing 'type' field")

        # Save data based on type
        if output_type == "csv":
            await self._save_csv(lf, config)
        elif output_type == "parquet":
            await self._save_parquet(lf, config)
        elif output_type == "excel":
            await self._save_excel(lf, config)
        elif output_type == "json":
            await self._save_json(lf, config)
        elif output_type == "ipc":
            await self._save_ipc(lf, config)
        elif output_type == "avro":
            await self._save_avro(lf, config)
        elif output_type == "yxdb":
            await self._save_yxdb(lf, config)
        else:
            raise ToolError(f"Unsupported output type: {output_type}")

        # Output tools have no outputs
        return {}

    async def _save_csv(self, lf: pl.LazyFrame, config: dict[str, Any]) -> None:
        """Save to CSV using sink_csv or write_csv based on mode"""
        destination = config.get("destination")
        if not destination:
            raise ToolError("CSV output config missing 'destination' field")

        # Security: Validate destination path against allowed paths (Hub mode enforcement)
        validate_file_path_for_write(destination)

        # Ensure destination directory exists
        dest_path = Path(destination)
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        # Get mode (default to sink for streaming)
        mode = config.get("csvMode", "sink")

        # Build common CSV write kwargs
        csv_kwargs = self._build_csv_kwargs(config)

        try:
            if mode == "sink":
                # Streaming write - more memory efficient
                lf.sink_csv(destination, **csv_kwargs)
            elif mode == "write":
                # Collect then write - needed for some options
                df = lf.collect()
                df.write_csv(destination, **csv_kwargs)
            else:
                raise ToolError(f"Unknown CSV mode: {mode}")
        except Exception as e:
            raise ToolError(f"Failed to write CSV: {str(e)}") from e

    async def _save_parquet(self, lf: pl.LazyFrame, config: dict[str, Any]) -> None:
        """Save to Parquet using sink_parquet or write_parquet based on mode"""
        destination = config.get("destination")
        if not destination:
            raise ToolError("Parquet output config missing 'destination' field")

        # Security: Validate destination path against allowed paths (Hub mode enforcement)
        validate_file_path_for_write(destination)

        # Ensure destination directory exists
        dest_path = Path(destination)
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        # Get mode (default to sink for streaming)
        mode = config.get("parquetMode", "sink")

        # Build Parquet write kwargs
        parquet_kwargs = self._build_parquet_kwargs(config)

        try:
            if mode == "sink":
                # Streaming write - more memory efficient
                lf.sink_parquet(destination, **parquet_kwargs)
            elif mode == "write":
                # Collect then write
                df = lf.collect()
                df.write_parquet(destination, **parquet_kwargs)
            else:
                raise ToolError(f"Unknown Parquet mode: {mode}")
        except Exception as e:
            raise ToolError(f"Failed to write Parquet: {str(e)}") from e

    async def _save_ipc(self, lf: pl.LazyFrame, config: dict[str, Any]) -> None:
        """Save to IPC/Arrow using sink_ipc or write_ipc based on mode

        IPC (Inter-Process Communication) is Apache Arrow's native binary format.
        Supports .arrow, .ipc, and .feather file extensions.
        """
        destination = config.get("destination")
        if not destination:
            raise ToolError("IPC output config missing 'destination' field")

        # Security: Validate destination path against allowed paths (Hub mode enforcement)
        validate_file_path_for_write(destination)

        # Ensure destination directory exists
        dest_path = Path(destination)
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        # Get mode (default to sink for streaming)
        mode = config.get("ipcMode", "sink")

        # Build IPC write kwargs
        ipc_kwargs = self._build_ipc_kwargs(config)

        try:
            if mode == "sink":
                # Streaming write - more memory efficient
                lf.sink_ipc(destination, **ipc_kwargs)
            elif mode == "write":
                # Collect then write
                # write_ipc has fewer parameters than sink_ipc
                write_kwargs = {
                    k: v for k, v in ipc_kwargs.items() if k in {"compression", "compat_level"}
                }
                df = lf.collect()
                df.write_ipc(destination, **write_kwargs)
            else:
                raise ToolError(f"Unknown IPC mode: {mode}")
        except Exception as e:
            raise ToolError(f"Failed to write IPC: {str(e)}") from e

    async def _save_avro(self, lf: pl.LazyFrame, config: dict[str, Any]) -> None:
        """Save to Avro format (always eager - no streaming support)

        Apache Avro is a row-based binary format commonly used in
        big data ecosystems (Hadoop, Kafka, Spark).

        Note: Polars only supports eager write for Avro (no sink).
        """
        destination = config.get("destination")
        if not destination:
            raise ToolError("Avro output config missing 'destination' field")

        # Security: Validate destination path against allowed paths (Hub mode enforcement)
        validate_file_path_for_write(destination)

        # Ensure destination directory exists
        dest_path = Path(destination)
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        # Build Avro write kwargs
        avro_kwargs = self._build_avro_kwargs(config)

        try:
            # Avro only supports eager write - must collect first
            df = lf.collect()
            df.write_avro(destination, **avro_kwargs)
        except Exception as e:
            raise ToolError(f"Failed to write Avro: {str(e)}") from e

    def _build_csv_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars CSV write kwargs.

        Maps only common parameters between sink_csv and write_csv.
        """
        kwargs = {}

        # Common parameters between sink_csv and write_csv
        common_params = {
            "include_bom": "include_bom",
            "include_header": "include_header",
            "separator": "separator",
            "line_terminator": "line_terminator",
            "quote_char": "quote_char",
            "batch_size": "batch_size",
            "datetime_format": "datetime_format",
            "date_format": "date_format",
            "time_format": "time_format",
            "float_scientific": "float_scientific",
            "float_precision": "float_precision",
            "null_value": "null_value",
            "quote_style": "quote_style",
        }

        # Transfer config values
        for config_key, polars_key in common_params.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:  # Skip None values to use Polars defaults
                    kwargs[polars_key] = value

        return kwargs

    def _build_parquet_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars Parquet write kwargs.

        Maps parameters for sink_parquet and write_parquet.
        """
        kwargs = {}

        # Common parameters between sink_parquet and write_parquet
        common_params = {
            "compression": "compression",
            "compression_level": "compression_level",
            "statistics": "statistics",
            "row_group_size": "row_group_size",
            "data_page_size": "data_page_size",
        }

        # Transfer config values
        for config_key, polars_key in common_params.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:  # Skip None values to use Polars defaults
                    kwargs[polars_key] = value

        return kwargs

    def _build_ipc_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars IPC write kwargs.

        Maps parameters for sink_ipc and write_ipc.
        IPC supports only uncompressed, lz4, and zstd compression.
        """
        kwargs: dict[str, Any] = {}

        # Common parameters between sink_ipc and write_ipc
        common_params = {
            "compression": "compression",
            "compat_level": "compat_level",
        }

        # Transfer config values
        for config_key, polars_key in common_params.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:  # Skip None values to use Polars defaults
                    kwargs[polars_key] = value

        return kwargs

    def _build_avro_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars Avro write kwargs.

        write_avro parameters:
        - compression: 'uncompressed' | 'snappy' | 'deflate'
        - name: str (schema name, defaults to empty string)
        """
        kwargs: dict[str, Any] = {}

        # Avro write parameters
        if "compression" in config:
            value = config["compression"]
            if value is not None:
                kwargs["compression"] = value

        if "name" in config:
            value = config["name"]
            if value is not None and value != "":
                kwargs["name"] = value

        return kwargs

    async def _save_yxdb(self, lf: pl.LazyFrame, config: dict[str, Any]) -> None:
        """Save to YXDB format using SigilYX.

        YXDB is always an eager write - the format requires knowing
        record count upfront and uses row-based LZF-compressed blocks.
        """
        import sigilyx

        destination = config.get("destination")
        if not destination:
            raise ToolError("YXDB output config missing 'destination' field")

        # Security: Validate destination path against allowed paths (Hub mode enforcement)
        validate_file_path_for_write(destination)

        # Ensure destination directory exists
        dest_path = Path(destination)
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            # sink_yxdb collects the LazyFrame and writes to YXDB in one call
            sigilyx.sink_yxdb(str(dest_path), lf)
        except Exception as e:
            raise ToolError(f"Failed to write YXDB: {e!s}") from e

    async def _save_excel(self, lf: pl.LazyFrame, config: dict[str, Any]) -> None:
        """Save to Excel using write_excel (always eager - no streaming support)"""
        destination = config.get("destination")
        if not destination:
            raise ToolError("Excel output config missing 'destination' field")

        # Security: Validate destination path against allowed paths (Hub mode enforcement)
        validate_file_path_for_write(destination)

        # Ensure destination directory exists
        dest_path = Path(destination)
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        # Build Excel write kwargs
        excel_kwargs = self._build_excel_kwargs(config)

        try:
            # Excel only supports eager write - must collect first
            df = lf.collect()
            df.write_excel(destination, **excel_kwargs)
        except Exception as e:
            raise ToolError(f"Failed to write Excel: {str(e)}") from e

    def _build_excel_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """
        Convert frontend config to Polars Excel write kwargs.

        Maps parameters for write_excel.
        """
        kwargs = {}

        # Worksheet name
        if "worksheet" in config and config["worksheet"]:
            kwargs["worksheet"] = config["worksheet"]

        # Table style - can be a string name or None to disable
        if "table_style" in config:
            value = config["table_style"]
            # Empty string or "none" means no table styling
            if value == "" or value == "none" or value is None:
                kwargs["table_style"] = None
            else:
                kwargs["table_style"] = value

        # Table name for Excel references
        if "table_name" in config and config["table_name"]:
            kwargs["table_name"] = config["table_name"]

        # Boolean options
        bool_params = {
            "include_header": "include_header",
            "autofilter": "autofilter",
            "autofit": "autofit",
            "hide_gridlines": "hide_gridlines",
        }

        for config_key, polars_key in bool_params.items():
            if config_key in config and config[config_key] is not None:
                kwargs[polars_key] = config[config_key]

        # Numeric options
        if "float_precision" in config and config["float_precision"] is not None:
            kwargs["float_precision"] = config["float_precision"]

        if "sheet_zoom" in config and config["sheet_zoom"] is not None:
            kwargs["sheet_zoom"] = config["sheet_zoom"]

        # Freeze panes - tuple of (row, col) for split position
        if "freeze_panes" in config and config["freeze_panes"]:
            freeze = config["freeze_panes"]
            # Accept string notation like "A2" or tuple like [1, 0]
            if isinstance(freeze, str):
                kwargs["freeze_panes"] = freeze
            elif isinstance(freeze, (list, tuple)) and len(freeze) >= 2:
                kwargs["freeze_panes"] = tuple(freeze[:2])

        return kwargs

    async def _save_json(self, lf: pl.LazyFrame, config: dict[str, Any]) -> None:
        """Save to JSON or NDJSON based on file extension and mode

        Supports two formats:
        - Standard JSON (.json): Always eager, writes array of objects
        - NDJSON (.jsonl, .ndjson): Supports sink (streaming) and write (eager)
        """
        destination = config.get("destination")
        if not destination:
            raise ToolError("JSON output config missing 'destination' field")

        # Security: Validate destination path against allowed paths (Hub mode enforcement)
        validate_file_path_for_write(destination)

        # Ensure destination directory exists
        dest_path = Path(destination)
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        # Detect format from extension
        is_ndjson = dest_path.suffix.lower() in {".jsonl", ".ndjson"}

        # Build JSON write kwargs
        json_kwargs = self._build_json_kwargs(config, is_ndjson)

        try:
            if is_ndjson:
                # NDJSON supports sink (streaming) and write (eager)
                mode = config.get("jsonMode", "sink")
                if mode == "sink":
                    # Streaming write - more memory efficient
                    lf.sink_ndjson(destination)
                elif mode == "write":
                    # Collect then write
                    df = lf.collect()
                    df.write_ndjson(destination)
                else:
                    raise ToolError(f"Unknown JSON mode: {mode}")
            else:
                # Standard JSON: only eager write supported
                df = lf.collect()
                df.write_json(destination, **json_kwargs)
        except Exception as e:
            raise ToolError(f"Failed to write JSON: {str(e)}") from e

    def _build_json_kwargs(self, config: dict[str, Any], is_ndjson: bool) -> dict[str, Any]:
        """
        Convert frontend config to Polars JSON write kwargs.

        Note: write_json and write_ndjson have different parameter sets.
        """
        kwargs: dict[str, Any] = {}

        if is_ndjson:
            # NDJSON write options (write_ndjson has no parameters currently)
            pass
        else:
            # Standard JSON write options
            # write_json currently has minimal options in Polars
            # row_oriented defaults to True (array of objects)
            if "row_oriented" in config:
                value = config["row_oriented"]
                if value is not None:
                    kwargs["row_oriented"] = value

        return kwargs

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Output tools have no output sockets.
        """
        return {}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate output tool configuration"""
        errors = []

        if "type" not in config:
            errors.append("Missing required field: type")

        if "destination" not in config:
            errors.append("Missing required field: destination")

        # Validate output type
        output_type = config.get("type")
        if output_type and output_type not in [
            "avro",
            "csv",
            "excel",
            "ipc",
            "json",
            "parquet",
            "yxdb",
        ]:
            errors.append(f"Unsupported output type: {output_type}")

        # Validate CSV mode
        if output_type == "csv":
            mode = config.get("csvMode", "sink")
            if mode not in ["sink", "write"]:
                errors.append(f"Invalid CSV mode: {mode}. Must be 'sink' or 'write'")

        # Validate Parquet mode
        if output_type == "parquet":
            mode = config.get("parquetMode", "sink")
            if mode not in ["sink", "write"]:
                errors.append(f"Invalid Parquet mode: {mode}. Must be 'sink' or 'write'")

        # Validate IPC mode
        if output_type == "ipc":
            mode = config.get("ipcMode", "sink")
            if mode not in ["sink", "write"]:
                errors.append(f"Invalid IPC mode: {mode}. Must be 'sink' or 'write'")

        # Validate JSON mode
        if output_type == "json":
            destination = config.get("destination", "")
            is_ndjson = (
                Path(destination).suffix.lower() in {".jsonl", ".ndjson"} if destination else False
            )
            mode = config.get("jsonMode", "sink")

            if is_ndjson:
                # NDJSON supports both sink and write
                if mode not in ["sink", "write"]:
                    errors.append(f"Invalid JSON mode: {mode}. Must be 'sink' or 'write'")
            else:
                # Standard JSON only supports write mode
                if mode == "sink":
                    errors.append(
                        "Sink mode is not supported for standard JSON (.json). "
                        "Use .jsonl or .ndjson for streaming output, or use 'write' mode."
                    )

        # Validate Excel-specific options
        if output_type == "excel":
            # Validate sheet_zoom if provided
            sheet_zoom = config.get("sheet_zoom")
            if sheet_zoom is not None:
                if not isinstance(sheet_zoom, int) or sheet_zoom < 10 or sheet_zoom > 400:
                    errors.append(
                        f"Invalid sheet_zoom: {sheet_zoom}. Must be integer between 10 and 400"
                    )

            # Validate float_precision if provided
            float_precision = config.get("float_precision")
            if float_precision is not None:
                is_invalid = (
                    not isinstance(float_precision, int)
                    or float_precision < 0
                    or float_precision > 15
                )
                if is_invalid:
                    errors.append(
                        f"Invalid float_precision: {float_precision}. "
                        "Must be integer between 0 and 15"
                    )

        # Validate destination path
        destination = config.get("destination")
        if destination:
            try:
                dest_path = Path(destination)
                # Check if parent directory is writable (if it exists)
                if dest_path.parent.exists() and not dest_path.parent.is_dir():
                    errors.append(f"Parent path is not a directory: {dest_path.parent}")
            except Exception as e:
                errors.append(f"Invalid destination path: {str(e)}")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Output tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines = []
        output_type = config.get("type", "csv")
        destination = config.get("destination", "")

        if CommonSockets.INPUT not in input_vars:
            lines.append(f"# ERROR: Output {tool_id} has no input")
            return (lines, {})

        input_var = input_vars[CommonSockets.INPUT]

        if not destination:
            lines.append(f"# ERROR: Output {tool_id} has no destination specified")
            return (lines, {})

        if output_type == "csv":
            mode = config.get("csvMode", "sink")

            # Build CSV options
            options = []
            csv_kwargs = self._build_csv_kwargs(config)

            for key, value in csv_kwargs.items():
                if isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f"{key}={str(value)}")
                elif isinstance(value, (int, float)) and value is not None:
                    options.append(f"{key}={value}")

            escaped_path = PythonCodeGenerator.escape_path(destination)
            opts_str = f", {', '.join(options)}" if options else ""

            if mode == "sink":
                lines.append(f'{input_var}.sink_csv("{escaped_path}"{opts_str})')
            else:  # write mode
                lines.append(f'{input_var}.collect().write_csv("{escaped_path}"{opts_str})')

        elif output_type == "parquet":
            mode = config.get("parquetMode", "sink")

            # Build Parquet options
            options = []
            parquet_kwargs = self._build_parquet_kwargs(config)

            for key, value in parquet_kwargs.items():
                if isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f"{key}={str(value)}")
                elif isinstance(value, (int, float)) and value is not None:
                    options.append(f"{key}={value}")

            escaped_path = PythonCodeGenerator.escape_path(destination)
            opts_str = f", {', '.join(options)}" if options else ""

            if mode == "sink":
                lines.append(f'{input_var}.sink_parquet("{escaped_path}"{opts_str})')
            else:  # write mode
                lines.append(f'{input_var}.collect().write_parquet("{escaped_path}"{opts_str})')

        elif output_type == "excel":
            # Excel always requires collect (no streaming support)
            options = []
            excel_kwargs = self._build_excel_kwargs(config)

            for key, value in excel_kwargs.items():
                if isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f"{key}={str(value)}")
                elif isinstance(value, (int, float)) and value is not None:
                    options.append(f"{key}={value}")
                elif isinstance(value, tuple):
                    options.append(f"{key}={value}")
                elif value is None:
                    options.append(f"{key}=None")

            escaped_path = PythonCodeGenerator.escape_path(destination)
            opts_str = f", {', '.join(options)}" if options else ""

            lines.append(f'{input_var}.collect().write_excel("{escaped_path}"{opts_str})')

        elif output_type == "json":
            # Detect NDJSON from extension
            is_ndjson = Path(destination).suffix.lower() in {".jsonl", ".ndjson"}
            escaped_path = PythonCodeGenerator.escape_path(destination)

            if is_ndjson:
                # NDJSON supports sink (streaming) and write (eager)
                mode = config.get("jsonMode", "sink")
                if mode == "sink":
                    lines.append(f'{input_var}.sink_ndjson("{escaped_path}")')
                else:  # write mode
                    lines.append(f'{input_var}.collect().write_ndjson("{escaped_path}")')
            else:
                # Standard JSON: only eager write supported
                json_kwargs = self._build_json_kwargs(config, is_ndjson=False)
                options = []
                for key, value in json_kwargs.items():
                    if isinstance(value, bool):
                        options.append(f"{key}={str(value)}")
                    elif isinstance(value, str):
                        options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                opts_str = f", {', '.join(options)}" if options else ""
                lines.append(f'{input_var}.collect().write_json("{escaped_path}"{opts_str})')

        elif output_type == "ipc":
            mode = config.get("ipcMode", "sink")

            # Build IPC options
            options = []
            ipc_kwargs = self._build_ipc_kwargs(config)

            for key, value in ipc_kwargs.items():
                if isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f"{key}={str(value)}")
                elif isinstance(value, (int, float)) and value is not None:
                    options.append(f"{key}={value}")

            escaped_path = PythonCodeGenerator.escape_path(destination)
            opts_str = f", {', '.join(options)}" if options else ""

            if mode == "sink":
                lines.append(f'{input_var}.sink_ipc("{escaped_path}"{opts_str})')
            else:  # write mode
                lines.append(f'{input_var}.collect().write_ipc("{escaped_path}"{opts_str})')

        elif output_type == "avro":
            # Avro only supports eager write (no sink)
            options = []
            avro_kwargs = self._build_avro_kwargs(config)

            for key, value in avro_kwargs.items():
                if isinstance(value, str):
                    options.append(f'{key}="{PythonCodeGenerator.escape_string(value)}"')
                elif isinstance(value, bool):
                    options.append(f"{key}={str(value)}")
                elif isinstance(value, (int, float)) and value is not None:
                    options.append(f"{key}={value}")

            escaped_path = PythonCodeGenerator.escape_path(destination)
            opts_str = f", {', '.join(options)}" if options else ""

            lines.append(f'{input_var}.collect().write_avro("{escaped_path}"{opts_str})')

        elif output_type == "yxdb":
            escaped_path = PythonCodeGenerator.escape_path(destination)
            lines.append("import sigilyx")
            lines.append(f'sigilyx.sink_yxdb("{escaped_path}", {input_var})')

        else:
            lines.append(
                f"# ERROR: Output type '{output_type}' not yet supported in code generation"
            )

        # Output tools have no outputs
        return (lines, {})
