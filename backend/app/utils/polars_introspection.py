"""
Dynamic Polars introspection for autocomplete.

This module introspects the installed Polars library at runtime to extract
function signatures, docstrings, and parameter information. This approach:

1. Automatically supports new Polars versions without code changes
2. Provides accurate, up-to-date documentation
3. Enables rich autocomplete with parameter hints

The extracted metadata is cached for performance.
"""

import inspect
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import polars as pl


@dataclass
class MethodInfo:
    """Metadata about a Polars method for autocomplete."""
    name: str
    signature: str
    description: str
    snippet: str
    category: str
    parameters: list[dict[str, Any]] = field(default_factory=list)
    return_type: str = "Expr"
    examples: list[str] = field(default_factory=list)


def _extract_description(docstring: str | None) -> str:
    """Extract the first paragraph (description) from a docstring."""
    if not docstring:
        return ""

    # Split by double newline to get paragraphs
    lines = docstring.strip().split('\n')
    description_lines = []

    for line in lines:
        stripped = line.strip()
        # Stop at Parameters, Returns, Examples, etc.
        if stripped in ('Parameters', 'Returns', 'Examples', 'Notes', 'See Also', 'Warnings'):
            break
        if stripped.startswith('---'):
            break
        if stripped:
            description_lines.append(stripped)
        elif description_lines:
            # Empty line after content = end of first paragraph
            break

    return ' '.join(description_lines)


def _extract_parameters(docstring: str | None, sig: inspect.Signature) -> list[dict[str, Any]]:
    """Extract parameter info from docstring and signature."""
    params = []

    for param_name, param in sig.parameters.items():
        if param_name == 'self':
            continue

        param_info: dict[str, Any] = {
            'name': param_name,
            'required': param.default is inspect.Parameter.empty,
        }

        # Get type hint if available
        if param.annotation is not inspect.Parameter.empty:
            annotation = str(param.annotation)
            # Clean up the annotation string
            annotation = annotation.replace("'", "")
            param_info['type'] = annotation

        # Get default value if available
        if param.default is not inspect.Parameter.empty:
            param_info['default'] = repr(param.default)

        params.append(param_info)

    # Try to extract descriptions from docstring
    if docstring:
        param_section = re.search(
            r'Parameters\s*\n-+\s*\n(.*?)(?=\n\s*(?:Returns|Examples|Notes|See Also|$))',
            docstring,
            re.DOTALL
        )
        if param_section:
            param_text = param_section.group(1)
            # Parse parameter descriptions
            current_param = None
            current_desc_lines = []

            for line in param_text.split('\n'):
                # Check if this is a new parameter (non-indented, non-empty)
                stripped = line.strip()
                if not line.startswith(' ') and stripped and not stripped.startswith('-'):
                    # Save previous param description
                    if current_param:
                        for p in params:
                            if p['name'] == current_param:
                                p['description'] = ' '.join(current_desc_lines).strip()
                                break
                    current_param = stripped
                    current_desc_lines = []
                elif current_param and stripped:
                    current_desc_lines.append(stripped)

            # Save last param
            if current_param:
                for p in params:
                    if p['name'] == current_param:
                        p['description'] = ' '.join(current_desc_lines).strip()
                        break

    return params


def _generate_snippet(name: str, sig: inspect.Signature, prefix: str = ".") -> str:
    """Generate a Monaco snippet with tab stops for parameters."""
    snippet_parts = [f"{prefix}{name}("]
    tab_index = 1
    param_snippets = []

    for param_name, param in sig.parameters.items():
        if param_name == 'self':
            continue

        # Skip keyword-only params that have defaults (optional)
        if param.kind == inspect.Parameter.KEYWORD_ONLY and param.default is not inspect.Parameter.empty:
            continue

        # Determine placeholder value
        if param.default is not inspect.Parameter.empty:
            # Has default - skip for snippet (user can add if needed)
            continue

        # Get type hint for smarter placeholder
        placeholder = param_name
        if param.annotation is not inspect.Parameter.empty:
            annotation = str(param.annotation).replace("'", "")
            annotation_lower = annotation.lower()

            # IntoExpr typically means a string (column name) or expression
            # For user convenience, default to string input with quotes
            if 'intoexpr' in annotation_lower or 'intoexprcolumn' in annotation_lower:
                placeholder = f"'${{{tab_index}:{param_name}}}'"
            elif 'str' in annotation_lower and 'struct' not in annotation_lower:
                placeholder = f"'${{{tab_index}:{param_name}}}'"
            elif annotation_lower in ('int', 'int64', 'int32'):
                placeholder = f"${{{tab_index}:0}}"
            elif 'int' in annotation_lower and 'print' not in annotation_lower:
                placeholder = f"${{{tab_index}:0}}"
            elif 'float' in annotation_lower:
                placeholder = f"${{{tab_index}:0.0}}"
            elif 'bool' in annotation_lower:
                placeholder = f"${{{tab_index}:True}}"
            else:
                placeholder = f"${{{tab_index}:{param_name}}}"
        else:
            placeholder = f"${{{tab_index}:{param_name}}}"

        param_snippets.append(placeholder)
        tab_index += 1

    snippet_parts.append(', '.join(param_snippets))
    snippet_parts.append(')')

    return ''.join(snippet_parts)


