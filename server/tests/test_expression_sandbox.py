"""Adversarial tests for the Polars expression sandbox (#74).

User-supplied Filter/Formula expressions are evaluated server-side, so they must
not be able to read or write files, reach the network, load native code, touch
Python internals or exhaust memory.
"""

import polars as pl
import pytest

from app.utils import expression as expression_module
from app.utils.errors import ToolError
from app.utils.expression import PL_ALLOWED_NAMES, is_denied_method_name, parse_polars_expression
from app.utils.polars_introspection import get_polars_functions


class TestIOEntryPointsBlocked:
    @pytest.mark.parametrize(
        "expression",
        [
            "pl.read_csv('/etc/passwd')",
            "pl.read_parquet('/tmp/x.parquet')",
            "pl.read_json('/tmp/x.json')",
            "pl.read_ndjson('/tmp/x.ndjson')",
            "pl.read_ipc('/tmp/x.arrow')",
            "pl.read_excel('/tmp/x.xlsx')",
            "pl.read_database('select 1', 'sqlite:///tmp/x.db')",
            "pl.scan_csv('/etc/passwd')",
            "pl.scan_parquet('/tmp/x.parquet')",
            "pl.scan_ndjson('/tmp/x.ndjson')",
            "pl.scan_ipc('/tmp/x.arrow')",
            "pl.read_csv('/etc/passwd').lazy()",
            "pl.scan_csv('/etc/passwd').collect()",
            "pl.col('a').is_in(pl.read_csv('/etc/passwd').get_column('a'))",
            "pl.DataFrame({'a': [1]}).write_csv('/tmp/pwned.csv')",
            "pl.LazyFrame({'a': [1]}).sink_csv('/tmp/pwned.csv')",
            "pl.Series('a', [1]).to_frame()",
            "pl.sql_expr('1')",
            "pl.SQLContext()",
            "pl.Config.set_tbl_rows(1)",
            "pl.Expr.deserialize('/tmp/expr.json')",
            "pl.col('a').deserialize('/tmp/expr.json')",
            "pl.col('a').from_json('{}')",
            "pl.col('a').meta.serialize('/tmp/expr.json')",
            "pl.col('a').meta.write_json('/tmp/expr.json')",
            "pl.col('a').register_plugin(lib='/tmp/evil.so', symbol='f')",
            "pl.col('a').write_json('/tmp/expr.json')",
        ],
    )
    def test_blocks_io_entry_points(self, expression):
        with pytest.raises(ToolError):
            parse_polars_expression(expression)

    def test_error_names_the_blocked_function(self):
        with pytest.raises(ToolError, match=r"pl\.read_csv is not allowed.*pl\.col"):
            parse_polars_expression("pl.read_csv('/etc/passwd')")

    def test_pl_lookup_is_reported_before_chained_methods(self):
        with pytest.raises(ToolError, match=r"pl\.read_csv"):
            parse_polars_expression("pl.read_csv('/etc/passwd').lazy()")

    def test_eval_namespace_is_a_restricted_view(self):
        """A validator bug still could not reach pl.read_csv: it is not in the namespace."""
        for name in ("read_csv", "scan_csv", "scan_parquet", "DataFrame", "LazyFrame", "Config"):
            assert not hasattr(expression_module._PL_NAMESPACE, name)

    def test_every_allowed_pl_name_is_expression_or_dtype_only(self):
        for name in PL_ALLOWED_NAMES:
            assert not name.startswith(("read_", "scan_", "write_", "sink_"))


