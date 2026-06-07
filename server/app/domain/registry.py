"""Central registry of file formats and database sources.

This is the single source of truth for which formats Loom can read. Both the
inspect/preview path (``DataSourceFactory``) and the execution path
(``LoaderFactory``) derive their registries from the descriptors here, so a
format can no longer be registered in one path but not the other.

Note on imports: this module imports *data source* classes only. The loaders
package ``__init__`` imports ``LoaderFactory``, so importing loader classes here
would create an import cycle. ``LoaderFactory`` therefore binds the concrete
special-loader classes itself, keyed by the format ``type``; the set of formats
that need a special loader is declared here via ``special_loader``.
"""

from dataclasses import dataclass
from typing import Type

from app.domain.datasources.avro import AvroDataSource
from app.domain.datasources.base import DataSource
from app.domain.datasources.csv import CSVDataSource
from app.domain.datasources.database import (
    MsSQLDataSource,
    MySQLDataSource,
    PostgreSQLDataSource,
    SQLiteDataSource,
)
from app.domain.datasources.excel import ExcelDataSource
from app.domain.datasources.ipc import IPCDataSource
from app.domain.datasources.json import JSONDataSource
from app.domain.datasources.ods import ODSDataSource
from app.domain.datasources.parquet import ParquetDataSource
from app.domain.datasources.qvd import QvdDataSource
from app.domain.datasources.yxdb import YxdbDataSource


@dataclass(frozen=True)
class FormatDescriptor:
    """Describes a single readable file format.

    Attributes:
        type: Stable type identifier shared with Studio (e.g. "qvd").
        extensions: File extensions that resolve to this type.
        datasource: DataSource implementation for inspect/preview.
        special_loader: True if execution needs a custom loader (bound in
            LoaderFactory by ``type``). False means GenericLoader resolves the
            format from ``LOADER_SPECS[type]``.
    """

    type: str
    extensions: tuple[str, ...]
    datasource: Type[DataSource]
    special_loader: bool = False


# File formats. Order here defines the order of list_supported_types() and
# list_supported_extensions().
FILE_FORMATS: tuple[FormatDescriptor, ...] = (
    FormatDescriptor("avro", (".avro",), AvroDataSource),
    FormatDescriptor("csv", (".csv", ".tsv", ".tab", ".txt"), CSVDataSource),
    FormatDescriptor("excel", (".xlsx", ".xls", ".xlsb"), ExcelDataSource),
    FormatDescriptor("ipc", (".arrow", ".ipc", ".feather"), IPCDataSource),
    FormatDescriptor(
        "json", (".json", ".jsonl", ".ndjson"), JSONDataSource, special_loader=True
    ),
    FormatDescriptor("ods", (".ods",), ODSDataSource),
    FormatDescriptor("parquet", (".parquet",), ParquetDataSource),
    FormatDescriptor("qvd", (".qvd",), QvdDataSource, special_loader=True),
    FormatDescriptor("yxdb", (".yxdb",), YxdbDataSource, special_loader=True),
)


# Database sources are not file-based and use DatabaseLoader for execution.
DATABASE_SOURCES: dict[str, Type[DataSource]] = {
    "postgresql": PostgreSQLDataSource,
    "mysql": MySQLDataSource,
    "sqlite": SQLiteDataSource,
    "mssql": MsSQLDataSource,
}

DATABASE_TYPES: tuple[str, ...] = tuple(DATABASE_SOURCES.keys())


def file_source_classes() -> dict[str, Type[DataSource]]:
    """type -> DataSource class for every file format."""
    return {fmt.type: fmt.datasource for fmt in FILE_FORMATS}


def extension_mapping() -> dict[str, str]:
    """extension -> type for every registered file extension."""
    return {ext: fmt.type for fmt in FILE_FORMATS for ext in fmt.extensions}


def special_loader_types() -> tuple[str, ...]:
    """Types whose execution requires a custom loader (bound in LoaderFactory)."""
    return tuple(fmt.type for fmt in FILE_FORMATS if fmt.special_loader)
