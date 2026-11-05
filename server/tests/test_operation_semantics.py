"""Pin row-level semantics of the shared operation builders.

Each operation is run twice, once through ``execute()`` and once by exec'ing
the code produced by ``to_code()``, and the two results must agree. The cases
below guard against silent wrong-data behaviour: rows lost to null predicates,
unstable ordering, and type-mismatched unions.
"""

from typing import Any

import polars as pl
import pytest

from app.domain.tools.expr_builder import (
    AggregationExpr,
    FilterOperation,
    JoinOperation,
    SortColumn,
    SortOperation,
    SummarizeOperation,
    UnionOperation,
    UniqueOperation,
    _q,
)


def _run_code(lines: list[str], **env: Any) -> dict[str, Any]:
    scope: dict[str, Any] = {"pl": pl, **env}
    exec("\n".join(lines), scope)
    return scope


class TestFilterNulls:
    def test_null_predicate_rows_go_to_false_output(self):
        lf = pl.LazyFrame({"id": [1, 2, 3, 4], "a": [5, None, 1, None]})
        op = FilterOperation("pl.col('a') > 2")
        true_lf, false_lf = op.execute(lf)
        assert true_lf.collect()["id"].to_list() == [1]
        assert false_lf.collect()["id"].to_list() == [2, 3, 4]

    def test_true_and_false_partition_the_input(self):
        lf = pl.LazyFrame({"a": [5, None, 1, 7, None]})
        true_lf, false_lf = FilterOperation("pl.col('a') > 2").execute(lf)
        assert true_lf.collect().height + false_lf.collect().height == 5

    def test_generated_code_matches_execute(self):
        lf = pl.LazyFrame({"id": [1, 2, 3], "a": [5, None, 1]})
        op = FilterOperation("pl.col('a') > 2")
        scope = _run_code(op.to_code("src", "t", "f"), src=lf)
        assert scope["f"].collect()["id"].to_list() == [2, 3]
        assert scope["t"].collect()["id"].to_list() == [1]


class TestOrdering:
    def test_sort_is_stable_for_ties(self):
        lf = pl.LazyFrame({"k": [1, 1, 1, 0, 0], "seq": [0, 1, 2, 3, 4]})
        op = SortOperation([SortColumn("k")])
        assert op.execute(lf).collect()["seq"].to_list() == [3, 4, 0, 1, 2]
        scope = _run_code(op.to_code("src", "out"), src=lf)
        assert scope["out"].collect()["seq"].to_list() == [3, 4, 0, 1, 2]

    def test_group_by_keeps_first_appearance_order(self):
        keys = [f"k{i % 37}" for i in range(500)]
        lf = pl.LazyFrame({"k": keys, "v": list(range(500))})
        op = SummarizeOperation(["k"], [AggregationExpr("v", "Sum", "total")])
        expected = list(dict.fromkeys(keys))
        assert op.execute(lf).collect()["k"].to_list() == expected
        scope = _run_code(op.to_code("src", "out"), src=lf)
        assert scope["out"].collect()["k"].to_list() == expected

    def test_distinct_group_by_keeps_first_appearance_order(self):
        keys = [f"k{i % 11}" for i in range(100)]
        lf = pl.LazyFrame({"k": keys})
        op = SummarizeOperation(["k"], [])
        assert op.execute(lf).collect()["k"].to_list() == list(dict.fromkeys(keys))

    @pytest.mark.parametrize("how", ["inner", "left", "outer"])
    def test_join_preserves_left_order(self, how: str):
        left_ids = list(range(200, 0, -1))
        left = pl.LazyFrame({"id": left_ids, "l": left_ids})
        right = pl.LazyFrame({"id": list(range(1, 201)), "r": list(range(1, 201))})
        op = JoinOperation(["id"], ["id"], join_type=how)
        _, matched, _ = op.execute(left, right)
        assert matched.collect()["id"].to_list() == left_ids
        scope = _run_code(
            op.to_code("l", "r", "lo", "mo", "ro"), l=left, r=right
        )
        assert scope["mo"].collect()["id"].to_list() == left_ids

    def test_join_right_preserves_right_order(self):
        right_ids = list(range(200, 0, -1))
        left = pl.LazyFrame({"id": list(range(1, 201)), "l": list(range(1, 201))})
        right = pl.LazyFrame({"id": right_ids, "r": right_ids})
        _, matched, _ = JoinOperation(["id"], ["id"], join_type="right").execute(left, right)
        assert matched.collect()["id"].to_list() == right_ids

    def test_unmatched_outputs_keep_order(self):
        left = pl.LazyFrame({"id": [9, 8, 7, 1]})
        right = pl.LazyFrame({"id": [1, 5, 6, 4]})
        ul, _, ur = JoinOperation(["id"], ["id"]).execute(left, right)
        assert ul.collect()["id"].to_list() == [9, 8, 7]
        assert ur.collect()["id"].to_list() == [5, 6, 4]


class TestUnionTypes:
    def test_by_name_widens_mismatched_numeric_types(self):
        a = pl.LazyFrame({"x": [1, 2]})
        b = pl.LazyFrame({"x": [1.5]})
        out = UnionOperation("ByName").execute([a, b]).collect()
        assert out.schema["x"] == pl.Float64
        assert out["x"].to_list() == [1.0, 2.0, 1.5]

    def test_by_name_fills_missing_columns_with_null(self):
        a = pl.LazyFrame({"x": [1]})
        b = pl.LazyFrame({"y": ["q"]})
        out = UnionOperation("ByName").execute([a, b]).collect()
        assert out.to_dicts() == [{"x": 1, "y": None}, {"x": None, "y": "q"}]

    def test_by_position_widens_and_renames(self):
        a = pl.LazyFrame({"x": [1]})
        b = pl.LazyFrame({"other": [2.5]})
        out = UnionOperation("ByPosition").execute([a, b]).collect()
        assert out.columns == ["x"]
        assert out["x"].to_list() == [1.0, 2.5]

    def test_generated_code_matches_execute(self):
        a = pl.LazyFrame({"x": [1]})
        b = pl.LazyFrame({"x": [1.5]})
        op = UnionOperation("ByName")
        scope = _run_code(op.to_code(["a", "b"], "out"), a=a, b=b)
        assert scope["out"].collect().equals(op.execute([a, b]).collect())


class TestUniqueSemantics:
    def test_first_mode_partitions_rows_with_null_keys(self):
        lf = pl.LazyFrame({"k": [1, None, 1, None, 2]})
        uniq, dup = UniqueOperation(["k"], "First").execute(lf)
        assert uniq.collect()["k"].to_list() == [1, None, 2]
        assert dup.collect()["k"].to_list() == [1, None]


class TestCodegenQuoting:
    @pytest.mark.parametrize("name", ['we"ird', "back\\slash", "tab\tname", "new\nline"])
    def test_column_literal_round_trips(self, name: str):
        assert eval(_q(name)) == name

    def test_sort_and_group_by_code_handle_quoted_names(self):
        name = 'a"b'
        lf = pl.LazyFrame({name: [2, 1, 2], "v": [1, 2, 3]})
        sort_scope = _run_code(SortOperation([SortColumn(name)]).to_code("src", "out"), src=lf)
        assert sort_scope["out"].collect()["v"].to_list() == [2, 1, 3]
        op = SummarizeOperation([name], [AggregationExpr("v", "Sum", "total")])
        scope = _run_code(op.to_code("src", "out"), src=lf)
        assert scope["out"].collect()["total"].to_list() == [4, 2]
