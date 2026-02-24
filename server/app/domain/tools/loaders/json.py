"""JSON/NDJSON file loader - special case due to extension-based format detection"""

from pathlib import Path
from typing import Any

import polars as pl

from app.domain.tools.loaders.base import FileLoader
from app.domain.tools.loaders.generic import GenericLoader
from app.domain.tools.loaders.specs import LOADER_SPECS
from app.utils.errors import ToolError
from app.utils.security import validate_file_path


class JsonLoader(FileLoader):
    """
    JSON file loader with automatic format detection.

    This is a special case because it detects the JSON format from the file
    extension and delegates to the appropriate spec:
    - .json: Standard JSON (array of objects, eager only)
    - .jsonl, .ndjson: Newline-delimited JSON (supports lazy scan)

    Uses GenericLoader internally with the appropriate spec.
    """

    def __init__(self) -> None:
        self._json_loader = GenericLoader(LOADER_SPECS["json"])
        self._ndjson_loader = GenericLoader(LOADER_SPECS["ndjson"])

    def _is_ndjson(self, source: str) -> bool:
        """Detect if file is NDJSON based on extension"""
        return Path(source).suffix.lower() in {".jsonl", ".ndjson"}

    def _get_loader(self, source: str) -> GenericLoader:
        """Get the appropriate loader based on file extension"""
        return self._ndjson_loader if self._is_ndjson(source) else self._json_loader

    async def load(self, config: dict[str, Any]) -> pl.LazyFrame:
        """Load JSON file, detecting format from extension"""
        source = config.get("source")
        if not source:
            raise ToolError("JSON config missing 'source' field")

        # Security: Validate file path against allowed paths (Hub mode enforcement)
        # Note: GenericLoader also validates, but we validate early for clear error messages
        validate_file_path(source)

        loader = self._get_loader(source)
        return await loader.load(config)

    def build_kwargs(self, config: dict[str, Any]) -> dict[str, Any]:
        """Build kwargs using the appropriate spec"""
        source = config.get("source", "")
        loader = self._get_loader(source)
        return loader.build_kwargs(config)

    def to_python_code(
        self,
        var_name: str,
        config: dict[str, Any],
    ) -> list[str]:
        """Generate Python code, detecting format from extension"""
        source = config.get("source", "")
        if not source:
            return [f"{var_name} = None  # ERROR: No source file specified"]

        loader = self._get_loader(source)
        return loader.to_python_code(var_name, config)
