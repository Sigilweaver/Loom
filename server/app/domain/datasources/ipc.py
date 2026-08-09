"""IPC/Arrow data source backed by the canonical workflow loader."""

from typing import Any

from app.domain.datasources.base import LoaderBackedDataSource


class IPCDataSource(LoaderBackedDataSource):
    """Inspect and preview IPC files through ``GenericLoader``."""

    source_type = "ipc"

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        if "n_rows" in config:
            n_rows = config["n_rows"]
            if n_rows is not None and (not isinstance(n_rows, int) or n_rows <= 0):
                errors.append("n_rows must be > 0 or null")
        if "row_index_offset" in config:
            offset = config["row_index_offset"]
            if offset is not None and (not isinstance(offset, int) or offset < 0):
                errors.append("row_index_offset must be >= 0")
        if "retries" in config:
            retries = config["retries"]
            if retries is not None and (not isinstance(retries, int) or retries < 0):
                errors.append("retries must be >= 0")
        return errors
