"""Column profiling implementation using Polars.

Provides modular statistics computation for data columns including:
- Basic stats: count, null_count, unique_count
- Numeric stats: min, max, mean, median, std
- String quality: whitespace issues, non-ASCII characters
- Top values distribution
"""

from enum import Enum
from typing import Any

import polars as pl


class ProfileMetrics(str, Enum):
    """Available profile metrics that can be requested."""

    # Basic metrics (all types)
    COUNT = "count"
    NULL_COUNT = "null_count"
    NULL_PERCENT = "null_percent"
    UNIQUE_COUNT = "unique_count"

    # Numeric metrics
    MIN = "min"
    MAX = "max"
    MEAN = "mean"
    MEDIAN = "median"
    STD = "std"
    MIN_VALUES = "min_values"  # Smallest N values
    MAX_VALUES = "max_values"  # Largest N values

    # String quality metrics
    EMPTY_COUNT = "empty_count"  # Empty strings (not null)
    WHITESPACE_LEADING = "whitespace_leading"
    WHITESPACE_TRAILING = "whitespace_trailing"
    CONTAINS_LINEBREAKS = "contains_linebreaks"
    CONTAINS_NON_ASCII = "contains_non_ascii"

    # Distribution
    TOP_VALUES = "top_values"


# Default metrics for full profile
DEFAULT_METRICS: list[ProfileMetrics] = [
    ProfileMetrics.COUNT,
    ProfileMetrics.NULL_COUNT,
    ProfileMetrics.NULL_PERCENT,
    ProfileMetrics.UNIQUE_COUNT,
    ProfileMetrics.MIN,
    ProfileMetrics.MAX,
    ProfileMetrics.MEAN,
    ProfileMetrics.MEDIAN,
    ProfileMetrics.STD,
    ProfileMetrics.MIN_VALUES,
    ProfileMetrics.MAX_VALUES,
    ProfileMetrics.EMPTY_COUNT,
    ProfileMetrics.WHITESPACE_LEADING,
    ProfileMetrics.WHITESPACE_TRAILING,
    ProfileMetrics.CONTAINS_LINEBREAKS,
    ProfileMetrics.CONTAINS_NON_ASCII,
    ProfileMetrics.TOP_VALUES,
]

# Metrics that only apply to numeric types
NUMERIC_METRICS = {
    ProfileMetrics.MEAN,
    ProfileMetrics.MEDIAN,
    ProfileMetrics.STD,
    ProfileMetrics.MIN_VALUES,
    ProfileMetrics.MAX_VALUES,
}

# Metrics that only apply to string types
STRING_METRICS = {
    ProfileMetrics.EMPTY_COUNT,
    ProfileMetrics.WHITESPACE_LEADING,
    ProfileMetrics.WHITESPACE_TRAILING,
    ProfileMetrics.CONTAINS_LINEBREAKS,
    ProfileMetrics.CONTAINS_NON_ASCII,
}

# Metrics that apply to comparable types (numeric, string, date)
COMPARABLE_METRICS = {
    ProfileMetrics.MIN,
    ProfileMetrics.MAX,
}


def _is_numeric_dtype(dtype: pl.DataType) -> bool:
    """Check if a Polars dtype is numeric."""
    numeric_types = (
        pl.Int8, pl.Int16, pl.Int32, pl.Int64,
        pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
        pl.Float32, pl.Float64, pl.Decimal,
    )
    return isinstance(dtype, numeric_types)


def _is_string_dtype(dtype: pl.DataType) -> bool:
    """Check if a Polars dtype is string-like."""
    return isinstance(dtype, (pl.Utf8, pl.String))


def _is_comparable_dtype(dtype: pl.DataType) -> bool:
    """Check if a Polars dtype supports min/max comparison."""
    comparable_types = (
        pl.Int8, pl.Int16, pl.Int32, pl.Int64,
        pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
        pl.Float32, pl.Float64, pl.Decimal,
        pl.Utf8, pl.String,
        pl.Date, pl.Datetime, pl.Time, pl.Duration,
    )
    return isinstance(dtype, comparable_types)