class TestIntrospectionTricksBlocked:
    @pytest.mark.parametrize(
        "expression",
        [
            "getattr(pl, 'read_csv')('/etc/passwd')",
            "pl.__dict__['read_csv']('/etc/passwd')",
            "pl.__getattribute__('read_csv')",
            "vars(pl)",
            "dir(pl)",
            "eval('1')",
            "exec('1')",
            "open('/etc/passwd')",
            "compile('1', 'x', 'eval')",
            "type(pl)",
            "globals()",
            "pl.col('a').__class__.__mro__",
            "pl.col('a').str.contains.__globals__",
            "pl.col('a').str.contains.__self__",
            "pl.lit(1).__reduce__()",
            "().__class__.__base__.__subclasses__()",
            "pl.col('a').gi_frame",
            "pl.col('a').f_globals",
            "pl.Int64.__subclasses__()",
        ],
    )
    def test_blocks_introspection(self, expression):
        with pytest.raises(ToolError):
            parse_polars_expression(expression)

    @pytest.mark.parametrize(
        "expression",
        [
            "pl",
            "pl.lit(pl)",
            "pl.col('a').alias(pl)",
            "(pl if True else 0)",
            "[pl][0].read_csv('/etc/passwd')",
            "{'k': pl}['k'].read_csv('/etc/passwd')",
        ],
    )
    def test_bare_pl_reference_rejected(self, expression):
        with pytest.raises(ToolError, match="must be used as pl"):
            parse_polars_expression(expression)

    @pytest.mark.parametrize(
        "expression",
        [
            "'{0.__class__}'.format(pl.col('a'))",
            "'{}'.format(1)",
            "'abc'.replace('a', 'b')",
            "'a,b'.split(',')",
            "('a' if True else 'b').upper()",
            "[1, 2].append(3)",
            "{'a': 1}.get('a')",
            "(1).bit_length()",
        ],
    )
    def test_methods_of_python_values_rejected(self, expression):
        """str.format and friends are not part of the expression language."""
        with pytest.raises(ToolError):
            parse_polars_expression(expression)

    def test_runtime_guard_blocks_python_receivers(self):
        """Defence in depth: even a skipped static check cannot reach Python values."""
        with pytest.raises(ToolError):
            expression_module._sandbox_getattr("abc", "upper")
        with pytest.raises(ToolError):
            expression_module._sandbox_getattr({}, "get")


class TestCallablesBlocked:
    @pytest.mark.parametrize(
        "expression",
        [
            "pl.col('a').pipe(pl.col)",
            "pl.col('a').map_elements(pl.col)",
            "pl.col('a').map_batches(pl.col)",
            "pl.col('a').rolling_map(pl.col, 2)",
            "pl.col('a').name.map(pl.col)",
            "pl.map_batches(['a'], pl.col)",
            "pl.fold(pl.lit(0), pl.col, pl.all())",
            "pl.reduce(pl.col, pl.all())",
            "pl.col('a').inspect()",
            "(lambda: pl.col('a'))()",
        ],
    )
    def test_callable_taking_methods_rejected(self, expression):
        with pytest.raises(ToolError):
            parse_polars_expression(expression)


class TestResourceExhaustion:
    @pytest.mark.parametrize(
        "expression",
        [
            "pl.lit('a' * 10**10)",
            "pl.lit([0] * 10**10)",
            "pl.lit(10**10 * 'a')",
            "pl.lit(9**9**9**9)",
            "pl.lit(2 ** 100000000)",
            "pl.lit((9**999)**999)",
            "pl.lit('%1000000000d' % 1)",
            "pl.lit('%1000000000s' % pl.col('a'))",
            "pl.lit(f'{1:>1000000000}')",
            "pl.lit(f'{\"a\":>{10**9}}')",
        ],
    )
    def test_huge_literals_rejected(self, expression):
        with pytest.raises(ToolError):
            parse_polars_expression(expression)

    def test_string_formatting_operator_message(self):
        with pytest.raises(ToolError, match="not allowed"):
            parse_polars_expression("pl.lit('%s' % 'x')")

    def test_overlong_expression_rejected(self):
        with pytest.raises(ToolError, match="too long"):
            parse_polars_expression("pl.col('a')" + " + 1" * 50_000)

    def test_deeply_nested_expression_does_not_crash(self):
        with pytest.raises(ToolError):
            parse_polars_expression("(" * 5000 + "pl.col('a')" + ")" * 5000)

    def test_null_byte_rejected(self):
        with pytest.raises(ToolError):
            parse_polars_expression("pl.col('a')\x00")