def _categorize_string_method(name: str) -> str:
    """Categorize string methods for grouping in UI."""
    search_methods = {'contains', 'contains_any', 'count_matches', 'ends_with', 'starts_with', 'find', 'find_many'}
    manipulation_methods = {'to_uppercase', 'to_lowercase', 'to_titlecase', 'reverse', 'slice', 'head', 'tail', 'pad_start', 'pad_end', 'zfill', 'normalize'}
    replace_methods = {'replace', 'replace_all', 'replace_many', 'strip_chars', 'strip_chars_start', 'strip_chars_end', 'strip_prefix', 'strip_suffix'}
    split_methods = {'split', 'split_exact', 'splitn', 'explode'}
    extract_methods = {'extract', 'extract_all', 'extract_groups', 'extract_many'}
    conversion_methods = {'to_date', 'to_datetime', 'to_time', 'to_decimal', 'to_integer', 'strptime', 'json_decode', 'json_path_match'}
    encoding_methods = {'encode', 'decode', 'escape_regex'}
    length_methods = {'len_bytes', 'len_chars'}
    join_methods = {'concat', 'join'}

    if name in search_methods:
        return 'string_search'
    elif name in manipulation_methods:
        return 'string_manipulation'
    elif name in replace_methods:
        return 'string_replace'
    elif name in split_methods:
        return 'string_split'
    elif name in extract_methods:
        return 'string_extract'
    elif name in conversion_methods:
        return 'string_conversion'
    elif name in encoding_methods:
        return 'string_encoding'
    elif name in length_methods:
        return 'string_length'
    elif name in join_methods:
        return 'string_join'
    else:
        return 'string_other'


def _categorize_datetime_method(name: str) -> str:
    """Categorize datetime methods for grouping in UI."""
    component_methods = {'year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond', 'microsecond', 'nanosecond'}
    week_methods = {'week', 'weekday', 'iso_year', 'ordinal_day'}
    offset_methods = {'offset_by', 'truncate', 'round', 'month_start', 'month_end', 'base_utc_offset', 'dst_offset'}
    conversion_methods = {'timestamp', 'epoch', 'to_string', 'strftime', 'date', 'time', 'datetime'}
    timezone_methods = {'convert_time_zone', 'replace_time_zone', 'timezone'}

    if name in component_methods:
        return 'datetime_components'
    elif name in week_methods:
        return 'datetime_week'
    elif name in offset_methods:
        return 'datetime_offset'
    elif name in conversion_methods:
        return 'datetime_conversion'
    elif name in timezone_methods:
        return 'datetime_timezone'
    else:
        return 'datetime_other'


def _categorize_list_method(name: str) -> str:
    """Categorize list methods for grouping in UI."""
    aggregation_methods = {'sum', 'mean', 'min', 'max', 'first', 'last', 'std', 'var', 'median', 'len', 'n_unique', 'count_matches'}
    element_methods = {'get', 'first', 'last', 'head', 'tail', 'take', 'gather', 'gather_every', 'slice'}
    search_methods = {'contains', 'arg_min', 'arg_max'}
    transform_methods = {'reverse', 'sort', 'unique', 'shift', 'set_union', 'set_intersection', 'set_difference', 'set_symmetric_difference'}
    combine_methods = {'concat', 'join', 'explode', 'flatten'}
    filter_methods = {'filter', 'drop_nulls', 'sample', 'diff'}
    boolean_methods = {'all', 'any'}
    eval_methods = {'eval'}
    conversion_methods = {'to_array', 'to_struct'}

    if name in aggregation_methods:
        return 'list_aggregation'
    elif name in element_methods:
        return 'list_element'
    elif name in search_methods:
        return 'list_search'
    elif name in transform_methods:
        return 'list_transform'
    elif name in combine_methods:
        return 'list_combine'
    elif name in filter_methods:
        return 'list_filter'
    elif name in boolean_methods:
        return 'list_boolean'
    elif name in eval_methods:
        return 'list_eval'
    elif name in conversion_methods:
        return 'list_conversion'
    else:
        return 'list_other'


