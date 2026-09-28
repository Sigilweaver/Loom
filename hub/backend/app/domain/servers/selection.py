"""Automatic server selection.

When a caller does not name a server, Hub picks one of the online servers.
The choice is made from database state only (no per-process counters), so it
behaves the same across requests and across Hub replicas: the server with the
fewest queued or running executions wins, and ties are broken at random so
equally loaded servers share work instead of the first one always winning.
"""

import random

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Execution, Server

ACTIVE_EXECUTION_STATUSES = ("queued", "running")


class NoOnlineServerError(Exception):
    """Raised when there is no online server to choose from."""


async def select_online_server(
    db: AsyncSession,
    rng: random.Random | None = None,
) -> Server:
    """Pick an online server, favouring the least loaded one.

    Args:
        db: Database session.
        rng: Random source used to break ties (injectable for tests).

    Raises:
        NoOnlineServerError: If no server is online.
    """
    active_executions = func.count(Execution.id)
    result = await db.execute(
        select(Server, active_executions)
        .outerjoin(
            Execution,
            (Execution.server_id == Server.id)
            & (Execution.status.in_(ACTIVE_EXECUTION_STATUSES)),
        )
        .where(Server.status == "online")
        .group_by(Server.id)
    )
    candidates: list[tuple[Server, int]] = [(row[0], row[1]) for row in result.all()]
    if not candidates:
        raise NoOnlineServerError("No online servers available")

    lowest_load = min(load for _, load in candidates)
    least_loaded = sorted(
        (server for server, load in candidates if load == lowest_load),
        key=lambda server: server.name,
    )
    return (rng if rng is not None else random.Random()).choice(least_loaded)
