"""Expression parsing utilities for Polars expressions.

Shared logic for parsing and normalizing Polars expression strings.
Used by Filter, Formula, and other expression-based tools.
"""

import ast
import types
from typing import Any

import polars as pl

from app.utils.errors import ToolError

# Longest expression accepted, in characters. Generous for long ``is_in`` lists
# but keeps parser/compiler work bounded.
MAX_EXPRESSION_LENGTH = 100_000

# AST node types allowed in Polars expressions.
# This allowlist prevents sandbox escape via dunder attribute access,
# imports, exec/eval, and other dangerous constructs while permitting
# legitimate Polars expression chains.
_ALLOWED_AST_NODES = frozenset(
    {
        # Literals and basic structures
        ast.Expression,
        ast.Constant,
        ast.Name,
        ast.List,
        ast.Tuple,
        ast.Dict,
        ast.Set,
        # Attribute access (names validated separately against allowlists)
        ast.Attribute,
        # Calls (e.g. pl.col("x"), .str.contains("y"))
        ast.Call,
        # Operators
        ast.UnaryOp,
        ast.BinOp,
        ast.BoolOp,
        ast.Compare,
        # Operator tokens
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.FloorDiv,
        ast.Mod,
        ast.Pow,
        ast.BitOr,
        ast.BitAnd,
        ast.BitXor,
        ast.Invert,
        ast.Not,
        ast.UAdd,
        ast.USub,
        ast.And,
        ast.Or,
        # Comparisons
        ast.Eq,
        ast.NotEq,
        ast.Lt,
        ast.LtE,
        ast.Gt,
        ast.GtE,
        ast.Is,
        ast.IsNot,
        ast.In,
        ast.NotIn,
        # Subscript (e.g. indexing)
        ast.Subscript,
        ast.Slice,
        # Starred (e.g. *args in function calls)
        ast.Starred,
        # Keyword arguments
        ast.keyword,
        # Ternary / conditional expression
        ast.IfExp,
        # f-strings (used in some Polars expressions); format specs are rejected
        ast.JoinedStr,
        ast.FormattedValue,
        # Load context
        ast.Load,
    }
)

# Names reachable as ``pl.<name>``. This is an allowlist: every function here
# builds an expression (or is a dtype) and none touches the filesystem, the
# network, or a Python callable. I/O entry points (read_*, scan_*, sink_*,
# DataFrame/LazyFrame/Series constructors, SQL, Config, plugins) are absent by
# design. Keep in sync with the table-level functions offered to the editor
# autocomplete (see polars_introspection).
PL_ALLOWED_NAMES = frozenset(
    {
        # Selection and literals
        "col",
        "lit",
        "all",
        "any",
        "exclude",
        "element",
        "field",
        "first",
        "last",
        "nth",
        "head",
        "tail",
        "len",
        "count",
        # Conditionals and null handling
        "when",
        "coalesce",
        # Aggregations and statistics
        "sum",
        "mean",
        "median",
        "min",
        "max",
        "std",
        "var",
        "quantile",
        "corr",
        "cov",
        "n_unique",
        "approx_n_unique",
        "rolling_corr",
        "rolling_cov",
        "cum_sum",
        "cum_count",
        # Horizontal aggregations
        "all_horizontal",
        "any_horizontal",
        "sum_horizontal",
        "min_horizontal",
        "max_horizontal",
        "mean_horizontal",
        "cum_sum_horizontal",
        # Sorting and filtering helpers
        "arg_sort_by",
        "arg_where",
        # Combining and shaping
        "concat",
        "concat_str",
        "concat_list",
        "concat_arr",
        "struct",
        "format",
        "implode",
        "repeat",
        "ones",
        "zeros",
        # Ranges and generation
        "arange",
        "int_range",
        "int_ranges",
        "linear_space",
        "linear_spaces",
        "date_range",
        "date_ranges",
        "datetime_range",
        "datetime_ranges",
        "time_range",
        "time_ranges",
        # Temporal constructors
        "date",
        "datetime",
        "time",
        "duration",
        "from_epoch",
        "business_day_count",
        # Math
        "arctan2",
        "arctan2d",
        # Data types
        "Array",
        "Binary",
        "Boolean",
        "Categorical",
        "Date",
        "Datetime",
        "Decimal",
        "Duration",
        "Enum",
        "Field",
        "Float32",
        "Float64",
        "Int8",
        "Int16",
        "Int32",
        "Int64",
        "Int128",
        "List",
        "Null",
        "String",
        "Struct",
        "Time",
        "UInt8",
        "UInt16",
        "UInt32",
        "UInt64",
        "UInt128",
        "Utf8",
    }
)

