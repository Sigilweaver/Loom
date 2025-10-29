"""Abstract base class for data sources"""

from abc import ABC, abstractmethod
from typing import Any

from app.api.models.common import DataSchema, DataPreview


class DataSource(ABC):
    """Abstract base class for all data source implementations"""

    @abstractmethod
    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """
        Inspect a data source and return schema information.
        
        Does not read all data - only what's needed to infer schema.
        
        Args:
            source: Path to the data source
            config: Source-specific configuration
            
        Returns:
            DataSchema with column information
            
        Raises:
            DataSourceError: If inspection fails
        """
        pass

    @abstractmethod
    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """
        Read a preview of the data.
        
        Args:
            source: Path to the data source
            config: Source-specific configuration
            max_rows: Maximum number of rows to return
            offset: Number of rows to skip
            columns: Specific columns to include (None = all)
            
        Returns:
            DataPreview with schema and sample data
            
        Raises:
            DataSourceError: If preview fails
        """
        pass

    @abstractmethod
    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """
        Validate configuration for this data source.
        
        Args:
            config: Configuration to validate
            
        Returns:
            List of error messages (empty if valid)
        """
        pass
