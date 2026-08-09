"""JSON and NDJSON data source backed by the canonical workflow loader."""

from typing import Any

from app.domain.datasources.base import LoaderBackedDataSource


class JSONDataSource(LoaderBackedDataSource):
    """Inspect and preview JSON through the extension-aware ``JsonLoader``."""

    source_type = "json"

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        if "infer_schema_length" in config:
            length = config["infer_schema_length"]
            if length is not None and (not isinstance(length, int) or length <= 0):
                errors.append("infer_schema_length must be > 0 or null")
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")
        if "batch_size" in config:
            batch_size = config["batch_size"]
            if batch_size is not None and (
                not isinstance(batch_size, int) or batch_size <= 0
            ):
                errors.append("batch_size must be > 0 or null")
        if "row_index_offset" in config:
            offset = config["row_index_offset"]
            if not isinstance(offset, int) or offset < 0:
                errors.append("row_index_offset must be >= 0")
        return errors