# Expression methods that must never be callable from user expressions even
# though they exist on Expr: they read or write files, load native code,
# print, or take Python callables (which user expressions cannot construct
# anyway, but denying them keeps the surface honest).
_DENIED_METHOD_NAMES = frozenset(
    {
        "deserialize",
        "from_json",
        "register_plugin",
        "inspect",
        "meta",
        "pipe",
        "rolling_map",
        "format_map",
    }
)
# Any method whose name starts with one of these is I/O or takes a callable.
_DENIED_METHOD_PREFIXES = ("read_", "scan_", "write_", "sink_", "from_", "map")

# Namespaces on Expr whose public members are valid in expressions.
_EXPR_NAMESPACES = ("str", "dt", "list", "arr", "struct", "name", "cat", "bin", "ext")


def is_denied_method_name(name: str) -> bool:
    """Whether an Expr method/namespace name is blocked in user expressions."""
    return name in _DENIED_METHOD_NAMES or name.startswith(_DENIED_METHOD_PREFIXES)


def _collect_method_names() -> frozenset[str]:
    """Public Expr and Expr-namespace member names, minus the denied ones."""
    probe = pl.col("x")
    names = {n for n in dir(probe) if not n.startswith("_")}
    for ns in _EXPR_NAMESPACES:
        namespace = getattr(probe, ns, None)
        if namespace is not None:
            names.update(n for n in dir(namespace) if not n.startswith("_"))
    # pl.when(...).then(...).when(...).then(...).otherwise(...) builder objects
    condition = pl.lit(True)
    for builder in (
        pl.when(condition),
        pl.when(condition).then(1),
        pl.when(condition).then(1).when(condition),
    ):
        names.update(n for n in dir(builder) if not n.startswith("_"))
    return frozenset(n for n in names if not is_denied_method_name(n))


# Member names usable after the first dot in a chain (``pl.col("a").str.head``).
_ALLOWED_METHOD_NAMES = _collect_method_names()

# What user expressions see as ``pl``. A restricted namespace, not the real
# module, so a validator bug still cannot reach pl.read_csv and friends.
_PL_NAMESPACE = types.SimpleNamespace(
    **{name: getattr(pl, name) for name in PL_ALLOWED_NAMES if hasattr(pl, name)}
)

# Bounds for Python-level arithmetic on literals (Expr arithmetic is unbounded
# because it is lazy). Stops "a" * 10**10, 9**9**9 and "%1000000000d" % 1.
_MAX_REPEAT_LENGTH = 1_000_000
_MAX_POW_BITS = 100_000


def _sandbox_getattr(obj: Any, name: str) -> Any:
    """Attribute access for user expressions: Polars objects only.

    Static validation already checked ``name``; this rejects receivers that are
    plain Python objects (str, list, dict...), whose methods are not part of the
    expression language.
    """
    if obj is not _PL_NAMESPACE:
        module = getattr(type(obj), "__module__", "")
        if not module.startswith("polars"):
            raise ToolError(
                f"Attribute access on a {type(obj).__name__} value is not allowed in "
                f"expressions: .{name}"
            )
    return getattr(obj, name)


_SEQUENCE_TYPES = (str, bytes, list, tuple)