def _categorize_expr_method(name: str) -> str:
    """Categorize expression methods for grouping in UI."""
    null_methods = {'is_null', 'is_not_null', 'fill_null', 'drop_nulls', 'null_count'}
    type_methods = {'cast', 'dtype', 'strict_cast'}
    math_methods = {'abs', 'round', 'floor', 'ceil', 'sqrt', 'pow', 'log', 'log10', 'exp', 'sign'}
    comparison_methods = {'eq', 'ne', 'gt', 'lt', 'ge', 'le', 'eq_missing', 'ne_missing'}
    aggregation_methods = {'sum', 'mean', 'min', 'max', 'count', 'first', 'last', 'std', 'var', 'median', 'quantile', 'mode'}
    list_methods = {'implode', 'flatten', 'explode'}
    naming_methods = {'alias', 'name', 'prefix', 'suffix', 'keep_name'}
    window_methods = {'over', 'rolling', 'shift', 'diff', 'pct_change', 'cum_sum', 'cum_prod', 'cum_min', 'cum_max', 'cum_count'}
    conditional_methods = {'when', 'then', 'otherwise', 'if_else'}

    if name in null_methods:
        return 'null_handling'
    elif name in type_methods:
        return 'type_conversion'
    elif name in math_methods:
        return 'math'
    elif name in comparison_methods:
        return 'comparison'
    elif name in aggregation_methods:
        return 'aggregation'
    elif name in list_methods:
        return 'list_operations'
    elif name in naming_methods:
        return 'naming'
    elif name in window_methods:
        return 'window'
    elif name in conditional_methods:
        return 'conditional'
    else:
        return 'other'


def _introspect_namespace(namespace: Any, prefix: str, categorize_fn) -> list[MethodInfo]:
    """Introspect all methods in a Polars namespace (str, dt, etc.)."""
    methods = []

    for method_name in dir(namespace):
        if method_name.startswith('_'):
            continue

        try:
            method = getattr(namespace, method_name)
            if not callable(method):
                continue

            # Get signature
            try:
                sig = inspect.signature(method)
                sig_str = f"{prefix}.{method_name}{sig}"
            except (ValueError, TypeError):
                sig_str = f"{prefix}.{method_name}(...)"
                sig = None

            # Get docstring
            docstring = method.__doc__
            description = _extract_description(docstring)

            # Generate snippet
            if sig:
                snippet = _generate_snippet(method_name, sig, prefix=f"{prefix}.")
                parameters = _extract_parameters(docstring, sig)
            else:
                snippet = f"{prefix}.{method_name}()"
                parameters = []

            # Categorize
            category = categorize_fn(method_name)

            methods.append(MethodInfo(
                name=f"{prefix}.{method_name}",
                signature=sig_str,
                description=description or f"{method_name} operation",
                snippet=snippet,
                category=category,
                parameters=parameters,
            ))

        except Exception:
            # Skip methods that can't be introspected
            continue

    return methods


def _introspect_expr_methods() -> list[MethodInfo]:
    """Introspect methods available on pl.Expr (column methods)."""
    methods = []
    expr = pl.col('test')

    # Methods to skip (internal, deprecated, or not useful for autocomplete)
    skip_methods = {
        'map', 'map_batches', 'map_elements',  # Advanced, require Python functions
        'struct', 'list', 'cat', 'bin', 'arr',  # Namespace accessors (handled separately)
        'str', 'dt',  # Namespace accessors
        'meta', 'name',  # Namespace accessors
    }

    for method_name in dir(expr):
        if method_name.startswith('_'):
            continue
        if method_name in skip_methods:
            continue

        try:
            method = getattr(expr, method_name)
            if not callable(method):
                continue

            # Get signature
            try:
                sig = inspect.signature(method)
                sig_str = f".{method_name}{sig}"
            except (ValueError, TypeError):
                sig_str = f".{method_name}(...)"
                sig = None

            # Get docstring
            docstring = method.__doc__
            description = _extract_description(docstring)

            # Generate snippet
            if sig:
                snippet = _generate_snippet(method_name, sig)
                parameters = _extract_parameters(docstring, sig)
            else:
                snippet = f".{method_name}()"
                parameters = []

            category = _categorize_expr_method(method_name)

            methods.append(MethodInfo(
                name=f".{method_name}",
                signature=sig_str,
                description=description or f"{method_name} operation",
                snippet=snippet,
                category=category,
                parameters=parameters,
            ))

        except Exception:
            continue

    return methods


