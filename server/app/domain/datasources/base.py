"""Abstract and shared implementations for data sources."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import polars as pl

from app.domain.models.common import DataPreview, DataSchema
from app.utils.errors import DataSourceError
from app.utils.type_mapping import dataframe_to_dict_list, schema_from_polars


class DataSource(ABC):
    """Interface used by data-source inspection and preview routes."""

    @abstractmethod
    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        """Inspect a source without intentionally collecting all rows."""

    @abstractmethod
    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        """Return a bounded sample from a source."""

    @abstractmethod
    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Return human-readable configuration errors."""


class LoaderBackedDataSource(DataSource):
    """Inspection and preview adapter over the workflow execution loader.

    Keeping loading in one path prevents preview, schema inspection, and real
    execution from interpreting source options differently.
    """

    source_type: str

    async def _load(self, source: str, config: dict[str, Any]) -> pl.LazyFrame:
        from app.domain.tools.loaders.factory import LoaderFactory

        loader = LoaderFactory.create(self.source_type)
        return await loader.load({**config, "source": source})

    async def inspect(self, source: str, config: dict[str, Any]) -> DataSchema:
        try:
            lf = await self._load(source, config)
            schema = schema_from_polars(lf)
            schema.file_size_bytes = Path(source).resolve().stat().st_size
            return schema
        except Exception as e:
            raise DataSourceError(
                f"Failed to inspect {self.source_type.upper()}: {e}"
            ) from e

    async def preview(
        self,
        source: str,
        config: dict[str, Any],
        max_rows: int = 100,
        offset: int = 0,
        columns: list[str] | None = None,
    ) -> DataPreview:
        try:
            lf = await self._load(source, config)
            if columns:
                lf = lf.select(columns)
            df = lf.slice(offset, max_rows).collect()
            return DataPreview(
                data_schema=schema_from_polars(df),
                data=dataframe_to_dict_list(df),
                total_rows=None,
                returned_rows=len(df),
            )
        except Exception as e:
            raise DataSourceError(
                f"Failed to preview {self.source_type.upper()}: {e}"
            ) from e