def _sandbox_binop(op: str, left: Any, right: Any) -> Any:
    """Multiply, modulo and power with bounds on Python-level operands."""
    if op == "Pow":
        if isinstance(left, int) and isinstance(right, int):
            if abs(right) > 1000 or left.bit_length() * abs(right) > _MAX_POW_BITS:
                raise ToolError("Exponent is too large for a literal power in an expression.")
        return left**right
    if op == "Mod":
        if isinstance(left, (str, bytes)):
            raise ToolError("String formatting with % is not allowed in expressions.")
        return left % right
    # Mult
    for seq, count in ((left, right), (right, left)):
        if isinstance(seq, _SEQUENCE_TYPES) and isinstance(count, int):
            if len(seq) * abs(count) > _MAX_REPEAT_LENGTH:
                raise ToolError("Repeated literal is too large for an expression.")
    return left * right


class _SandboxTransformer(ast.NodeTransformer):
    """Route attribute access and risky arithmetic through runtime guards."""

    def visit_Attribute(self, node: ast.Attribute) -> ast.AST:
        self.generic_visit(node)
        call = ast.Call(
            func=ast.Name(id="_getattr", ctx=ast.Load()),
            args=[node.value, ast.Constant(value=node.attr)],
            keywords=[],
        )
        return ast.copy_location(call, node)

    def visit_BinOp(self, node: ast.BinOp) -> ast.AST:
        self.generic_visit(node)
        if not isinstance(node.op, (ast.Mult, ast.Mod, ast.Pow)):
            return node
        call = ast.Call(
            func=ast.Name(id="_binop", ctx=ast.Load()),
            args=[ast.Constant(value=type(node.op).__name__), node.left, node.right],
            keywords=[],
        )
        return ast.copy_location(call, node)


def _validate_expression_ast(expression: str) -> ast.Expression:
    """Validate that a Polars expression contains only safe constructs.

    Only ``pl.<allowlisted name>`` and Polars method chains are permitted.
    Rejects dunder access, imports, I/O entry points, callables and any AST
    node outside the allowlist.

    Returns:
        The parsed tree.

    Raises:
        ToolError: If the expression contains disallowed constructs.
    """
    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise ToolError(f"Expression is too long (limit is {MAX_EXPRESSION_LENGTH} characters).")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as e:
        raise ToolError(f"Expression syntax error: {e}") from e
    except (RecursionError, MemoryError, ValueError) as e:
        raise ToolError(f"Expression could not be parsed: {e}") from e

    # `pl` may only appear as the receiver of an attribute (pl.col), never bare.
    pl_receivers: set[int] = set()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id == "pl"
        ):
            pl_receivers.add(id(node.value))

    nodes = list(ast.walk(tree))
    for node in nodes:
        if type(node) not in _ALLOWED_AST_NODES:
            raise ToolError(f"Disallowed construct in expression: {type(node).__name__}")

    # Report root names, then pl.<name> lookups, before the methods chained on them.
    nodes.sort(
        key=lambda n: (
            0
            if isinstance(n, ast.Name)
            else 1
            if isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name)
            else 2
        )
    )
    for node in nodes:
        if isinstance(node, ast.Attribute):
            # Block dunder attribute access (e.g. __class__, __subclasses__)
            if node.attr.startswith("__"):
                raise ToolError(f"Dunder attribute access is not allowed: {node.attr}")
            if isinstance(node.value, ast.Name) and node.value.id == "pl":
                if node.attr not in PL_ALLOWED_NAMES:
                    raise ToolError(
                        f"pl.{node.attr} is not allowed in expressions. Expressions may build "
                        "columns and values (pl.col, pl.lit, pl.when, ...) but cannot read or "
                        "write files or reach the network."
                    )
            elif node.attr not in _ALLOWED_METHOD_NAMES:
                raise ToolError(f"Method or attribute is not allowed in expressions: {node.attr}")

        elif isinstance(node, ast.Name):
            # Block dunder name access (e.g. __import__, __builtins__)
            if node.id.startswith("__"):
                raise ToolError(f"Dunder name access is not allowed: {node.id}")
            if node.id != "pl":
                raise ToolError(f"Only 'pl' namespace is allowed, got: {node.id}")
            if id(node) not in pl_receivers:
                raise ToolError("'pl' must be used as pl.<function>, for example pl.col('x')")

        elif isinstance(node, ast.FormattedValue) and node.format_spec is not None:
            raise ToolError("Format specifiers in f-strings are not allowed in expressions")

    return tree