def _introspect_table_level() -> list[MethodInfo]:
    """Introspect table-level Polars functions (pl.col, pl.lit, etc.)."""
    methods = []

    # Key table-level functions for expressions
    functions = {
        'col': ('selection', 'Reference a column by name'),
        'lit': ('literals', 'Create a literal value'),
        'when': ('conditional', 'Start a when-then-otherwise expression'),
        'concat': ('combining', 'Concatenate DataFrames or expressions'),
        'all': ('selection', 'Select all columns'),
        'exclude': ('selection', 'Select all columns except specified'),
        'first': ('selection', 'Get the first column'),
        'last': ('selection', 'Get the last column'),
        'sum': ('aggregation', 'Horizontal sum'),
        'mean': ('aggregation', 'Horizontal mean'),
        'min': ('aggregation', 'Horizontal minimum'),
        'max': ('aggregation', 'Horizontal maximum'),
        'count': ('aggregation', 'Count rows'),
        'struct': ('struct', 'Create a struct from columns'),
        'duration': ('datetime', 'Create a duration'),
        'date': ('datetime', 'Create a date'),
        'datetime': ('datetime', 'Create a datetime'),
        'time': ('datetime', 'Create a time'),
        'coalesce': ('null_handling', 'Return first non-null value'),
        'element': ('selection', 'Access a list element'),
        'format': ('string', 'Format string with placeholders'),
        'concat_str': ('string', 'Concatenate strings'),
        'repeat': ('generation', 'Repeat a value n times'),
        'int_range': ('generation', 'Generate integer range'),
        'int_ranges': ('generation', 'Generate multiple integer ranges'),
        'arange': ('generation', 'Alias for int_range'),
    }

    for func_name, (category, fallback_desc) in functions.items():
        try:
            func = getattr(pl, func_name, None)
            if func is None:
                continue

            # Get signature
            try:
                sig = inspect.signature(func)
                sig_str = f"pl.{func_name}{sig}"
            except (ValueError, TypeError):
                sig_str = f"pl.{func_name}(...)"
                sig = None

            # Get docstring
            docstring = func.__doc__
            description = _extract_description(docstring) or fallback_desc

            # Generate snippet
            if sig:
                snippet = _generate_snippet(func_name, sig, prefix="pl.")
                parameters = _extract_parameters(docstring, sig)
            else:
                snippet = f"pl.{func_name}()"
                parameters = []

            methods.append(MethodInfo(
                name=f"pl.{func_name}",
                signature=sig_str,
                description=description,
                snippet=snippet,
                category=category,
                parameters=parameters,
            ))

        except Exception:
            continue

    return methods


@lru_cache(maxsize=1)
def get_polars_functions() -> dict[str, Any]:
    """
    Get all Polars functions for autocomplete, dynamically introspected.
    
    This function is cached - call it once on startup.
    
    Returns:
        Dictionary with 'table_level' and 'column_methods' (by type).
    """
    expr = pl.col('test')

    # Introspect string namespace
    string_methods = _introspect_namespace(
        expr.str,
        ".str",
        _categorize_string_method
    )

    # Introspect datetime namespace
    datetime_methods = _introspect_namespace(
        expr.dt,
        ".dt",
        _categorize_datetime_method
    )

    # Introspect list namespace
    list_methods = _introspect_namespace(
        expr.list,
        ".list",
        _categorize_list_method
    )

    # Introspect expression methods (all columns)
    expr_methods = _introspect_expr_methods()

    # Introspect table-level functions
    table_level = _introspect_table_level()

    # Convert to dict format expected by frontend
    def to_dict(method: MethodInfo) -> dict[str, Any]:
        return {
            "name": method.name,
            "signature": method.signature,
            "description": method.description,
            "snippet": method.snippet,
            "category": method.category,
            "parameters": method.parameters,
        }

    return {
        "table_level": [to_dict(m) for m in table_level],
        "column_methods": {
            "all": [to_dict(m) for m in expr_methods],
            "string": [to_dict(m) for m in string_methods],
            "numeric": [to_dict(m) for m in expr_methods if m.category == 'math'],
            "datetime": [to_dict(m) for m in datetime_methods],
            "list": [to_dict(m) for m in list_methods],
        },
        "polars_version": pl.__version__,
    }


def clear_cache() -> None:
    """Clear the cached functions (useful for testing or reload)."""
    get_polars_functions.cache_clear()
