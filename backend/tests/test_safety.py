"""Tests for execution safety checks."""

import pytest
import polars as pl

from app.domain.execution.safety import (
    SafetyCheckResult,
    check_pivot_safety,
    check_cross_join_safety,
    check_unpivot_safety,
    raise_if_unsafe,
)
from app.utils.errors import ToolError


class TestSafetyCheckResult:
    """Tests for SafetyCheckResult dataclass."""

    def test_safe_result(self):
        """Test safe result with values."""
        result = SafetyCheckResult(safe=True, actual_value=10, limit_value=100)
        assert result.safe is True
        assert result.message is None
        assert result.actual_value == 10
        assert result.limit_value == 100

    def test_unsafe_result(self):
        """Test unsafe result with message."""
        result = SafetyCheckResult(
            safe=False,
            message="Too many columns",
            actual_value=5000,
            limit_value=1000,
        )
        assert result.safe is False
        assert result.message == "Too many columns"


class TestRaiseIfUnsafe:
    """Tests for raise_if_unsafe helper."""

    def test_does_not_raise_when_safe(self):
        """Should not raise when result is safe."""
        result = SafetyCheckResult(safe=True)
        # Should not raise
        raise_if_unsafe(result)

    def test_raises_when_unsafe(self):
        """Should raise ToolError when result is unsafe."""
        result = SafetyCheckResult(safe=False, message="Operation too dangerous")
        with pytest.raises(ToolError, match="Operation too dangerous"):
            raise_if_unsafe(result)

    def test_raises_with_default_message_when_none(self):
        """Should raise with default message when message is None."""
        result = SafetyCheckResult(safe=False, message=None)
        with pytest.raises(ToolError, match="Safety check failed"):
            raise_if_unsafe(result)


class TestCheckPivotSafety:
    """Tests for pivot safety checks."""

    def test_pivot_safe_with_few_unique_values(self):
        """Pivot should be safe with few unique values."""
        lf = pl.LazyFrame({
            "category": ["A", "B", "C", "A", "B", "C"],
            "value": [1, 2, 3, 4, 5, 6],
        })
        result = check_pivot_safety(lf, "category")
        assert result.safe is True
        assert result.actual_value == 3

    def test_pivot_unsafe_with_many_unique_values(self, monkeypatch):
        """Pivot should be unsafe with too many unique values."""
        # Set a low limit for testing
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_pivot_columns", 5)

        lf = pl.LazyFrame({
            "category": [f"cat_{i}" for i in range(100)],
            "value": list(range(100)),
        })
        result = check_pivot_safety(lf, "category")
        assert result.safe is False
        assert result.actual_value == 100
        assert result.limit_value == 5
        assert "100" in result.message
        assert "limit: 5" in result.message

    def test_pivot_disabled_when_limit_zero(self, monkeypatch):
        """Safety check should be disabled when limit is 0."""
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_pivot_columns", 0)

        lf = pl.LazyFrame({
            "category": [f"cat_{i}" for i in range(10000)],
            "value": list(range(10000)),
        })
        result = check_pivot_safety(lf, "category")
        assert result.safe is True

    def test_pivot_handles_missing_column_gracefully(self):
        """Should fail open if column doesn't exist."""
        lf = pl.LazyFrame({"other": [1, 2, 3]})
        # This should not raise, just return safe=True (fail open)
        result = check_pivot_safety(lf, "nonexistent")
        assert result.safe is True


class TestCheckCrossJoinSafety:
    """Tests for cross join safety checks."""

    def test_cross_join_safe_with_small_inputs(self):
        """Cross join should be safe with small inputs."""
        left = pl.LazyFrame({"a": [1, 2, 3]})
        right = pl.LazyFrame({"b": [4, 5]})
        result = check_cross_join_safety(left, right)
        assert result.safe is True
        assert result.actual_value == 6  # 3 * 2

    def test_cross_join_unsafe_with_large_inputs(self, monkeypatch):
        """Cross join should be unsafe with large inputs."""
        # Set a low limit for testing
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_cross_join_rows", 100)

        left = pl.LazyFrame({"a": list(range(20))})
        right = pl.LazyFrame({"b": list(range(20))})
        result = check_cross_join_safety(left, right)
        assert result.safe is False
        assert result.actual_value == 400  # 20 * 20
        assert result.limit_value == 100
        assert "400" in result.message

    def test_cross_join_disabled_when_limit_zero(self, monkeypatch):
        """Safety check should be disabled when limit is 0."""
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_cross_join_rows", 0)

        left = pl.LazyFrame({"a": list(range(1000))})
        right = pl.LazyFrame({"b": list(range(1000))})
        result = check_cross_join_safety(left, right)
        assert result.safe is True


