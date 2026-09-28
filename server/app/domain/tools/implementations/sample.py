"""Sample tool implementation - Sample rows from data"""

from typing import Any

import polars as pl
from pydantic import BaseModel, ConfigDict, Field

from app.domain.models.common import DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import BLOCKING_SAMPLE_MODES, SampleOperation
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import CommonSockets
from app.utils.errors import ToolError

# Valid sample modes
SAMPLE_MODES = {"FirstN", "LastN", "EveryN", "Random", "RandomPercent", "FirstPercent"}


class SampleToolConfig(BaseModel):
    """Typed config for Sample."""

    model_config = ConfigDict(extra="allow")

    mode: str = Field(default="FirstN")
    n: int = Field(default=100)
    percent: float = Field(default=10.0)
    offset: int = Field(default=0)
    seed: int | None = Field(default=None)


@register_tool("Sample")
class SampleTool(BaseTool):
    """
    Sample rows from the input data.

    Supports multiple sampling modes:
    - FirstN: Take the first N rows (lazy, streaming)
    - LastN: Take the last N rows (blocking - needs full scan)
    - EveryN: Take every Nth row with optional offset (lazy, streaming)
    - Random: Take N random rows (blocking - needs full scan)
    - RandomPercent: Take a random percentage of rows (blocking - needs full scan)
    - FirstPercent: Take the first N% of rows (blocking - needs row count)

    Config:
    - mode: str - sampling mode (default: "FirstN")
    - n: int - number of rows for FirstN/LastN/Random, or interval for EveryN
    - percent: float - percentage for RandomPercent/FirstPercent (0-100)
    - offset: int - starting offset for EveryN mode
    - seed: int | None - random seed for reproducibility (Random/RandomPercent)
    """

    def is_blocking(self, config: dict[str, Any] | None = None) -> bool:
        """
        Check if the current mode requires full data materialization.

        Blocking modes: LastN, Random, RandomPercent, FirstPercent
        Non-blocking (streaming): FirstN, EveryN
        """
        if config is None:
            return False
        mode = config.get("mode", "FirstN")
        return mode in BLOCKING_SAMPLE_MODES

    def should_cache(self, config: dict[str, Any]) -> bool:
        """Cache only if blocking - non-blocking modes are cheap to re-run."""
        return self.is_blocking(config)

    @classmethod
    def config_model(cls) -> type[SampleToolConfig]:
        return SampleToolConfig

    def cache_keys(self, config: dict[str, Any]) -> dict[str, Any]:
        return {
            "mode": config.get("mode", "FirstN"),
            "n": config.get("n", 100),
            "percent": config.get("percent", 10.0),
            "offset": config.get("offset", 0),
            "seed": config.get("seed"),
        }

    def _build_operation(self, config: dict[str, Any]) -> SampleOperation:
        """Build the sample operation from config."""
        mode = config.get("mode", "FirstN")
        n = config.get("n", 100)
        percent = config.get("percent", 10.0)
        offset = config.get("offset", 0)
        seed = config.get("seed")

        # Validate and coerce types
        if not isinstance(n, int) or n < 1:
            n = 100
        if not isinstance(percent, (int, float)) or percent < 0:
            percent = 10.0
        if percent > 100:
            percent = 100.0
        if not isinstance(offset, int) or offset < 0:
            offset = 0
        if seed is not None and not isinstance(seed, int):
            seed = None

        return SampleOperation(
            mode=mode,
            n=n,
            percent=percent,
            offset=offset,
            seed=seed,
        )

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """Execute sample operation."""
        if CommonSockets.INPUT not in inputs:
            raise ToolError("Sample tool requires input on socket 'input'")

        input_data = inputs[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Sample tool does not support multiple inputs")
        lf: pl.LazyFrame = input_data

        op = self._build_operation(config)
        result = op.execute(lf)

        return {CommonSockets.OUTPUT: result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Sample preserves the input schema exactly.
        """
        if CommonSockets.INPUT not in input_schemas:
            raise ToolError("Sample tool requires input schema on socket 'input'")

        input_data = input_schemas[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Sample tool does not support multiple input schemas")
        input_schema: DataSchema = input_data

        # Sample doesn't change the schema, just the row count
        return {CommonSockets.OUTPUT: input_schema}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate sample configuration."""
        errors: list[str] = []

        mode = config.get("mode", "FirstN")
        if mode not in SAMPLE_MODES:
            errors.append(
                f"Invalid sample mode: '{mode}'. Must be one of: {', '.join(sorted(SAMPLE_MODES))}"
            )

        n = config.get("n", 100)
        if not isinstance(n, int) or n < 1:
            errors.append("Sample count (n) must be a positive integer")

        percent = config.get("percent", 10.0)
        if not isinstance(percent, (int, float)):
            errors.append("Sample percent must be a number")
        elif percent < 0 or percent > 100:
            errors.append("Sample percent must be between 0 and 100")

        offset = config.get("offset", 0)
        if not isinstance(offset, int) or offset < 0:
            errors.append("Offset must be a non-negative integer")

        # EveryN mode: n should be > 1 for meaningful sampling
        if mode == "EveryN":
            if isinstance(n, int) and n < 1:
                errors.append("For 'Every N' mode, N must be at least 1")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Sample tool."""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = self._get_input_var(input_vars.get(CommonSockets.INPUT))
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        # Use the same operation builder as execute()
        op = self._build_operation(config)
        lines = op.to_code(input_var, var_name)

        return (lines, {CommonSockets.OUTPUT: var_name})
