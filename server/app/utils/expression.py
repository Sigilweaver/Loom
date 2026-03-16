"""Expression parsing utilities for Polars expressions.

Shared logic for parsing and normalizing Polars expression strings.
Used by Filter, Formula, and other expression-based tools.
"""

import ast
from typing import Any

import polars as pl

from app.utils.errors import ToolError

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
        # Attribute access (validated separately — no dunders)
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
        # f-strings (used in some Polars expressions)
        ast.JoinedStr,
        ast.FormattedValue,
        # Load context
        ast.Load,
    }
)


def _validate_expression_ast(expression: str) -> None:
    """Validate that a Polars expression contains only safe AST nodes.

    Rejects dunder attribute access (__class__, __subclasses__, etc.),
    import statements, and any AST node not in the allowlist.

    Raises:
        ToolError: If the expression contains disallowed constructs.
    """
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as e:
        raise ToolError(f"Expression syntax error: {e}") from e

    for node in ast.walk(tree):
        node_type = type(node)

        if node_type not in _ALLOWED_AST_NODES:
            raise ToolError(f"Disallowed construct in expression: {node_type.__name__}")

        # Block dunder attribute access (e.g. __class__, __subclasses__)
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise ToolError(f"Dunder attribute access is not allowed: {node.attr}")

        # Block dunder name access (e.g. __import__, __builtins__)
        if isinstance(node, ast.Name) and node.id.startswith("__"):
            raise ToolError(f"Dunder name access is not allowed: {node.id}")

        # Only allow 'pl' as a top-level name reference
        if isinstance(node, ast.Name) and node.id not in (
            "pl",
            "True",
            "False",
            "None",
        ):
            raise ToolError(f"Only 'pl' namespace is allowed, got: {node.id}")


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

    Uses eval with a restricted namespace containing only the Polars module.
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

    # Validate AST before eval — blocks sandbox escape via dunder access,
    # imports, and any construct outside the allowlist
    _validate_expression_ast(expression)

    # Restricted namespace - only Polars available
    namespace: dict[str, Any] = {
        "pl": pl,
    }

    try:
        result = eval(expression, {"__builtins__": {}}, namespace)

        if not isinstance(result, pl.Expr):
            raise ToolError(f"Expression must evaluate to pl.Expr, got {type(result).__name__}")

        return result

    except ToolError:
        raise
    except Exception as e:
        raise ToolError(f"Failed to parse expression: {str(e)}") from e
