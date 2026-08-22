"""QVD file loader using OpenQVD

Loads Qlik QVD (.qvd) files via the OpenQVD Rust library.
Not affiliated with QlikTech.
"""

from typing import Any

import openqvd.polars
import polars as pl

from app.domain.tools.loaders.base import FileLoader
from app.utils.errors import ToolError
from app.utils.security import validate_file_path


class QvdLoader(FileLoader):
    """
    Loader for Qlik QVD files using OpenQVD.

    QVD is a columnar binary format. ``openqvd.polars.scan_qvd`` returns a
    LazyFrame, allowing deferred filter/select/join operations before
    collection. Column projection is pushed down to the Rust decoder.
    """

    async def load(self, config: dict[str, Any]) -> pl.LazyFrame:
        """Load a QVD file and return a LazyFrame."""
        source = config.get("source")
        if not source:
            raise ToolError("QVD config missing 'source' field")

        # Security: Validate file path against allowed paths
        validate_file_path(source)

        try:
            # scan_qvd returns a LazyFrame; pass columns for projection pushdown
            columns = config.get("columns")
            lf: pl.LazyFrame = openqvd.polars.scan_qvd(source, columns=columns)

            # Apply n_rows limit if specified
            n_rows = config.get("n_rows")
            if n_rows is not None:
                lf = lf.head(n_rows)

            return lf

        except Exception as e:
            raise ToolError(f"Failed to read QVD file: {e!s}") from e

    def build_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """QVD has no additional kwargs - OpenQVD handles everything."""
        return {}

    def to_python_code(
        self,
        var_name: str,
        config: dict[str, Any],
    ) -> list[str]:
        """Generate Python code for reading a QVD file."""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines: list[str] = []
        source_path = config.get("source", "")

        if not source_path:
            lines.append(f"{var_name} = None  # ERROR: No source file specified")
            return lines

        escaped_path = PythonCodeGenerator.escape_path(source_path)

        lines.append("import openqvd.polars")
        lines.append("")

        n_rows = config.get("n_rows")
        columns = config.get("columns")

        if columns:
            escaped = [f'"{PythonCodeGenerator.escape_string(c)}"' for c in columns]
            lines.append(
                f'{var_name} = openqvd.polars.scan_qvd("{escaped_path}", '
                f"columns=[{', '.join(escaped)}])"
            )
        else:
            lines.append(f'{var_name} = openqvd.polars.scan_qvd("{escaped_path}")')

        if n_rows is not None:
            lines.append(f"{var_name} = {var_name}.head({n_rows})")

        return lines