class TestLegitimateExpressionsStillWork:
    """Expressions produced by the builders, the AI assistant and users must parse."""

    @pytest.mark.parametrize(
        "expression",
        [
            'pl.col("my col") + 0',
            'pl.col("a") * pl.col("b")',
            'pl.col("a") ** 2',
            'pl.col("a") % 2',
            'pl.col("a").pow(2).round(2)',
            'pl.col("a") / pl.col("a").sum()',
            '-pl.col("a")',
            '~pl.col("a").is_null()',
            '(pl.col("a") > 1).alias("flag")',
            '(pl.col("a") + pl.col("b")).round(2)',
            'pl.col("a").cast(pl.Float64)',
            'pl.col("a").cast(pl.Datetime("us", "UTC"))',
            'pl.col("a").cast(pl.List(pl.Int64))',
            'pl.col("a").str.to_uppercase()',
            'pl.col("a").str.replace_all("x", "y")',
            'pl.col("a").str.split(" ").list.first()',
            'pl.col("a").str.to_datetime("%Y-%m-%d").dt.year()',
            'pl.col("a").dt.strftime("%Y-%m")',
            'pl.col("a").dt.truncate("1d")',
            'pl.col("a").fill_null(0)',
            'pl.col("a").rank(method="ordinal")',
            'pl.col("a").cum_sum().over("g")',
            'pl.col("a").is_in([1, 2, 3])',
            'pl.col("a").is_between(1, 10)',
            'pl.col("a").clip(1, 10)',
            'pl.col("a").shift(1)',
            'pl.col("a").rolling_mean(window_size=3)',
            'pl.col("a").name.suffix("_x")',
            'pl.col("a").list.eval(pl.element().str.strip_chars())',
            'pl.col("a").struct.field("x")',
            'pl.col("a").sort_by("b").get(0)',
            'pl.lit("x") + pl.col("a")',
            "pl.lit(1) * 3",
            "pl.lit(2 ** 8)",
            "pl.lit(10 % 3)",
            "pl.lit(1_000_000 * 60)",
            'pl.lit(f"a{1}b")',
            'pl.when(pl.col("a") > 0).then(pl.lit(1)).otherwise(pl.lit(0))',
            'pl.when(pl.col("a") > 0).then(1).when(pl.col("a") < 0).then(-1).otherwise(0)',
            'pl.coalesce(pl.col("a"), pl.col("b"), pl.lit(0))',
            'pl.concat_str([pl.col("a"), pl.col("b")], separator="-")',
            'pl.concat_list("a", "b")',
            'pl.format("{}-{}", pl.col("a"), pl.col("b"))',
            "pl.int_range(pl.len())",
            "pl.len()",
            "pl.all().exclude('a')",
            'pl.sum_horizontal("a", "b")',
            'pl.max_horizontal(pl.col("a"), pl.col("b"))',
            "pl.date(2024, 1, 1)",
            "pl.datetime(2024, 1, 1) + pl.duration(days=1)",
            'pl.struct(["a", "b"])',
        ],
    )
    def test_legitimate_expressions_parse(self, expression):
        assert isinstance(parse_polars_expression(expression), pl.Expr)

    def test_expressions_evaluate_correctly(self):
        df = pl.DataFrame({"a": [1, 2, 3], "s": ["x", "y", "z"]})
        expr = parse_polars_expression('(pl.col("a") ** 2 + 1).alias("r")')
        assert df.select(expr)["r"].to_list() == [2, 5, 10]
        expr = parse_polars_expression('pl.col("s").str.to_uppercase().alias("u")')
        assert df.select(expr)["u"].to_list() == ["X", "Y", "Z"]

    def test_autocomplete_only_offers_what_the_sandbox_accepts(self):
        functions = get_polars_functions()
        assert functions["table_level"]
        for fn in functions["table_level"]:
            assert fn["name"].removeprefix("pl.") in PL_ALLOWED_NAMES
        for group in functions["column_methods"].values():
            for fn in group:
                assert not is_denied_method_name(fn["name"].split(".")[-1])
