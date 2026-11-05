"""Server tool-config contract snapshot used by Studio's AI drift tests.

Studio's AI assistant writes tool configs from its own schema file
(``studio/src/data/toolConfigSchemas.ts``) and prompt examples. When those drift
from what the Server reads, the result is silently wrong output (for example a
Sort written with ``order`` instead of ``direction``). Studio cannot import
Python, so this module writes the Server side of the contract to a JSON
fixture that Studio's tests read, and fails when the checked-in fixture is
stale.

Regenerate after changing a tool config model or one of the value sets below:

    UPDATE_TOOL_CONTRACT=1 uv run pytest tests/test_ai_tool_contract.py
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import pytest

import app.domain.tools.implementations  # noqa: F401  (registers all tools)
from app.domain.datasources.factory import DataSourceFactory
from app.domain.tools.expr_builder import AGGREGATION_METHODS, PivotOperation
from app.domain.tools.implementations.output import OutputTool
from app.domain.tools.registry import ToolRegistry
from app.utils.expression import PL_ALLOWED_NAMES, is_denied_method_name

STUDIO_DIR = Path(__file__).resolve().parents[2] / "studio"
FIXTURE = STUDIO_DIR / "src" / "ai" / "__fixtures__" / "serverToolContract.json"

# Candidates probed against OutputTool.validate_config; the Server keeps its
# writer list inline in that method rather than as a constant.
_OUTPUT_TYPE_CANDIDATES = [
    "avro", "csv", "excel", "ipc", "json", "ods", "parquet", "qvd", "xlsx", "yxdb",
]


def _output_types() -> list[str]:
    tool = OutputTool()
    accepted = []
    for candidate in _OUTPUT_TYPE_CANDIDATES:
        errors = asyncio.run(tool.validate_config({"type": candidate, "destination": "out"}))
        if not any("Unsupported output type" in e for e in errors):
            accepted.append(candidate)
    return accepted


def build_contract() -> dict[str, Any]:
    tool_types = sorted(k for k in ToolRegistry._tools if "::" not in k)
    configs: dict[str, Any] = {}
    for tool_type in tool_types:
        model = ToolRegistry.get(tool_type).config_model()
        configs[tool_type] = model.model_json_schema() if model is not None else None

    pivot_aggs = PivotOperation(on="", index=[], values="").VALID_AGGREGATIONS
    return {
        "toolTypes": tool_types,
        "configSchemas": configs,
        "values": {
            "inputTypes": sorted(DataSourceFactory._sources),
            "outputTypes": _output_types(),
            "summarizeOperations": sorted(AGGREGATION_METHODS),
            "pivotAggregations": sorted(pivot_aggs),
        },
        "expressions": {
            "plAllowedNames": sorted(PL_ALLOWED_NAMES),
            # Method names that a prompt might suggest and the sandbox rejects.
            "deniedMethodSamples": sorted(
                n for n in ("map_elements", "map_batches", "pipe", "inspect", "apply")
                if is_denied_method_name(n)
            ),
        },
    }


def _render(contract: dict[str, Any]) -> str:
    return json.dumps(contract, indent=2, sort_keys=True) + "\n"


def test_studio_tool_contract_fixture_is_current() -> None:
    if not STUDIO_DIR.is_dir():
        pytest.skip("studio/ is not part of this checkout")

    rendered = _render(build_contract())
    if os.environ.get("UPDATE_TOOL_CONTRACT") == "1":
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE.write_text(rendered, encoding="utf-8")

    assert FIXTURE.exists(), (
        f"{FIXTURE} is missing. Run: UPDATE_TOOL_CONTRACT=1 uv run pytest "
        "tests/test_ai_tool_contract.py"
    )
    assert FIXTURE.read_text(encoding="utf-8") == rendered, (
        "Studio's copy of the Server tool contract is stale. Run: "
        "UPDATE_TOOL_CONTRACT=1 uv run pytest tests/test_ai_tool_contract.py "
        "and fix any Studio AI drift tests that then fail."
    )
