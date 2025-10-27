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
        self, config: dict[str, Any], inputs: dict[int, pl.LazyFrame]
    ) -> dict[int, pl.LazyFrame]:
        """
        Load data from file source.

        Config should contain:
        - category: "file"
        - type: "csv" | "parquet" | etc.
        - csvMode: "scan" | "read" | "batched" (for CSV)
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

        # Get CSV mode if applicable
        csv_mode = config.get("csvMode", "scan") if source_type == "csv" else None

        # Load data based on type
        if source_type == "csv":
            lf = await self._load_csv(config, csv_mode)
        else:
            raise ToolError(f"Unsupported data source type: {source_type}")

        # Return on output socket 0
        return {0: lf}

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

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[int, DataSchema]
    ) -> dict[int, DataSchema]:
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
            raise ToolError(f"Input tool config missing 'source' field")

        # Inspect to get schema
        schema = await datasource.inspect(source_path, config)

        return {0: schema}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate input tool configuration"""
        errors = []

        if "type" not in config:
            errors.append("Missing required field: type")

        if "source" not in config:
            errors.append("Missing required field: source")

        # Validate source type
        source_type = config.get("type")
        if source_type and source_type not in ["csv"]:  # Will expand this list
            errors.append(f"Unsupported source type: {source_type}")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[int, str],
    ) -> tuple[list[str], dict[int, str]]:
        """Generate Python code for Input tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines = []
        source_type = config.get("type", "csv")
        source_path = config.get("source", "")
        
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"
        
        if not source_path:
            lines.append(f'{var_name} = None  # ERROR: No source file specified')
            return (lines, {0: var_name})
        
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
        else:
            lines.append(f'# TODO: {source_type} input not yet supported in code generation')
        
        return (lines, {0: var_name})
