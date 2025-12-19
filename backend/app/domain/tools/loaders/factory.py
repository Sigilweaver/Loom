"""Loader factory for creating appropriate file loaders"""

from app.domain.tools.loaders.base import FileLoader
from app.domain.tools.loaders.database import DatabaseLoader
from app.domain.tools.loaders.generic import GenericLoader
from app.domain.tools.loaders.json import JsonLoader
from app.domain.tools.loaders.specs import LOADER_SPECS
from app.utils.errors import ToolError


class LoaderFactory:
    """
    Factory for creating file loader instances based on file type.

    Most formats use GenericLoader with their spec from LOADER_SPECS.
    JSON is a special case that handles extension-based format detection.
    Database loaders handle SQL query execution.
    """

    # Special case loaders that need custom behavior
    _special_loaders: dict[str, type[FileLoader]] = {
        "json": JsonLoader,
    }

    # Database loaders by type
    _database_loaders: dict[str, str] = {
        "postgresql": "postgresql",
        "mysql": "mysql",
        "sqlite": "sqlite",
        "mssql": "mssql",
    }

    @classmethod
    def create(cls, source_type: str) -> FileLoader:
        """
        Create a file loader instance by type.

        Args:
            source_type: Type identifier (e.g., "csv", "parquet", "postgresql")

        Returns:
            FileLoader instance

        Raises:
            ToolError: If source type is unknown
        """
        source_type = source_type.lower()

        # Check for database loaders
        if source_type in cls._database_loaders:
            return DatabaseLoader(database_type=source_type)

        # Check for special case loaders
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
        # Combine spec types, special loaders, and database loaders
        types = (
            set(LOADER_SPECS.keys())
            | set(cls._special_loaders.keys())
            | set(cls._database_loaders.keys())
        )
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
        if source_type == "ndjson":  # Internal type
            return False
        return (
            source_type in LOADER_SPECS
            or source_type in cls._special_loaders
            or source_type in cls._database_loaders
        )

    @classmethod
    def is_database_type(cls, source_type: str) -> bool:
        """
        Check if a source type is a database connection.
        
        Args:
            source_type: Type identifier to check
            
        Returns:
            True if database type, False otherwise
        """
        return source_type.lower() in cls._database_loaders
