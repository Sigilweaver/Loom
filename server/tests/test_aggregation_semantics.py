"""Pin Summarize and Sample results and schemas against Polars 2 behaviour.

Each case states the expected data explicitly so a Polars upgrade that changes
null handling or dtype promotion fails here instead of shipping silently.
"""

import datetime as dt
from decimal import Decimal

import polars as pl
import pytest

from app.domain.models.common import DataSchema
from app.domain.tools.expr_builder import AggregationExpr, SampleOperation, SummarizeOperation
from app.domain.tools.implementations.summarize import SummarizeTool
from app.utils.type_mapping import schema_from_polars

OPS = ["Sum", "Mean", "Median", "Min", "Max", "Std", "Var", "Count", "CountDistinct",
       "First", "Last", "Concat"]


def _summarize(lf: pl.LazyFrame, group: list[str], aggs: list[tuple[str, str]]) -> pl.DataFrame:
    op = SummarizeOperation(
        group_by_columns=group,
        aggregations=[AggregationExpr(column=c, operation=o, output_name=o) for c, o in aggs],
    )
    return op.execute(lf).collect()


class TestNullHandling:
    LF = pl.LazyFrame(
        {
            "g": ["a", "a", "a", "b", "b"],
            "v": [1, None, 1, None, None],
            "s": ["x", None, "y", None, None],
        }
    )

    def test_count_and_count_distinct_skip_nulls(self):
        out = _summarize(self.LF, ["g"], [("v", "Count"), ("v", "CountDistinct")])
        assert out.to_dicts() == [
            {"g": "a", "Count": 2, "CountDistinct": 1},
            {"g": "b", "Count": 0, "CountDistinct": 0},
        ]

    def test_concat_joins_non_null_values(self):
        # str.concat was removed in Polars 2; Concat must still work.
        out = _summarize(self.LF, ["g"], [("s", "Concat")])
        assert out.to_dicts() == [{"g": "a", "Concat": "x, y"}, {"g": "b", "Concat": ""}]

    def test_all_null_group(self):
        out = _summarize(self.LF, ["g"], [("v", "Sum"), ("v", "Mean"), ("v", "Max")])
        assert out.row(1, named=True) == {"g": "b", "Sum": 0, "Mean": None, "Max": None}

    def test_null_group_key_is_kept_as_its_own_group(self):
        lf = pl.LazyFrame({"g": ["a", None, None], "v": [1, 2, 3]})
        out = _summarize(lf, ["g"], [("v", "Sum")])
        assert out.to_dicts() == [{"g": "a", "Sum": 1}, {"g": None, "Sum": 5}]


INPUTS = pl.LazyFrame(
    {
        "i8": pl.Series([1, 2], dtype=pl.Int8),
        "u16": pl.Series([1, 2], dtype=pl.UInt16),
        "i32": pl.Series([1, 2], dtype=pl.Int32),
        "i64": [1, 2],
        "f32": pl.Series([1.0, 2.0], dtype=pl.Float32),
        "f64": [1.0, 2.0],
        "b": [True, False],
        "dec": pl.Series([Decimal("1.5"), Decimal("2.5")], dtype=pl.Decimal(10, 2)),
        "d": [dt.date(2020, 1, 1), dt.date(2020, 1, 3)],
        "dtm": [dt.datetime(2020, 1, 1), dt.datetime(2020, 1, 2)],
        "dur": [dt.timedelta(1), dt.timedelta(2)],
        "s": ["a", "b"],
    }
)


@pytest.mark.parametrize("column", INPUTS.collect_schema().names())
@pytest.mark.parametrize("operation", OPS)
async def test_output_schema_matches_execution(column: str, operation: str):
    """get_output_schema must predict exactly the dtype execution produces."""
    try:
        actual = _summarize(INPUTS, [], [(column, operation)])
    except pl.exceptions.PolarsError:
        pytest.skip(f"{operation} does not apply to {column}")
    input_schema: DataSchema = schema_from_polars(INPUTS)
    predicted = await SummarizeTool().get_output_schema(
        {"aggregations": [{"column": column, "operation": operation, "outputName": "out"}]},
        {"input": input_schema},
    )
    assert predicted["output"].columns[0].dtype == schema_from_polars(actual).columns[0].dtype


class TestFirstPercent:
    LF = pl.LazyFrame({"i": list(range(10))})

    @pytest.mark.parametrize(
        ("percent", "rows"), [(0.0, 0), (5.0, 1), (12.5, 1), (50.0, 5), (100.0, 10)]
    )
    def test_row_count(self, percent: float, rows: int):
        out = SampleOperation(mode="FirstPercent", percent=percent).execute(self.LF).collect()
        assert out["i"].to_list() == list(range(rows))

    def test_empty_input_stays_empty(self):
        empty = pl.LazyFrame({"i": []}, schema={"i": pl.Int64})
        out = SampleOperation(mode="FirstPercent", percent=50.0).execute(empty).collect()
        assert out.height == 0


class TestUnionTypes:
    """Union widens numbers but refuses to coerce other mismatches silently."""

    @pytest.mark.parametrize("mode", ["ByName", "ByPosition"])
    def test_numeric_columns_widen(self, mode: str):
        from app.domain.tools.expr_builder import UnionOperation

        a = pl.LazyFrame({"x": pl.Series([1], dtype=pl.Int32)})
        b = pl.LazyFrame({"x": [2.5]})
        out = UnionOperation(mode=mode).execute([a, b]).collect()
        assert out.schema["x"] == pl.Float64
        assert out["x"].to_list() == [1.0, 2.5]

    @pytest.mark.parametrize("mode", ["ByName", "ByPosition"])
    @pytest.mark.parametrize("other", [["a"], [True]])
    def test_non_numeric_mismatch_raises(self, mode: str, other: list[object]):
        from app.domain.tools.expr_builder import UnionOperation
        from app.utils.errors import ToolError

        a = pl.LazyFrame({"x": [1]})
        b = pl.LazyFrame({"x": other})
        with pytest.raises(ToolError, match="incompatible types"):
            UnionOperation(mode=mode).execute([a, b])

    def test_all_null_column_takes_the_other_type(self):
        from app.domain.tools.expr_builder import UnionOperation

        a = pl.LazyFrame({"x": [None]})
        b = pl.LazyFrame({"x": ["a"]})
        out = UnionOperation(mode="ByName").execute([a, b]).collect()
        assert out["x"].to_list() == [None, "a"]


@pytest.mark.parametrize("mode", ["ByName", "ByPosition"])
async def test_union_output_schema_matches_execution(mode: str):
    from app.domain.tools.expr_builder import UnionOperation
    from app.domain.tools.implementations.union import UnionTool

    a = pl.LazyFrame({"x": pl.Series([1], dtype=pl.Int32), "y": ["a"]})
    b = pl.LazyFrame({"x": [2.5], "y": ["b"]})
    actual = schema_from_polars(UnionOperation(mode=mode).execute([a, b]))
    predicted = await UnionTool().get_output_schema(
        {"mode": mode}, {"input": [schema_from_polars(a), schema_from_polars(b)]}
    )
    assert [c.dtype for c in predicted["output"].columns] == [c.dtype for c in actual.columns]
