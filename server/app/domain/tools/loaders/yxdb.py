"""YXDB file loader using SigilYX

Loads Alteryx .yxdb files via the SigilYX Rust library.
Not affiliated with Alteryx, Inc.
"""

from typing import Any

import polars as pl
import sigilyx

from app.domain.tools.loaders.base import FileLoader
from app.utils.errors import ToolError
from app.utils.security import validate_file_path


class YxdbLoader(FileLoader):
    """
    Loader for Alteryx YXDB files using SigilYX.

    YXDB is a row-based binary format with LZF compression.
    scan_yxdb() returns a LazyFrame directly, allowing deferred
    filter/select/join operations before collection.
    """

    async def load(self, config: dict[str, Any]) -> pl.LazyFrame:
        """Load a YXDB file and return a LazyFrame."""
        source = config.get("source")
        if not source:
            raise ToolError("YXDB config missing 'source' field")

        # Security: Validate file path against allowed paths
        validate_file_path(source)

        try:
            # scan_yxdb returns a LazyFrame directly
            lf: pl.LazyFrame = sigilyx.scan_yxdb(source)

            # Apply n_rows limit if specified
            n_rows = config.get("n_rows")
            if n_rows is not None:
                lf = lf.head(n_rows)

            # Apply column selection if specified
            columns = config.get("columns")
            if columns:
                lf = lf.select(columns)

            return lf

        except Exception as e:
            raise ToolError(f"Failed to read YXDB file: {e!s}") from e

    def build_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """YXDB has no additional kwargs — SigilYX handles everything."""
        return {}

    def to_python_code(
        self,
        var_name: str,
        config: dict[str, Any],
    ) -> list[str]:
        """Generate Python code for reading a YXDB file."""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines: list[str] = []
        source_path = config.get("source", "")

        if not source_path:
            lines.append(f"{var_name} = None  # ERROR: No source file specified")
            return lines

        escaped_path = PythonCodeGenerator.escape_path(source_path)

        lines.append("import sigilyx")
        lines.append("")

        n_rows = config.get("n_rows")
        columns = config.get("columns")

        # scan_yxdb returns a LazyFrame directly — no .lazy() needed
        lines.append(f'{var_name} = sigilyx.scan_yxdb("{escaped_path}")')

        if n_rows is not None:
            lines.append(f"{var_name} = {var_name}.head({n_rows})")

        if columns:
            escaped = [f'"{PythonCodeGenerator.escape_string(c)}"' for c in columns]
            lines.append(f"{var_name} = {var_name}.select([{', '.join(escaped)}])")

        return lines
