"""Unit tests for execution service query behavior."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.db.models import Execution
from app.domain.executions.service import ExecutionService


def _execution() -> Execution:
    return Execution(
        id=uuid4(),
        workflow_id=uuid4(),
        server_id=uuid4(),
        trigger_type="manual",
        triggered_by="testuser",
        status="queued",
        queued_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("page_size", [1, 10])
async def test_list_executions_query_count_is_constant(page_size):
    """Listing executes one count query and one page query at any page size."""
    count_result = MagicMock()
    count_result.scalar_one.return_value = page_size

    page_result = MagicMock()
    page_result.all.return_value = [(_execution(), "Workflow", "Server") for _ in range(page_size)]

    db = MagicMock()
    db.execute = AsyncMock(side_effect=[count_result, page_result])

    infos, total = await ExecutionService(db).list_executions(limit=page_size)

    assert len(infos) == page_size
    assert total == page_size
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_list_executions_preserves_unknown_names():
    count_result = MagicMock()
    count_result.scalar_one.return_value = 1

    page_result = MagicMock()
    page_result.all.return_value = [(_execution(), None, None)]

    db = MagicMock()
    db.execute = AsyncMock(side_effect=[count_result, page_result])

    infos, _ = await ExecutionService(db).list_executions()

    assert infos[0].workflow_name == "Unknown"
    assert infos[0].server_name == "Unknown"
