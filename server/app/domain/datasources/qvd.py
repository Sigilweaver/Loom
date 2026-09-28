"""QVD data source implementation

Uses OpenQVD - a clean-room Rust reader for the Qlik QVD format - exposed
to Python via the `openqvd` package. Not affiliated with QlikTech.
"""

from typing import Any

import openqvd
import polars as pl

from app.domain.datasources.base import DataSource
from app.domain.models.common import DataPreview, DataSchema
from app.utils.errors import DataSourceError
from app.utils.security import validate_file_path
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars


class QvdDataSource(DataSource):
    """QVD file data source using OpenQVD.

    Reads .qvd (QlikView Data) files via OpenQVD's high-performance Rust
    core, which decodes the file into a PyArrow Table that is converted to
    a Polars DataFrame. Column dtypes are inferred from the QVD number
    format hints and the actual symbol-table values.
    """

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect a QVD file and return its schema.

        QVD dtype inference depends on the decoded symbol tables, so the
        file is read to derive accurate column types. The row count comes
        from the same decoded table.
        """
        file_path = validate_file_path(source)

        try:
            table = openqvd.read(str(file_path))
            # openqvd.read returns an Arrow Table, so from_arrow yields a
            # DataFrame (not a Series); narrow the DataFrame | Series union.
            df = pl.from_arrow(table)
            assert isinstance(df, pl.DataFrame)

            schema = schema_from_polars(df.lazy())

            return DataSchema(
                columns=schema.columns,
                row_count=df.height,
                file_size_bytes=file_path.stat().st_size,
            )

        except Exception as e:
            raise DataSourceError(f"Failed to inspect QVD file: {e!s}") from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read preview rows from a QVD file.
        """
        file_path = validate_file_path(source)

        try:
            # OpenQVD applies column projection at the Rust level, decoding
            # only the requested symbol tables.
            table = (
                openqvd.read(str(file_path), columns=columns)
                if columns
                else openqvd.read(str(file_path))
            )
            # from_arrow on an Arrow Table yields a DataFrame; narrow the union.
            df = pl.from_arrow(table)
            assert isinstance(df, pl.DataFrame)

            total_rows = df.height

            # Apply offset and limit
            if offset > 0:
                df = df.slice(offset, max_rows)
            else:
                df = df.head(max_rows)

            return DataPreview(
                data_schema=schema_from_polars(df.lazy()),
                data=dataframe_to_dict_list(df),
                total_rows=total_rows,
                returned_rows=len(df),
            )

        except Exception as e:
            raise DataSourceError(f"Failed to preview QVD file: {e!s}") from e

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate QVD configuration.

        QVD has minimal configuration - just a file path.
        """
        errors: list[str] = []

        # Validate n_rows if provided
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")

        return errors
