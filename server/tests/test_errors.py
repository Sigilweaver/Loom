"""Tests for the narrowed exception hierarchy and error-id correlation."""

import re

from app.utils.errors import (
    ExecutionError,
    SafetyLimitExceeded,
    ToolConfigError,
    ToolError,
    ToolRuntimeError,
)


def test_execution_error_has_stable_error_id():
    err = ExecutionError("boom")
    assert isinstance(err.error_id, str)
    # uuid4 hex is 32 lowercase hex chars
    assert re.fullmatch(r"[0-9a-f]{32}", err.error_id)


def test_execution_error_accepts_supplied_id():
    err = ExecutionError("boom", error_id="deadbeef")
    assert err.error_id == "deadbeef"


def test_tool_subclasses_are_tool_error():
    assert issubclass(ToolConfigError, ToolError)
    assert issubclass(ToolRuntimeError, ToolError)


def test_safety_limit_is_execution_error():
    err = SafetyLimitExceeded("rows exceeded")
    assert isinstance(err, ExecutionError)
    assert err.error_id  # inherits id behaviour