class ColumnProfiler:
    """Computes profile statistics for dataframe columns."""

    def __init__(
        self,
        metrics: list[ProfileMetrics] | None = None,
        top_values_limit: int = 5,
    ):
        """
        Initialize the profiler.

        Args:
            metrics: List of metrics to compute. If None, uses DEFAULT_METRICS.
            top_values_limit: Number of top values to return (default 5).
        """
        self.metrics = metrics or DEFAULT_METRICS
        self.top_values_limit = top_values_limit

    def profile_column(
        self,
        df: pl.DataFrame,
        column_name: str,
    ) -> dict[str, Any]:
        """
        Profile a single column.

        Args:
            df: Polars DataFrame (already collected)
            column_name: Name of column to profile

        Returns:
            Dictionary of metric values
        """
        if column_name not in df.columns:
            raise ValueError(f"Column '{column_name}' not found in dataframe")

        dtype = df.schema[column_name]
        col = df[column_name]
        result: dict[str, Any] = {
            "column": column_name,
            "dtype": str(dtype),
        }

        for metric in self.metrics:
            value = self._compute_metric(col, dtype, metric)
            if value is not None:
                result[metric.value] = value

        return result

    def profile_columns(
        self,
        df: pl.DataFrame,
        column_names: list[str] | None = None,
    ) -> dict[str, dict[str, Any]]:
        """
        Profile multiple columns.

        Args:
            df: Polars DataFrame (already collected)
            column_names: Columns to profile. If None, profiles all columns.

        Returns:
            Dictionary mapping column names to their profile data
        """
        columns_to_profile = column_names or df.columns
        return {
            col_name: self.profile_column(df, col_name)
            for col_name in columns_to_profile
            if col_name in df.columns
        }

    def _compute_metric(
        self,
        col: pl.Series,
        dtype: pl.DataType,
        metric: ProfileMetrics,
    ) -> Any:
        """Compute a single metric for a column."""
        # Skip metrics that don't apply to this dtype
        if metric in NUMERIC_METRICS and not _is_numeric_dtype(dtype):
            return None
        if metric in STRING_METRICS and not _is_string_dtype(dtype):
            return None
        if metric in COMPARABLE_METRICS and not _is_comparable_dtype(dtype):
            return None

        try:
            match metric:
                case ProfileMetrics.COUNT:
                    return len(col)

                case ProfileMetrics.NULL_COUNT:
                    return col.null_count()

                case ProfileMetrics.NULL_PERCENT:
                    total = len(col)
                    if total == 0:
                        return 0.0
                    return round(col.null_count() / total * 100, 2)

                case ProfileMetrics.UNIQUE_COUNT:
                    return col.n_unique()

                case ProfileMetrics.MIN:
                    val = col.min()
                    return self._serialize_value(val)

                case ProfileMetrics.MAX:
                    val = col.max()
                    return self._serialize_value(val)

                case ProfileMetrics.MEAN:
                    val = col.mean()
                    if val is None:
                        return None
                    return round(float(val), 4)  # type: ignore[arg-type]

                case ProfileMetrics.MEDIAN:
                    val = col.median()
                    if val is None:
                        return None
                    return round(float(val), 4)  # type: ignore[arg-type]

                case ProfileMetrics.STD:
                    val = col.std()
                    if val is None:
                        return None
                    return round(float(val), 4)  # type: ignore[arg-type]

                case ProfileMetrics.EMPTY_COUNT:
                    return self._count_empty_strings(col)

                case ProfileMetrics.WHITESPACE_LEADING:
                    return self._count_whitespace_leading(col)

                case ProfileMetrics.WHITESPACE_TRAILING:
                    return self._count_whitespace_trailing(col)

                case ProfileMetrics.CONTAINS_LINEBREAKS:
                    return self._count_linebreaks(col)

                case ProfileMetrics.CONTAINS_NON_ASCII:
                    return self._count_non_ascii(col)

                case ProfileMetrics.TOP_VALUES:
                    return self._compute_top_values(col)

                case ProfileMetrics.MIN_VALUES:
                    return self._compute_min_values(col)

                case ProfileMetrics.MAX_VALUES:
                    return self._compute_max_values(col)

        except Exception:
            # If any metric computation fails, return None for that metric
            return None

        return None

    def _serialize_value(self, val: Any) -> Any:
        """Serialize a value for JSON output."""
        if val is None:
            return None
        # Convert date/datetime to ISO string
        if hasattr(val, "isoformat"):
            return val.isoformat()
        # Convert timedelta/duration to string
        if hasattr(val, "total_seconds"):
            return str(val)
        return val

    def _count_empty_strings(self, col: pl.Series) -> int:
        """Count empty strings (not null, but zero length)."""
        non_null = col.drop_nulls()
        if len(non_null) == 0:
            return 0
        # Values that are empty strings
        is_empty = non_null.str.len_chars() == 0
        return int(is_empty.sum())

    def _count_whitespace_leading(self, col: pl.Series) -> int:
        """Count values with leading whitespace."""
        non_null = col.drop_nulls()
        if len(non_null) == 0:
            return 0
        # Values that differ when left-stripped
        has_leading = non_null.str.strip_chars_start() != non_null
        return int(has_leading.sum())

    def _count_whitespace_trailing(self, col: pl.Series) -> int:
        """Count values with trailing whitespace."""
        non_null = col.drop_nulls()
        if len(non_null) == 0:
            return 0
        # Values that differ when right-stripped
        has_trailing = non_null.str.strip_chars_end() != non_null
        return int(has_trailing.sum())

    def _count_linebreaks(self, col: pl.Series) -> int:
        """Count values containing line breaks (newline, carriage return)."""
        non_null = col.drop_nulls()
        if len(non_null) == 0:
            return 0
        # Check for \n or \r
        has_breaks = non_null.str.contains(r"[\n\r]")
        return int(has_breaks.sum())

    def _count_non_ascii(self, col: pl.Series) -> int:
        """Count values containing non-ASCII characters (including ZWSP, etc)."""
        non_null = col.drop_nulls()
        if len(non_null) == 0:
            return 0
        # Match any character outside ASCII printable range (0x20-0x7E)
        # This catches ZWSP (U+200B), other zero-width chars, emojis, etc.
        has_non_ascii = non_null.str.contains(r"[^\x20-\x7E]")
        return int(has_non_ascii.sum())

    def _compute_top_values(self, col: pl.Series) -> list[dict[str, Any]]:
        """Compute top N most frequent values."""
        non_null = col.drop_nulls()
        if len(non_null) == 0:
            return []

        # Value counts
        counts = non_null.value_counts(sort=True)
        top = counts.head(self.top_values_limit)

        result = []
        # Column names in value_counts result
        value_col = col.name
        count_col = "count"

        for row in top.iter_rows(named=True):
            result.append({
                "value": self._serialize_value(row[value_col]),
                "count": row[count_col],
            })

        return result

    def _compute_min_values(self, col: pl.Series) -> list[Any]:
        """Compute the N smallest unique values for numeric columns."""
        non_null = col.drop_nulls()
        if len(non_null) == 0:
            return []

        # Get unique values sorted ascending
        unique_sorted = non_null.unique().sort()
        smallest = unique_sorted.head(self.top_values_limit)

        return [self._serialize_value(v) for v in smallest.to_list()]

    def _compute_max_values(self, col: pl.Series) -> list[Any]:
        """Compute the N largest unique values for numeric columns."""
        non_null = col.drop_nulls()
        if len(non_null) == 0:
            return []

        # Get unique values sorted descending
        unique_sorted = non_null.unique().sort(descending=True)
        largest = unique_sorted.head(self.top_values_limit)

        return [self._serialize_value(v) for v in largest.to_list()]
