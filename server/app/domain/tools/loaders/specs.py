"""Loader specifications - declarative configuration for file format loaders"""

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class LoaderSpec:
    """
    Declarative specification for a file format loader.

    This allows defining loaders through configuration rather than
    writing repetitive class implementations.
    """

    # Format name (for error messages)
    name: str

    # Polars function names
    scan_func: str | None = None  # e.g., "scan_csv" - None if no lazy support
    read_func: str = ""  # e.g., "read_csv"

    # Config key for mode selection (e.g., "csvMode", "parquetMode")
    mode_key: str | None = None

    # Mapping from frontend config keys to Polars parameter names
    # Keys map 1:1 unless special handling needed
    key_mapping: dict[str, str] = field(default_factory=dict)

    # For read mode, some formats only support a subset of scan params
    # If set, only these keys are passed to read_func
    read_only_keys: set[str] | None = None

    # Whether to apply .select(columns) after loading
    # (for formats where columns isn't a direct parameter)
    post_select_columns: bool = False

    # Static kwargs always added (e.g., engine="calamine" for Excel)
    static_kwargs: dict[str, Any] = field(default_factory=dict)

    # Custom kwargs builder for special cases (sheet selection, etc.)
    # Signature: (config: dict) -> dict of additional kwargs
    custom_kwargs_builder: Callable[[dict[str, Any]], dict[str, Any]] | None = None

    @property
    def supports_scan(self) -> bool:
        """Whether this format supports lazy scanning"""
        return self.scan_func is not None


def _build_sheet_kwargs(config: dict[str, Any]) -> dict[str, Any]:
    """Build sheet selection kwargs for Excel/ODS formats"""
    kwargs: dict[str, Any] = {}
    if "sheet_id" in config and config["sheet_id"] is not None:
        kwargs["sheet_id"] = config["sheet_id"]
    elif "sheet_name" in config and config["sheet_name"] is not None:
        kwargs["sheet_name"] = config["sheet_name"]
    return kwargs


# =============================================================================
# LOADER SPECIFICATIONS
# =============================================================================
# Add new formats by adding entries here - no new class needed!

LOADER_SPECS: dict[str, LoaderSpec] = {
    "csv": LoaderSpec(
        name="CSV",
        scan_func="scan_csv",
        read_func="read_csv",
        mode_key="csvMode",
        key_mapping={
            "separator": "separator",
            "has_header": "has_header",
            "skip_rows": "skip_rows",
            "skip_rows_after_header": "skip_rows_after_header",
            "n_rows": "n_rows",
            "encoding": "encoding",
            "quote_char": "quote_char",
            "eol_char": "eol_char",
            "columns": "columns",
            "new_columns": "new_columns",
            "infer_schema_length": "infer_schema_length",
            "null_values": "null_values",
            "ignore_errors": "ignore_errors",
            "try_parse_dates": "try_parse_dates",
            "comment_prefix": "comment_prefix",
            "row_index_name": "row_index_name",
            "row_index_offset": "row_index_offset",
            "rechunk": "rechunk",
            "low_memory": "low_memory",
            "cache": "cache",
            "truncate_ragged_lines": "truncate_ragged_lines",
            "decimal_comma": "decimal_comma",
            "missing_utf8_is_empty_string": "missing_utf8_is_empty_string",
        },
    ),
    "parquet": LoaderSpec(
        name="Parquet",
        scan_func="scan_parquet",
        read_func="read_parquet",
        mode_key="parquetMode",
        post_select_columns=True,
        key_mapping={
            "n_rows": "n_rows",
            "row_index_name": "row_index_name",
            "row_index_offset": "row_index_offset",
            "parallel": "parallel",
            "use_statistics": "use_statistics",
            "hive_partitioning": "hive_partitioning",
            "hive_schema": "hive_schema",
            "try_parse_hive_dates": "try_parse_hive_dates",
            "rechunk": "rechunk",
            "low_memory": "low_memory",
            "cache": "cache",
            "retries": "retries",
        },
    ),
    "ipc": LoaderSpec(
        name="IPC",
        scan_func="scan_ipc",
        read_func="read_ipc",
        mode_key="ipcMode",
        post_select_columns=True,
        key_mapping={
            "n_rows": "n_rows",
            "cache": "cache",
            "rechunk": "rechunk",
            "row_index_name": "row_index_name",
            "row_index_offset": "row_index_offset",
            "memory_map": "memory_map",
            "retries": "retries",
            "hive_partitioning": "hive_partitioning",
            "hive_schema": "hive_schema",
            "try_parse_hive_dates": "try_parse_hive_dates",
        },
        # read_ipc only supports these parameters
        read_only_keys={
            "n_rows",
            "memory_map",
            "row_index_name",
            "row_index_offset",
            "rechunk",
        },
    ),
    "excel": LoaderSpec(
        name="Excel",
        read_func="read_excel",
        mode_key=None,  # Excel is always eager
        post_select_columns=True,
        key_mapping={
            "has_header": "has_header",
            "infer_schema_length": "infer_schema_length",
            "drop_empty_rows": "drop_empty_rows",
            "drop_empty_cols": "drop_empty_cols",
            "raise_if_empty": "raise_if_empty",
        },
        static_kwargs={"engine": "calamine"},
        custom_kwargs_builder=_build_sheet_kwargs,
    ),
    "ods": LoaderSpec(
        name="ODS",
        read_func="read_ods",
        mode_key=None,  # ODS is always eager
        key_mapping={
            "has_header": "has_header",
            "columns": "columns",
            "infer_schema_length": "infer_schema_length",
            "drop_empty_rows": "drop_empty_rows",
            "drop_empty_cols": "drop_empty_cols",
            "raise_if_empty": "raise_if_empty",
        },
        custom_kwargs_builder=_build_sheet_kwargs,
    ),
    "avro": LoaderSpec(
        name="Avro",
        read_func="read_avro",
        mode_key=None,  # Avro is always eager
        key_mapping={
            "columns": "columns",
            "n_rows": "n_rows",
        },
    ),
    # Standard JSON (array of objects) - always eager, no lazy scan support
    # See json.py for JsonLoader which detects format by extension
    "json": LoaderSpec(
        name="JSON",
        scan_func=None,  # Standard JSON does NOT support lazy scan
        read_func="read_json",
        mode_key=None,  # Mode is ignored for standard JSON (always read)
        post_select_columns=True,
        key_mapping={
            "infer_schema_length": "infer_schema_length",
        },
    ),
    # NDJSON spec (used internally by JsonLoader)
    "ndjson": LoaderSpec(
        name="NDJSON",
        scan_func="scan_ndjson",
        read_func="read_ndjson",
        mode_key="jsonMode",
        post_select_columns=True,
        key_mapping={
            "infer_schema_length": "infer_schema_length",
            "batch_size": "batch_size",
            "n_rows": "n_rows",
            "low_memory": "low_memory",
            "rechunk": "rechunk",
            "row_index_name": "row_index_name",
            "row_index_offset": "row_index_offset",
            "ignore_errors": "ignore_errors",
        },
    ),
}
