"""Output tool implementation - Save data to files"""

from pathlib import Path
from typing import Any

import polars as pl

from app.api.models.common import DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError


@register_tool("Output")
class OutputTool(BaseTool):
    """
    Save data to various file formats (CSV, Parquet, etc.)

    Handles different output modes (sink vs write) for CSV with shared options.
    No output sockets - terminal node in workflow.
    """

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame]
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
        if len(inputs) != 1 or "input" not in inputs:
            raise ToolError("Output tool requires exactly one input on socket 'input'")

        lf = inputs["input"]

        # Get output type
        output_type = config.get("type")
        if not output_type:
            raise ToolError("Output tool config missing 'type' field")

        # Save data based on type
        if output_type == "csv":
            await self._save_csv(lf, config)
        elif output_type == "parquet":
            await self._save_parquet(lf, config)
        else:
            raise ToolError(f"Unsupported output type: {output_type}")

        # Output tools have no outputs
        return {}

    async def _save_csv(
        self, lf: pl.LazyFrame, config: dict[str, Any]
    ) -> None:
        """Save to CSV using sink_csv or write_csv based on mode"""
        destination = config.get("destination")
        if not destination:
            raise ToolError("CSV output config missing 'destination' field")

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

    async def _save_parquet(
        self, lf: pl.LazyFrame, config: dict[str, Any]
    ) -> None:
        """Save to Parquet using sink_parquet or write_parquet based on mode"""
        destination = config.get("destination")
        if not destination:
            raise ToolError("Parquet output config missing 'destination' field")

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

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema]
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
        if output_type and output_type not in ["csv", "parquet"]:
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
        input_vars: dict[str, str],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Output tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines = []
        output_type = config.get("type", "csv")
        destination = config.get("destination", "")

        if "input" not in input_vars:
            lines.append(f"# ERROR: Output {tool_id} has no input")
            return (lines, {})

        input_var = input_vars["input"]

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
                    options.append(f'{key}={str(value)}')
                elif isinstance(value, (int, float)) and value is not None:
                    options.append(f'{key}={value}')

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
                    options.append(f'{key}={str(value)}')
                elif isinstance(value, (int, float)) and value is not None:
                    options.append(f'{key}={value}')

            escaped_path = PythonCodeGenerator.escape_path(destination)
            opts_str = f", {', '.join(options)}" if options else ""

            if mode == "sink":
                lines.append(f'{input_var}.sink_parquet("{escaped_path}"{opts_str})')
            else:  # write mode
                lines.append(f'{input_var}.collect().write_parquet("{escaped_path}"{opts_str})')

        else:
            lines.append(
                f"# ERROR: Output type '{output_type}' not yet supported in code generation"
            )

        # Output tools have no outputs
        return (lines, {})
