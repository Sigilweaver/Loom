"""Data source factory for creating appropriate handlers"""

from pathlib import Path
from typing import Type

from app.domain.datasources.base import DataSource
from app.domain.registry import (
    DATABASE_SOURCES,
    DATABASE_TYPES,
    extension_mapping,
    file_source_classes,
)
from app.utils.errors import DataSourceError


class DataSourceFactory:
    """Factory for creating data source instances.

    Registries are derived from app.domain.registry so that adding a format in
    one place updates both the inspect/preview and execution paths.
    """

    # Registry of data source implementations (file formats + databases)
    _sources: dict[str, Type[DataSource]] = {
        **file_source_classes(),
        **DATABASE_SOURCES,
    }

    # File extension to source type mapping
    _extension_mapping: dict[str, str] = extension_mapping()

    # Database source types (not file-based)
    _database_types: set[str] = set(DATABASE_TYPES)

    @classmethod
    def create(cls, source_type: str) -> DataSource:
        """
        Create a data source instance by type.

        Args:
            source_type: Type identifier (e.g., "csv", "parquet", "postgresql")

        Returns:
            DataSource instance

        Raises:
            DataSourceError: If source type is unknown
        """
        source_class = cls._sources.get(source_type.lower())
        if not source_class:
            available = ", ".join(cls._sources.keys())
            raise DataSourceError(
                f"Unknown data source type: {source_type}. Available: {available}"
            )
        return source_class()

    @classmethod
    def detect_source_type(cls, file_path: str) -> str:
        """
        Detect data source type from file extension.

        Args:
            file_path: Path to the file

        Returns:
            Source type identifier

        Raises:
            DataSourceError: If extension is not supported
        """
        path = Path(file_path)
        extension = path.suffix.lower()

        source_type = cls._extension_mapping.get(extension)
        if not source_type:
            supported = ", ".join(cls._extension_mapping.keys())
            raise DataSourceError(
                f"Unsupported file extension: {extension}. Supported: {supported}"
            )

        return source_type

    @classmethod
    def list_supported_types(cls) -> list[str]:
        """List all supported data source types"""
        return list(cls._sources.keys())

    @classmethod
    def list_supported_extensions(cls) -> list[str]:
        """List all supported file extensions"""
        return list(cls._extension_mapping.keys())

    @classmethod
    def is_database_type(cls, source_type: str) -> bool:
        """Check if a source type is a database connection (not file-based)"""
        return source_type.lower() in cls._database_types
