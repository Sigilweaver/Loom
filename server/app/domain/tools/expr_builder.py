"""
Expression builder for unified execution and code generation.

This module provides a way to define Polars transformations once
and use them for both runtime execution and Python code generation.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import polars as pl


class ExprNode(ABC):
    """Base class for expression AST nodes."""

    @abstractmethod
    def to_polars(self) -> pl.Expr:
        """Convert to actual Polars expression for execution."""
        pass

    @abstractmethod
    def to_code(self) -> str:
        """Convert to Python code string."""
        pass


@dataclass
class ColRef(ExprNode):
    """Reference to a column."""

    name: str

    def to_polars(self) -> pl.Expr:
        return pl.col(self.name)

    def to_code(self) -> str:
        escaped = self.name.replace("\\", "\\\\").replace('"', '\\"')
        return f'pl.col("{escaped}")'


@dataclass
class Cast(ExprNode):
    """Cast expression to a type."""

    expr: ExprNode
    dtype: str  # e.g., "Float64", "Int32"

    # Mapping from string to Polars type
    DTYPE_MAP: dict[str, type] = field(default_factory=lambda: {
        "Int8": pl.Int8,
        "Int16": pl.Int16,
        "Int32": pl.Int32,
        "Int64": pl.Int64,
        "UInt8": pl.UInt8,
        "UInt16": pl.UInt16,
        "UInt32": pl.UInt32,
        "UInt64": pl.UInt64,
        "Float32": pl.Float32,
        "Float64": pl.Float64,
        "Boolean": pl.Boolean,
        "Utf8": pl.Utf8,
        "String": pl.String,
        "Date": pl.Date,
        "Datetime": pl.Datetime,
        "Time": pl.Time,
        "Duration": pl.Duration,
        "Categorical": pl.Categorical,
    }, repr=False)

    def to_polars(self) -> pl.Expr:
        polars_type = self.DTYPE_MAP.get(self.dtype)
        if polars_type:
            return self.expr.to_polars().cast(polars_type)
        return self.expr.to_polars()

    def to_code(self) -> str:
        if self.dtype in self.DTYPE_MAP:
            return f"{self.expr.to_code()}.cast(pl.{self.dtype})"
        return self.expr.to_code()


@dataclass
class StrHead(ExprNode):
    """Truncate string to first n characters."""

    expr: ExprNode
    n: int

    def to_polars(self) -> pl.Expr:
        return self.expr.to_polars().str.head(self.n)

    def to_code(self) -> str:
        return f"{self.expr.to_code()}.str.head({self.n})"


@dataclass
class Alias(ExprNode):
    """Rename expression output."""

    expr: ExprNode
    name: str

    def to_polars(self) -> pl.Expr:
        return self.expr.to_polars().alias(self.name)

    def to_code(self) -> str:
        escaped = self.name.replace("\\", "\\\\").replace('"', '\\"')
        return f'{self.expr.to_code()}.alias("{escaped}")'


@dataclass
class Filter(ExprNode):
    """Filter expression (boolean)."""

    expr_str: str  # Raw Polars expression string

    def to_polars(self) -> pl.Expr:
        from app.utils.expression import parse_polars_expression
        return parse_polars_expression(self.expr_str)

    def to_code(self) -> str:
        from app.utils.expression import normalize_expression
        return normalize_expression(self.expr_str)


@dataclass
class WithColumns(ExprNode):
    """Add/replace column with expression."""

    expr_str: str  # Raw Polars expression string
    alias: str

    def to_polars(self) -> pl.Expr:
        from app.utils.expression import parse_polars_expression
        return parse_polars_expression(self.expr_str).alias(self.alias)

    def to_code(self) -> str:
        from app.utils.expression import normalize_expression
        escaped = self.alias.replace("\\", "\\\\").replace('"', '\\"')
        return f'{normalize_expression(self.expr_str)}.alias("{escaped}")'


# Higher-level operation builders

@dataclass
class SelectOperation:
    """Represents a full select operation with multiple columns."""

    expressions: list[ExprNode] = field(default_factory=list)

    def execute(self, lf: pl.LazyFrame) -> pl.LazyFrame:
        """Execute the select operation."""
        if not self.expressions:
            return lf
        polars_exprs = [expr.to_polars() for expr in self.expressions]
        return lf.select(polars_exprs)

    def to_code(self, input_var: str, output_var: str) -> list[str]:
        """Generate Python code for this operation."""
        if not self.expressions:
            return [f"{output_var} = {input_var}"]

        if len(self.expressions) == 1:
            return [f"{output_var} = {input_var}.select({self.expressions[0].to_code()})"]

        lines = [f"{output_var} = {input_var}.select(["]
        for expr in self.expressions:
            lines.append(f"    {expr.to_code()},")
        lines.append("])")
        return lines


@dataclass
class FilterOperation:
    """Represents a filter operation with true/false outputs."""

    expr_str: str

    def execute(self, lf: pl.LazyFrame) -> tuple[pl.LazyFrame, pl.LazyFrame]:
        """Execute filter, returning (true_output, false_output)."""
        if not self.expr_str or self.expr_str.strip() == "":
            return lf, lf.clear()

        from app.utils.expression import parse_polars_expression
        filter_expr = parse_polars_expression(self.expr_str)
        return lf.filter(filter_expr), lf.filter(~filter_expr)

    def to_code(self, input_var: str, var_t: str, var_f: str) -> list[str]:
        """Generate Python code for filter operation."""
        if not self.expr_str or self.expr_str.strip() == "":
            return [
                f"{var_t} = {input_var}",
                f"{var_f} = {input_var}.clear()",
            ]

        from app.utils.expression import normalize_expression
        expr_code = normalize_expression(self.expr_str)
        return [
            f"{var_t} = {input_var}.filter({expr_code})",
            f"{var_f} = {input_var}.filter(~({expr_code}))",
        ]


@dataclass
class FormulaOperation:
    """Represents adding/replacing a calculated column."""

    column_name: str
    expr_str: str

    def execute(self, lf: pl.LazyFrame) -> pl.LazyFrame:
        """Execute formula operation."""
        if not self.column_name or not self.expr_str:
            return lf

        from app.utils.expression import parse_polars_expression
        expr = parse_polars_expression(self.expr_str)
        return lf.with_columns(expr.alias(self.column_name))

    def to_code(self, input_var: str, output_var: str) -> list[str]:
        """Generate Python code for formula operation."""
        if not self.column_name or not self.expr_str:
            return [f"{output_var} = {input_var}"]

        from app.utils.expression import normalize_expression
        expr_code = normalize_expression(self.expr_str)
        escaped_name = self.column_name.replace("\\", "\\\\").replace('"', '\\"')
        return [
            f'{output_var} = {input_var}.with_columns({expr_code}.alias("{escaped_name}"))'
        ]


@dataclass
class SortColumn:
    """Configuration for a single sort column."""
    column: str
    descending: bool = False
    nulls_last: bool = True


@dataclass
class SortOperation:
    """Represents a sort operation."""

    columns: list[SortColumn] = field(default_factory=list)

    def execute(self, lf: pl.LazyFrame) -> pl.LazyFrame:
        """Execute sort operation."""
        if not self.columns:
            return lf

        by_columns = [c.column for c in self.columns]
        descending = [c.descending for c in self.columns]
        nulls_last = [c.nulls_last for c in self.columns]

        return lf.sort(by=by_columns, descending=descending, nulls_last=nulls_last)

    def to_code(self, input_var: str, output_var: str) -> list[str]:
        """Generate Python code for sort operation."""
        if not self.columns:
            return [f"{output_var} = {input_var}"]

        by_str = ", ".join(f'"{c.column}"' for c in self.columns)
        desc_str = ", ".join("True" if c.descending else "False" for c in self.columns)
        nulls_str = ", ".join("True" if c.nulls_last else "False" for c in self.columns)

        return [
            f"{output_var} = {input_var}.sort(",
            f"    by=[{by_str}],",
            f"    descending=[{desc_str}],",
            f"    nulls_last=[{nulls_str}],",
            ")",
        ]


# Sample modes that require blocking (full data scan)
BLOCKING_SAMPLE_MODES = {"LastN", "Random", "RandomPercent", "FirstPercent"}


@dataclass
class SampleOperation:
    """Represents a sample operation with multiple modes."""

    mode: str = "FirstN"  # FirstN, LastN, EveryN, Random, RandomPercent, FirstPercent
    n: int = 100  # Number of rows (for FirstN, LastN, Random) or interval (for EveryN)
    percent: float = 10.0  # Percentage for RandomPercent, FirstPercent
    offset: int = 0  # Offset for EveryN mode
    seed: int | None = None  # Random seed for reproducibility

    def is_blocking(self) -> bool:
        """Check if this mode requires full data scan."""
        return self.mode in BLOCKING_SAMPLE_MODES

    def execute(self, lf: pl.LazyFrame) -> pl.LazyFrame:
        """Execute sample operation."""
        if self.mode == "FirstN":
            return lf.head(self.n)

        elif self.mode == "LastN":
            return lf.tail(self.n)

        elif self.mode == "EveryN":
            return lf.gather_every(self.n, offset=self.offset)

        elif self.mode == "Random":
            # Random sampling requires collect() - blocking
            df = lf.collect()
            return df.sample(n=min(self.n, len(df)), seed=self.seed).lazy()

        elif self.mode == "RandomPercent":
            # Random percent sampling requires collect() - blocking
            fraction = self.percent / 100.0
            df = lf.collect()
            return df.sample(fraction=min(fraction, 1.0), seed=self.seed).lazy()

        elif self.mode == "FirstPercent":
            # First N% requires knowing row count - blocking
            df = lf.collect()
            n_rows = max(1, int(len(df) * self.percent / 100.0))
            return df.head(n_rows).lazy()

        else:
            # Unknown mode - pass through
            return lf

    def to_code(self, input_var: str, output_var: str) -> list[str]:
        """Generate Python code for sample operation."""
        if self.mode == "FirstN":
            return [f"{output_var} = {input_var}.head({self.n})"]

        elif self.mode == "LastN":
            return [f"{output_var} = {input_var}.tail({self.n})"]

        elif self.mode == "EveryN":
            if self.offset > 0:
                return [f"{output_var} = {input_var}.gather_every({self.n}, offset={self.offset})"]
            return [f"{output_var} = {input_var}.gather_every({self.n})"]

        elif self.mode == "Random":
            seed_arg = f", seed={self.seed}" if self.seed is not None else ""
            return [
                f"_df_temp = {input_var}.collect()",
                f"{output_var} = _df_temp.sample(n=min({self.n}, len(_df_temp)){seed_arg}).lazy()",
            ]

        elif self.mode == "RandomPercent":
            fraction = self.percent / 100.0
            seed_arg = f", seed={self.seed}" if self.seed is not None else ""
            return [
                f"_df_temp = {input_var}.collect()",
                f"{output_var} = _df_temp.sample(fraction=min({fraction}, 1.0){seed_arg}).lazy()",
            ]

        elif self.mode == "FirstPercent":
            return [
                f"_df_temp = {input_var}.collect()",
                f"_n_rows = max(1, int(len(_df_temp) * {self.percent} / 100.0))",
                f"{output_var} = _df_temp.head(_n_rows).lazy()",
            ]

        else:
            return [f"{output_var} = {input_var}"]


# Aggregation method mapping
AGGREGATION_METHODS = {
    "Sum": ("sum", ".sum()"),
    "Mean": ("mean", ".mean()"),
    "Median": ("median", ".median()"),
    "Min": ("min", ".min()"),
    "Max": ("max", ".max()"),
    "Std": ("std", ".std()"),
    "Var": ("var", ".var()"),
    "Count": ("count", ".count()"),
    "CountDistinct": ("n_unique", ".n_unique()"),
    "First": ("first", ".first()"),
    "Last": ("last", ".last()"),
    "Concat": ("str.concat", '.str.concat(", ")'),
}


@dataclass
class AggregationExpr:
    """Configuration for a single aggregation."""
    column: str
    operation: str
    output_name: str = ""

    def to_polars(self) -> pl.Expr:
        """Build Polars aggregation expression."""
        expr = pl.col(self.column)

        if self.operation == "Sum":
            expr = expr.sum()
        elif self.operation == "Mean":
            expr = expr.mean()
        elif self.operation == "Median":
            expr = expr.median()
        elif self.operation == "Min":
            expr = expr.min()
        elif self.operation == "Max":
            expr = expr.max()
        elif self.operation == "Std":
            expr = expr.std()
        elif self.operation == "Var":
            expr = expr.var()
        elif self.operation == "Count":
            expr = expr.count()
        elif self.operation == "CountDistinct":
            expr = expr.n_unique()
        elif self.operation == "First":
            expr = expr.first()
        elif self.operation == "Last":
            expr = expr.last()
        elif self.operation == "Concat":
            expr = expr.str.concat(delimiter=", ")
        else:
            expr = expr.sum()  # fallback

        # Apply alias
        default_alias = f"{self.column}_{self.operation}"
        out_name = self.output_name.strip() if self.output_name else ""
        alias = out_name if out_name else default_alias
        return expr.alias(alias)

    def to_code(self) -> str:
        """Generate code for this aggregation."""
        escaped_col = self.column.replace("\\", "\\\\").replace('"', '\\"')
        expr_str = f'pl.col("{escaped_col}")'

        method_code = AGGREGATION_METHODS.get(self.operation, ("sum", ".sum()"))[1]
        expr_str += method_code

        default_alias = f"{self.column}_{self.operation}"
        out_name = self.output_name.strip() if self.output_name else ""
        alias = out_name if out_name else default_alias
        escaped_alias = alias.replace("\\", "\\\\").replace('"', '\\"')
        expr_str += f'.alias("{escaped_alias}")'

        return expr_str


@dataclass
class SummarizeOperation:
    """Represents a summarize (group by + aggregate) operation."""

    group_by_columns: list[str] = field(default_factory=list)
    aggregations: list[AggregationExpr] = field(default_factory=list)

    def execute(self, lf: pl.LazyFrame) -> pl.LazyFrame:
        """Execute summarize operation."""
        # Group-by only (distinct values)
        if not self.aggregations:
            if not self.group_by_columns:
                return lf
            return lf.select(self.group_by_columns).unique()

        # Build aggregation expressions
        agg_exprs = [agg.to_polars() for agg in self.aggregations]

        if self.group_by_columns:
            return lf.group_by(self.group_by_columns).agg(agg_exprs)
        else:
            return lf.select(agg_exprs)

    def to_code(self, input_var: str, output_var: str) -> list[str]:
        """Generate Python code for summarize operation."""
        # Group-by only (distinct values)
        if not self.aggregations:
            if not self.group_by_columns:
                return [f"{output_var} = {input_var}"]
            cols_str = ", ".join(f'"{c}"' for c in self.group_by_columns)
            return [f"{output_var} = {input_var}.select([{cols_str}]).unique()"]

        # Build aggregation code
        agg_code_parts = [agg.to_code() for agg in self.aggregations]

        if self.group_by_columns:
            group_by_str = ", ".join(f'"{c}"' for c in self.group_by_columns)
            lines = [f"{output_var} = {input_var}.group_by([{group_by_str}]).agg(["]
        else:
            lines = [f"{output_var} = {input_var}.select(["]

        for i, expr_str in enumerate(agg_code_parts):
            comma = "," if i < len(agg_code_parts) - 1 else ""
            lines.append(f"    {expr_str}{comma}")

        lines.append("])")
        return lines


@dataclass
class JoinOperation:
    """Represents a join operation with three outputs."""

    left_keys: list[str] = field(default_factory=list)
    right_keys: list[str] = field(default_factory=list)
    right_suffix: str = "_right"
    join_type: str = "inner"

    def execute(
        self, left_lf: pl.LazyFrame | None, right_lf: pl.LazyFrame | None
    ) -> tuple[pl.LazyFrame, pl.LazyFrame, pl.LazyFrame]:
        """Execute join, returning (unmatched_left, matched, unmatched_right)."""
        empty = pl.LazyFrame([])

        if left_lf is None and right_lf is None:
            return empty, empty, empty

        if left_lf is None:
            # right_lf cannot be None here (checked above)
            assert right_lf is not None
            return empty, empty, right_lf

        if right_lf is None:
            return left_lf, empty, empty

        # Cross join when no keys are specified
        if not self.left_keys or not self.right_keys:
            matched = left_lf.join(
                right_lf,
                how="cross",
                suffix=self.right_suffix,
            )
            return empty, matched, empty

        # Use the configured join type for the matched output
        how = self.join_type if self.join_type in ("inner", "left", "right", "outer") else "inner"

        matched = left_lf.join(
            right_lf,
            left_on=self.left_keys,
            right_on=self.right_keys,
            how=how,
            suffix=self.right_suffix,
            coalesce=True,
        )

        # Anti-join for unmatched rows
        # For left/outer joins, unmatched_left is empty (already included in matched)
        if how in ("left", "outer"):
            unmatched_left = empty
        else:
            unmatched_left = left_lf.join(
                right_lf,
                left_on=self.left_keys,
                right_on=self.right_keys,
                how="anti",
            )

        # For right/outer joins, unmatched_right is empty (already included in matched)
        if how in ("right", "outer"):
            unmatched_right = empty
        else:
            unmatched_right = right_lf.join(
                left_lf,
                left_on=self.right_keys,
                right_on=self.left_keys,
                how="anti",
            )

        return unmatched_left, matched, unmatched_right

    def to_code(
        self,
        left_var: str | None,
        right_var: str | None,
        left_out_var: str,
        match_out_var: str,
        right_out_var: str,
    ) -> list[str]:
        """Generate Python code for join operation."""
        lines: list[str] = []

        if not left_var and not right_var:
            lines.append(f"{left_out_var} = pl.LazyFrame([])")
            lines.append(f"{match_out_var} = pl.LazyFrame([])")
            lines.append(f"{right_out_var} = pl.LazyFrame([])")
        elif not left_var:
            lines.append(f"{left_out_var} = pl.LazyFrame([])")
            lines.append(f"{match_out_var} = pl.LazyFrame([])")
            lines.append(f"{right_out_var} = {right_var}")
        elif not right_var:
            lines.append(f"{left_out_var} = {left_var}")
            lines.append(f"{match_out_var} = pl.LazyFrame([])")
            lines.append(f"{right_out_var} = pl.LazyFrame([])")
        elif not self.left_keys or not self.right_keys:
            # Cross join when no keys specified
            lines.append("# Cross join: Cartesian product of both datasets")
            lines.append(
                f"{match_out_var} = {left_var}.join("
                f"{right_var}, "
                f'how="cross", '
                f'suffix="{self.right_suffix}")'
            )
            lines.append(f"{left_out_var} = pl.LazyFrame([])")
            lines.append(f"{right_out_var} = pl.LazyFrame([])")
        else:
            left_keys_str = repr(self.left_keys)
            right_keys_str = repr(self.right_keys)
            how = self.join_type if self.join_type in ("inner", "left", "right", "outer") else "inner"

            lines.append(f"# Join: {how} join for matches")
            lines.append(
                f"{match_out_var} = {left_var}.join("
                f"{right_var}, "
                f"left_on={left_keys_str}, "
                f"right_on={right_keys_str}, "
                f'how="{how}", '
                f'suffix="{self.right_suffix}", '
                f"coalesce=True)"
            )

            if how in ("left", "outer"):
                lines.append(
                    f"{left_out_var} = pl.LazyFrame([])  "
                    f"# unmatched left already in {how} join"
                )
            else:
                lines.append("")
                lines.append("# Join: unmatched left rows (anti-join)")
                lines.append(
                    f"{left_out_var} = {left_var}.join("
                    f"{right_var}, "
                    f"left_on={left_keys_str}, "
                    f"right_on={right_keys_str}, "
                    f'how="anti")'
                )

            if how in ("right", "outer"):
                lines.append(
                    f"{right_out_var} = pl.LazyFrame([])  "
                    f"# unmatched right already in {how} join"
                )
            else:
                lines.append("")
                lines.append("# Join: unmatched right rows (anti-join)")
                lines.append(
                    f"{right_out_var} = {right_var}.join("
                    f"{left_var}, "
                    f"left_on={right_keys_str}, "
                    f"right_on={left_keys_str}, "
                    f'how="anti")'
                )

        return lines


@dataclass
class UnionOperation:
    """Represents a union operation."""

    mode: str = "ByName"  # "ByName" or "ByPosition"

    def execute(self, frames: list[pl.LazyFrame]) -> pl.LazyFrame:
        """Execute union operation."""
        if not frames:
            return pl.LazyFrame([])

        if len(frames) == 1:
            return frames[0]

        if self.mode == "ByName":
            return pl.concat(frames, how="diagonal")
        elif self.mode == "ByPosition":
            first_frame = frames[0]
            target_cols = first_frame.collect_schema().names()

            processed_frames = [first_frame]
            for i in range(1, len(frames)):
                current_frame = frames[i]
                current_cols = current_frame.collect_schema().names()
                rename_map = {old: new for old, new in zip(current_cols, target_cols)}
                processed_frames.append(current_frame.rename(rename_map))

            return pl.concat(processed_frames, how="vertical")
        else:
            return pl.concat(frames, how="vertical")

    def to_code(self, input_vars: list[str], output_var: str) -> list[str]:
        """Generate Python code for union operation."""
        if not input_vars:
            return [f"{output_var} = pl.LazyFrame([])"]

        if len(input_vars) == 1:
            return [f"{output_var} = {input_vars[0]}"]

        frames_str = ", ".join(input_vars)

        if self.mode == "ByName":
            return [f'{output_var} = pl.concat([{frames_str}], how="diagonal")']
        elif self.mode == "ByPosition":
            return [
                "# Union by position - align columns to first frame",
                f"_union_frames = [{frames_str}]",
                "_first_cols = _union_frames[0].collect_schema().names()",
                "_processed = [_union_frames[0]]",
                "for _frame in _union_frames[1:]:",
                "    _curr_cols = _frame.collect_schema().names()",
                "    _rename_map = {old: new for old, new in zip(_curr_cols, _first_cols)}",
                "    _processed.append(_frame.rename(_rename_map))",
                f'{output_var} = pl.concat(_processed, how="vertical")',
            ]
        else:
            return [f'{output_var} = pl.concat([{frames_str}], how="vertical")']


@dataclass
class UniqueOperation:
    """Represents a unique/deduplicate operation with two outputs.

    Modes:
    - "First" (Alteryx-style): Unique = first occurrence of each value,
                               Duplicate = subsequent occurrences
    - "Strict": Unique = ONLY values appearing exactly once,
                Duplicate = ALL rows where value appears more than once
    """

    columns: list[str] = field(default_factory=list)  # Empty = all columns
    mode: str = "First"  # "First" or "Strict"

    def execute(self, lf: pl.LazyFrame) -> tuple[pl.LazyFrame, pl.LazyFrame]:
        """Execute unique operation, returning (unique_output, duplicate_output)."""
        # Build the key expression - use struct for multiple columns
        if self.columns:
            key_expr = pl.struct(self.columns)
        else:
            # Use all columns
            all_cols = lf.collect_schema().names()
            key_expr = pl.struct(all_cols)

        if self.mode == "Strict":
            # Strict mode: unique = values appearing exactly once
            # duplicate = all rows where value appears more than once
            mask_expr = key_expr.is_unique()
        else:
            # First mode (default): unique = first occurrence
            # duplicate = subsequent occurrences
            mask_expr = key_expr.is_first_distinct()

        unique_output = lf.filter(mask_expr)
        duplicate_output = lf.filter(~mask_expr)
        return unique_output, duplicate_output

    def to_code(
        self, input_var: str, unique_var: str, duplicate_var: str
    ) -> list[str]:
        """Generate Python code for unique operation."""
        lines: list[str] = []

        # Build key expression code
        if self.columns:
            cols_str = ", ".join(f'"{c}"' for c in self.columns)
            key_code = f"pl.struct([{cols_str}])"
        else:
            lines.append(f"_all_cols = {input_var}.collect_schema().names()")
            key_code = "pl.struct(_all_cols)"

        if self.mode == "Strict":
            lines.append(f"_unique_mask = {key_code}.is_unique()")
        else:
            lines.append(f"_unique_mask = {key_code}.is_first_distinct()")

        lines.append(f"{unique_var} = {input_var}.filter(_unique_mask)")
        lines.append(f"{duplicate_var} = {input_var}.filter(~_unique_mask)")
        return lines


@dataclass
class UnpivotOperation:
    """Represents an unpivot (melt) operation - wide to long format.

    Transforms columns into rows. Selected columns become values in a single column,
    with a new column indicating which original column each value came from.
    """

    on: list[str]  # Columns to unpivot (their values become rows)
    index: list[str] = field(default_factory=list)  # Columns to keep as identifiers
    variable_name: str = "variable"  # Name for the column storing original column names
    value_name: str = "value"  # Name for the column storing the values

    def execute(self, lf: pl.LazyFrame) -> pl.LazyFrame:
        """Execute unpivot operation."""
        return lf.unpivot(
            on=self.on,
            index=self.index if self.index else None,
            variable_name=self.variable_name,
            value_name=self.value_name,
        )

    def to_code(self, input_var: str, output_var: str) -> list[str]:
        """Generate Python code for unpivot operation."""
        on_str = ", ".join(f'"{c}"' for c in self.on)
        var_escaped = self.variable_name.replace("\\", "\\\\").replace('"', '\\"')
        val_escaped = self.value_name.replace("\\", "\\\\").replace('"', '\\"')

        if self.index:
            index_str = ", ".join(f'"{c}"' for c in self.index)
            return [
                f"{output_var} = {input_var}.unpivot(",
                f'    on=[{on_str}],',
                f'    index=[{index_str}],',
                f'    variable_name="{var_escaped}",',
                f'    value_name="{val_escaped}",',
                ")",
            ]
        else:
            return [
                f"{output_var} = {input_var}.unpivot(",
                f'    on=[{on_str}],',
                f'    variable_name="{var_escaped}",',
                f'    value_name="{val_escaped}",',
                ")",
            ]


@dataclass
class PivotOperation:
    """Represents a pivot operation - long to wide format.

    Transforms row values into columns. Values from one column become column headers,
    values from another column fill those new columns.
    """

    on: str  # Column whose values become new column headers
    index: list[str]  # Columns to group by (preserved as-is)
    values: str  # Column whose values fill the new columns
    aggregate_function: str = "first"  # How to aggregate duplicate values

    # Valid aggregation functions for pivot
    VALID_AGGREGATIONS: set[str] = field(default_factory=lambda: {
        "first", "last", "sum", "mean", "median", "min", "max", "len"
    }, repr=False)

    def execute(self, lf: pl.LazyFrame) -> pl.LazyFrame:
        """Execute pivot operation.

        Note: Pivot is an eager operation in Polars. This collects the LazyFrame,
        performs the pivot on the DataFrame, then returns as a LazyFrame.
        The PivotTool is_blocking() returns True to ensure proper execution.
        """
        agg_func = self.aggregate_function if self.aggregate_function in self.VALID_AGGREGATIONS else "first"
        # Pivot requires eager execution - collect, pivot, return lazy
        df = lf.collect()
        result = df.pivot(
            on=self.on,
            index=self.index if self.index else None,
            values=self.values,
            aggregate_function=agg_func,
        )
        return result.lazy()

    def to_code(self, input_var: str, output_var: str) -> list[str]:
        """Generate Python code for pivot operation.

        Note: Pivot requires eager execution (DataFrame.pivot has different signature
        than LazyFrame.pivot). We collect, pivot, then return lazy.
        """
        on_escaped = self.on.replace("\\", "\\\\").replace('"', '\\"')
        values_escaped = self.values.replace("\\", "\\\\").replace('"', '\\"')
        agg_func = self.aggregate_function if self.aggregate_function in self.VALID_AGGREGATIONS else "first"

        lines = [f"_df_pivot_temp = {input_var}.collect()"]

        if self.index:
            index_str = ", ".join(f'"{c}"' for c in self.index)
            lines.extend([
                f"{output_var} = _df_pivot_temp.pivot(",
                f'    on="{on_escaped}",',
                f'    index=[{index_str}],',
                f'    values="{values_escaped}",',
                f'    aggregate_function="{agg_func}",',
                ").lazy()",
            ])
        else:
            lines.extend([
                f"{output_var} = _df_pivot_temp.pivot(",
                f'    on="{on_escaped}",',
                f'    values="{values_escaped}",',
                f'    aggregate_function="{agg_func}",',
                ").lazy()",
            ])
        return lines


def build_select_expr(col_config: dict[str, Any]) -> ExprNode | None:
    """Build a select expression from column configuration."""
    name = col_config.get("name")
    selected = col_config.get("selected", True)
    rename = col_config.get("rename")
    target_type = col_config.get("targetType")
    size = col_config.get("size")

    if not name or not selected:
        return None

    # Start with column reference
    expr: ExprNode = ColRef(name)

    # Apply type cast if specified
    if target_type:
        expr = Cast(expr, target_type)

    # Apply string truncation if specified
    if size is not None and size > 0:
        if target_type in ("String", "Utf8") or target_type is None:
            expr = StrHead(expr, size)

    # Apply rename/alias
    output_name = rename.strip() if rename and rename.strip() else name
    expr = Alias(expr, output_name)

    return expr
