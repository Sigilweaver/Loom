"""CSV data source backed by the canonical workflow loader."""

from typing import Any

from app.domain.datasources.base import LoaderBackedDataSource


class CSVDataSource(LoaderBackedDataSource):
    """Inspect and preview CSV files through ``GenericLoader``."""

    source_type = "csv"

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        if "separator" in config:
            separator = config["separator"]
            if not isinstance(separator, str) or not separator:
                errors.append("separator must be a non-empty string")
        if "skip_rows" in config:
            skip_rows = config["skip_rows"]
            if not isinstance(skip_rows, int) or skip_rows < 0:
                errors.append("skip_rows must be >= 0")
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")
        return errors
