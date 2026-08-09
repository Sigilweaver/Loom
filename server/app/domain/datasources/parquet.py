"""Parquet data source backed by the canonical workflow loader."""

from typing import Any

from app.domain.datasources.base import LoaderBackedDataSource


class ParquetDataSource(LoaderBackedDataSource):
    """Inspect and preview Parquet files through ``GenericLoader``."""

    source_type = "parquet"

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")
        if "row_index_name" in config:
            name = config["row_index_name"]
            if name is not None and not isinstance(name, str):
                errors.append("row_index_name must be a string or null")
        if "row_index_offset" in config:
            offset = config["row_index_offset"]
            if not isinstance(offset, int) or offset < 0:
                errors.append("row_index_offset must be >= 0")
        return errors
