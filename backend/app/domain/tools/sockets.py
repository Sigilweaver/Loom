"""Socket ID constants for tool implementations.

These MUST match the frontend socketIds.ts exactly.
Any changes here require corresponding frontend changes.
"""


class CommonSockets:
    """Sockets used by most tools."""

    INPUT = "input"
    OUTPUT = "output"


class FilterSockets:
    """Filter tool socket IDs."""

    INPUT = "input"
    OUTPUT_TRUE = "output-true"
    OUTPUT_FALSE = "output-false"


class JoinSockets:
    """Join tool socket IDs."""

    INPUT_LEFT = "input-left"
    INPUT_RIGHT = "input-right"
    OUTPUT_LEFT = "output-left"
    OUTPUT_MATCH = "output-match"
    OUTPUT_RIGHT = "output-right"


class UnionSockets:
    """Union tool socket IDs."""

    INPUT = "input"  # multiple=True
    OUTPUT = "output"


class UniqueSockets:
    """Unique tool socket IDs."""

    INPUT = "input"
    OUTPUT_UNIQUE = "output-unique"
    OUTPUT_DUPLICATE = "output-duplicate"