class TestCheckUnpivotSafety:
    """Tests for unpivot safety checks."""

    def test_unpivot_safe_with_few_columns(self):
        """Unpivot should be safe with few columns."""
        lf = pl.LazyFrame({
            "id": [1, 2, 3],
            "q1": [100, 200, 300],
            "q2": [110, 210, 310],
        })
        result = check_unpivot_safety(lf, ["q1", "q2"])
        assert result.safe is True
        assert result.actual_value == 6  # 3 rows * 2 columns

    def test_unpivot_unsafe_with_many_columns(self, monkeypatch):
        """Unpivot should be unsafe when it would create too many rows."""
        # Set a low limit for testing
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_unpivot_rows", 50)

        # Create data with many columns
        data = {"id": list(range(10))}
        cols_to_unpivot = []
        for i in range(10):
            col_name = f"value_{i}"
            data[col_name] = list(range(10))
            cols_to_unpivot.append(col_name)

        lf = pl.LazyFrame(data)
        result = check_unpivot_safety(lf, cols_to_unpivot)
        assert result.safe is False
        assert result.actual_value == 100  # 10 rows * 10 columns
        assert result.limit_value == 50
        assert "100" in result.message

    def test_unpivot_disabled_when_limit_zero(self, monkeypatch):
        """Safety check should be disabled when limit is 0."""
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_unpivot_rows", 0)

        data = {"id": list(range(1000))}
        cols = []
        for i in range(100):
            col_name = f"value_{i}"
            data[col_name] = list(range(1000))
            cols.append(col_name)

        lf = pl.LazyFrame(data)
        result = check_unpivot_safety(lf, cols)
        assert result.safe is True

    def test_unpivot_empty_columns_list(self):
        """Unpivot with empty column list should be safe."""
        lf = pl.LazyFrame({"id": [1, 2, 3]})
        result = check_unpivot_safety(lf, [])
        assert result.safe is True
        assert result.actual_value == 0


class TestPivotToolSafetyIntegration:
    """Integration tests for Pivot tool with safety checks."""

    @pytest.mark.asyncio
    async def test_pivot_tool_raises_on_too_many_unique_values(self, monkeypatch):
        """Pivot tool should raise ToolError when safety check fails."""
        from app.domain.tools.implementations.pivot import PivotTool

        # Set a very low limit
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_pivot_columns", 5)

        pivot_tool = PivotTool()
        lf = pl.LazyFrame({
            "id": list(range(100)),
            "category": [f"cat_{i}" for i in range(100)],
            "value": list(range(100)),
        })

        config = {
            "on": "category",
            "index": ["id"],
            "values": "value",
        }

        with pytest.raises(ToolError, match="Pivot would create 100 columns"):
            await pivot_tool.execute(config, {"input": lf})

    @pytest.mark.asyncio
    async def test_pivot_tool_succeeds_within_limits(self, monkeypatch):
        """Pivot tool should succeed when within safety limits."""
        from app.domain.tools.implementations.pivot import PivotTool

        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_pivot_columns", 10)

        pivot_tool = PivotTool()
        lf = pl.LazyFrame({
            "id": [1, 1, 2, 2],
            "quarter": ["Q1", "Q2", "Q1", "Q2"],
            "sales": [100, 110, 200, 210],
        })

        config = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
        }

        result = await pivot_tool.execute(config, {"input": lf})
        assert "output" in result


class TestJoinToolSafetyIntegration:
    """Integration tests for Join tool with safety checks."""

    @pytest.mark.asyncio
    async def test_join_tool_raises_on_cross_join_explosion(self, monkeypatch):
        """Join tool should raise ToolError when cross join is too large."""
        from app.domain.tools.implementations.join import JoinTool

        # Set a low limit
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_cross_join_rows", 50)

        join_tool = JoinTool()
        left = pl.LazyFrame({"a": list(range(10))})
        right = pl.LazyFrame({"b": list(range(10))})

        config = {
            "leftKeys": [],  # No keys = cross join
            "rightKeys": [],
        }

        with pytest.raises(ToolError, match="Cross join would produce 100 rows"):
            await join_tool.execute(config, {"input-left": left, "input-right": right})

    @pytest.mark.asyncio
    async def test_join_tool_succeeds_with_keys(self, monkeypatch):
        """Join tool with keys should not trigger cross join safety check."""
        from app.domain.tools.implementations.join import JoinTool

        # Set a very low cross join limit - shouldn't matter with keys
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_cross_join_rows", 1)

        join_tool = JoinTool()
        left = pl.LazyFrame({"id": [1, 2, 3], "a": [10, 20, 30]})
        right = pl.LazyFrame({"id": [2, 3, 4], "b": [200, 300, 400]})

        config = {
            "leftKeys": ["id"],
            "rightKeys": ["id"],
        }

        # Should succeed because we're not doing a cross join
        result = await join_tool.execute(config, {"input-left": left, "input-right": right})
        assert "output-match" in result


class TestUnpivotToolSafetyIntegration:
    """Integration tests for Unpivot tool with safety checks."""

    @pytest.mark.asyncio
    async def test_unpivot_tool_raises_on_row_explosion(self, monkeypatch):
        """Unpivot tool should raise ToolError when too many rows would be created."""
        from app.domain.tools.implementations.unpivot import UnpivotTool

        # Set a low limit
        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_unpivot_rows", 20)

        unpivot_tool = UnpivotTool()
        lf = pl.LazyFrame({
            "id": list(range(10)),
            "q1": list(range(10)),
            "q2": list(range(10)),
            "q3": list(range(10)),
        })

        config = {
            "on": ["q1", "q2", "q3"],  # 10 rows * 3 columns = 30 rows
            "index": ["id"],
        }

        with pytest.raises(ToolError, match="Unpivot would produce 30 rows"):
            await unpivot_tool.execute(config, {"input": lf})

    @pytest.mark.asyncio
    async def test_unpivot_tool_succeeds_within_limits(self, monkeypatch):
        """Unpivot tool should succeed when within safety limits."""
        from app.domain.tools.implementations.unpivot import UnpivotTool

        monkeypatch.setattr("app.domain.execution.safety.settings.safety_max_unpivot_rows", 100)

        unpivot_tool = UnpivotTool()
        lf = pl.LazyFrame({
            "id": [1, 2, 3],
            "q1": [100, 200, 300],
            "q2": [110, 210, 310],
        })

        config = {
            "on": ["q1", "q2"],
            "index": ["id"],
        }

        result = await unpivot_tool.execute(config, {"input": lf})
        assert "output" in result