def normalize_expression(expression: str) -> str:
    """
    Normalize expression for consistent parsing.

    Wraps expression in parentheses to allow multi-line expressions
    that would otherwise be invalid Python syntax. The closing paren
    is on its own line to handle trailing comments.

    This enables multiline expressions with inline comments like::

        (pl.col('price') > 100)   # expensive items
        & (pl.col('qty') >= 3)    # in stock

    Which becomes valid Python when wrapped::

        ((pl.col('price') > 100)   # expensive items
        & (pl.col('qty') >= 3)    # in stock
        )

    Important:
        Each comparison must be wrapped in parentheses due to Python
        operator precedence. The ``&`` and ``|`` operators bind tighter
        than comparison operators (``>``, ``<``, ``==``, etc.), so::

            pl.col('a') > 10 & pl.col('b') < 20  # WRONG - parse error

        Is parsed by Python as ``pl.col('a') > (10 & pl.col('b')) < 20``,
        which fails. Always parenthesize comparisons::

            (pl.col('a') > 10) & (pl.col('b') < 20)  # CORRECT

    Args:
        expression: Raw expression string (may contain newlines)

    Returns:
        Expression wrapped in parentheses, or empty string if input is empty

    Example:
        >>> normalize_expression('''(pl.col("a") > 10)
        ... &
        ... (pl.col("b") < 20)''')
        '((pl.col("a") > 10)\n&\n(pl.col("b") < 20)\n)'
    """
    stripped = expression.strip()
    if not stripped:
        return ""
    return f"({stripped}\n)"


def parse_polars_expression(expression: str, normalize: bool = True) -> pl.Expr:
    """
    Parse a Polars expression string into a pl.Expr object.

    Validates the expression against an allowlist, then evaluates it with eval in a
    restricted namespace that exposes only expression-building Polars names.
    Optionally normalizes whitespace to support multi-line expressions.

    Args:
        expression: Polars expression string (e.g., "pl.col('age') > 18")
        normalize: Whether to normalize whitespace (default: True)

    Returns:
        Parsed Polars expression object

    Raises:
        ToolError: If expression is invalid or doesn't evaluate to pl.Expr

    Examples:
        >>> expr = parse_polars_expression("pl.col('age') > 18")
        >>> expr = parse_polars_expression("pl.col('name').str.contains('test')")
        >>> expr = parse_polars_expression('''
        ...     pl.col('a') > 10
        ...     &
        ...     pl.col('b') < 20
        ... ''')
    """
    if normalize:
        expression = normalize_expression(expression)

    # Validate the AST before eval - blocks sandbox escape via dunder access,
    # imports, I/O entry points and any construct outside the allowlists
    tree = _validate_expression_ast(expression)

    try:
        tree = ast.fix_missing_locations(_SandboxTransformer().visit(tree))
        code = compile(tree, "<expression>", "eval")

        # Restricted namespace: allowlisted Polars names plus the runtime guards
        namespace: dict[str, Any] = {
            "pl": _PL_NAMESPACE,
            "_getattr": _sandbox_getattr,
            "_binop": _sandbox_binop,
        }
        result = eval(code, {"__builtins__": {}}, namespace)

        if not isinstance(result, pl.Expr):
            raise ToolError(f"Expression must evaluate to pl.Expr, got {type(result).__name__}")

        return result

    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Failed to parse expression: {str(e)}") from e
