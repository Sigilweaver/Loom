"""Generic file loader that uses specs for configuration"""

from typing import Any

import polars as pl

from app.domain.tools.loaders.base import FileLoader
from app.domain.tools.loaders.specs import LoaderSpec
from app.utils.errors import ToolError
from app.utils.security import validate_file_path


class GenericLoader(FileLoader):
    """
    Generic file loader that handles any format defined in LOADER_SPECS.

    Instead of writing a class per format, this loader uses a LoaderSpec
    to determine how to load the file. All the format-specific details
    (function names, parameter mappings, etc.) come from the spec.
    """

    def __init__(self, spec: LoaderSpec):
        self.spec = spec

    async def load(self, config: dict[str, Any]) -> pl.LazyFrame:
        """Load file using the spec configuration"""
        source = config.get("source")
        if not source:
            raise ToolError(f"{self.spec.name} config missing 'source' field")

        # Security: Validate file path against allowed paths (Hub mode enforcement)
        validate_file_path(source)

        # Determine mode (scan vs read)
        mode = "read"  # Default for formats without scan support
        if self.spec.mode_key:
            mode = config.get(self.spec.mode_key, "scan") or "scan"

        # Build kwargs
        kwargs = self.build_kwargs(config)

        # Filter kwargs for read mode if needed
        if mode == "read" and self.spec.read_only_keys:
            kwargs = {k: v for k, v in kwargs.items() if k in self.spec.read_only_keys}

        # Load data
        if mode == "scan" and self.spec.supports_scan and self.spec.scan_func:
            func = getattr(pl, self.spec.scan_func)
            lf: pl.LazyFrame = func(source, **kwargs)
        else:
            func = getattr(pl, self.spec.read_func)
            df: pl.DataFrame = func(source, **kwargs)
            lf = df.lazy()

        # Apply post-load column selection if needed
        if self.spec.post_select_columns:
            columns = config.get("columns")
            if columns:
                lf = lf.select(columns)

        return lf

    def build_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Build Polars kwargs from config using the spec"""
        kwargs: dict[str, Any] = {}

        # Add static kwargs first
        kwargs.update(self.spec.static_kwargs)

        # Add custom kwargs (e.g., sheet selection)
        if self.spec.custom_kwargs_builder:
            kwargs.update(self.spec.custom_kwargs_builder(config))

        # Map config keys to Polars parameters
        for config_key, polars_key in self.spec.key_mapping.items():
            if config_key in config:
                value = config[config_key]
                if value is not None:
                    kwargs[polars_key] = value

        return kwargs

    def to_python_code(
        self,
        var_name: str,
        config: dict[str, Any],
    ) -> list[str]:
        """Generate Python code using the spec"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines: list[str] = []
        source_path = config.get("source", "")

        if not source_path:
            lines.append(f"{var_name} = None  # ERROR: No source file specified")
            return lines

        # Determine mode and function name
        mode = "read"
        if self.spec.mode_key:
            mode = config.get(self.spec.mode_key, "scan") or "scan"

        if mode == "scan" and self.spec.supports_scan:
            func_name = self.spec.scan_func
        else:
            func_name = self.spec.read_func

        # Build kwargs
        kwargs = self.build_kwargs(config)

        # Filter for read mode if needed
        if mode == "read" and self.spec.read_only_keys:
            kwargs = {k: v for k, v in kwargs.items() if k in self.spec.read_only_keys}

        # Format options
        options = self._format_kwargs_for_code(kwargs)

        # Build the function call
        escaped_path = PythonCodeGenerator.escape_path(source_path)
        if options:
            lines.append(f'{var_name} = pl.{func_name}("{escaped_path}", {", ".join(options)})')
        else:
            lines.append(f'{var_name} = pl.{func_name}("{escaped_path}")')

        # Add .lazy() for eager reads
        if not (mode == "scan" and self.spec.supports_scan):
            lines.append(f"{var_name} = {var_name}.lazy()")

        return lines
