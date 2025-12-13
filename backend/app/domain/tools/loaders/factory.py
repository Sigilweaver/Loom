"""Loader factory for creating appropriate file loaders"""

from app.domain.tools.loaders.base import FileLoader
from app.domain.tools.loaders.generic import GenericLoader
from app.domain.tools.loaders.json import JsonLoader
from app.domain.tools.loaders.specs import LOADER_SPECS
from app.utils.errors import ToolError


class LoaderFactory:
    """
    Factory for creating file loader instances based on file type.

    Most formats use GenericLoader with their spec from LOADER_SPECS.
    JSON is a special case that handles extension-based format detection.
    """

    # Special case loaders that need custom behavior
    _special_loaders: dict[str, type[FileLoader]] = {
        "json": JsonLoader,
    }

    @classmethod
    def create(cls, source_type: str) -> FileLoader:
        """
        Create a file loader instance by type.

        Args:
            source_type: Type identifier (e.g., "csv", "parquet")

        Returns:
            FileLoader instance

        Raises:
            ToolError: If source type is unknown
        """
        source_type = source_type.lower()

        # Check for special case loaders first
        if source_type in cls._special_loaders:
            return cls._special_loaders[source_type]()

        # Use GenericLoader with spec for standard formats
        if source_type in LOADER_SPECS:
            return GenericLoader(LOADER_SPECS[source_type])

        available = ", ".join(sorted(cls.list_supported_types()))
        raise ToolError(
            f"Unsupported data source type: {source_type}. Available: {available}"
        )

    @classmethod
    def list_supported_types(cls) -> list[str]:
        """
        List all supported source types.

        Returns:
            Sorted list of supported type identifiers
        """
        # Combine spec types and special loaders, excluding internal types
        types = set(LOADER_SPECS.keys()) | set(cls._special_loaders.keys())
        # Remove internal types not meant for direct use
        types.discard("ndjson")  # Used internally by JsonLoader
        return sorted(types)

    @classmethod
    def is_supported(cls, source_type: str) -> bool:
        """
        Check if a source type is supported.

        Args:
            source_type: Type identifier to check

        Returns:
            True if supported, False otherwise
        """
        source_type = source_type.lower()
        return (
            source_type in LOADER_SPECS
            or source_type in cls._special_loaders
        ) and source_type != "ndjson"  # Internal type
