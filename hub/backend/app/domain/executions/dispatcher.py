"""Durable execution dispatch.

Executions are a queue in PostgreSQL. Every Hub process runs one
``ExecutionDispatcher`` that claims queued rows with ``FOR UPDATE SKIP
LOCKED``, runs them, and keeps a lease on each one through ``heartbeat_at``.
Each claim gets a fresh ``claim_token``; every later write by the runner is
conditional on that token, so a runner that lost its lease (to a sweep, a
cancellation or another process) can never overwrite the row.

Retry policy: a claim lost before the request is sent to the Server (the
process died while preparing) is claimed again, up to
``execution_max_attempts`` claims. Once the request has been sent the outcome
on the Server is unknown and workflows can have side effects, so a lost
running execution is marked failed and never retried automatically.

The design is described in docs/developer/architecture/hub-execution.md.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
import socket
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.sql.elements import ColumnElement

from app.config import settings
from app.db.models import Execution, Server
from app.domain.executions.models import ExecutionStatus
from app.domain.executions.service import (
    ACTIVE_STATUSES,
    ExecutionService,
    publish_executions,
)
from app.domain.servers.client import ServerClient, ServerError
from app.domain.workflows.store import WorkflowFileStore

logger = logging.getLogger(__name__)

# Seconds between lease refreshes while a run is owned by this process. Must
# be well below ``execution_stale_seconds`` (at least 30).
HEARTBEAT_INTERVAL_SECONDS = 15.0

# Fallback poll for work queued by other processes (local triggers wake the
# dispatcher immediately).
POLL_INTERVAL_SECONDS = 1.0

# Seconds between recovery sweeps.
SWEEP_INTERVAL_SECONDS = 30.0

INTERRUPTED_MESSAGE = (
    "Interrupted: the Hub stopped while this run was in progress; "
    "outcome on the Server is unknown."
)

_QUEUED = ExecutionStatus.QUEUED.value
_RUNNING = ExecutionStatus.RUNNING.value
_FAILED = ExecutionStatus.FAILED.value
_COMPLETED = ExecutionStatus.COMPLETED.value


def _default_instance_id() -> str:
    """Identify this process in ``claimed_by`` (observability only)."""
    return f"{socket.gethostname()}:{os.getpid()}:{secrets.token_hex(3)}"


def _resolve_session_maker() -> async_sessionmaker[AsyncSession]:
    # Looked up at call time so tests can patch the module attribute.
    from app.db import database

    return database.async_session_maker


def not_started_message(attempts: int) -> str:
    return (
        f"Not started: the Hub lost this run {attempts} time(s) before it was "
        "sent to the Server."
    )


@dataclass(frozen=True)
class Claim:
    """One claimed execution, fenced by ``token``."""

    execution_id: UUID
    token: UUID
    attempt: int


@dataclass
class _Active:
    claim: Claim
    task: asyncio.Task[None] | None = None
    # True once the run is ``running`` (the Server request may have been sent).
    started: bool = False
    # Set by the heartbeat when the lease is gone (cancelled, swept, reclaimed).
    lost: asyncio.Event = field(default_factory=asyncio.Event)


class ExecutionDispatcher:
    """Claims queued executions from PostgreSQL and runs them."""

    def __init__(
        self,
        session_maker: async_sessionmaker[AsyncSession] | None = None,
        *,
        instance_id: str | None = None,
        max_concurrent: int | None = None,
        file_store: WorkflowFileStore | None = None,
    ) -> None:
        self._session_maker = session_maker
        self.instance_id = instance_id or _default_instance_id()
        self._max_concurrent = max_concurrent
        self._file_store = file_store
        self._active: dict[UUID, _Active] = {}
        self._wake = asyncio.Event()
        self._accepting = False
        self._loop_task: asyncio.Task[None] | None = None
        self._sweep_task: asyncio.Task[None] | None = None

    # ------------------------------------------------------------------ config

    @property
    def sessions(self) -> async_sessionmaker[AsyncSession]:
        return self._session_maker or _resolve_session_maker()

    @property
    def max_concurrent(self) -> int:
        return self._max_concurrent or settings.execution_max_concurrent

    @property
    def file_store(self) -> WorkflowFileStore:
        if self._file_store is None:
            self._file_store = WorkflowFileStore()
        return self._file_store

    @property
    def is_running(self) -> bool:
        return self._accepting

    @property
    def active_count(self) -> int:
        return len(self._active)

    def _stale_cutoff(self) -> ColumnElement[Any]:
        # Lease expiry uses the database clock so replicas with skewed clocks
        # agree on it.
        return func.now() - timedelta(seconds=settings.execution_stale_seconds)

    # --------------------------------------------------------------- lifecycle

    def wake(self) -> None:
        """Ask the dispatch loop to look for work now (non-blocking)."""
        self._wake.set()

    async def start(self) -> None:
        if self._accepting:
            return
        self._accepting = True
        self._loop_task = asyncio.create_task(self._dispatch_loop())
        self._sweep_task = asyncio.create_task(self._sweep_loop())
        logger.info(
            "Execution dispatcher %s started (max %d concurrent)",
            self.instance_id,
            self.max_concurrent,
        )

    async def stop(self, grace_seconds: float | None = None) -> None:
        """Stop claiming work, then wind down this process's runs.

        Runs still preparing are released so another process can claim them at
        once. Running executions get ``grace_seconds`` to finish; any still
        running afterwards are marked interrupted.
        """
        if grace_seconds is None:
            grace_seconds = settings.execution_shutdown_grace_seconds
        self._accepting = False
        for task in (self._loop_task, self._sweep_task):
            if task is not None:
                task.cancel()
        await asyncio.gather(
            *(t for t in (self._loop_task, self._sweep_task) if t is not None),
            return_exceptions=True,
        )
        self._loop_task = self._sweep_task = None

        preparing = [a.task for a in self._active.values() if a.task and not a.started]
        for task in preparing:
            task.cancel()
        await asyncio.gather(*preparing, return_exceptions=True)

        running = [a.task for a in self._active.values() if a.task]
        if running:
            logger.info(
                "Waiting up to %.1fs for %d running execution(s)",
                grace_seconds,
                len(running),
            )
            _, pending = await asyncio.wait(running, timeout=grace_seconds)
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
        logger.info("Execution dispatcher %s stopped", self.instance_id)

    async def wait_idle(self) -> None:
        """Wait until every run this process started has finished."""
        while self._active:
            tasks = [a.task for a in self._active.values() if a.task]
            await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(0)

    # ---------------------------------------------------------------- claiming

    async def claim(self, limit: int) -> list[Claim]:
        """Atomically claim up to ``limit`` queued executions, oldest first.

        Claimable rows are queued rows nobody holds, and queued rows whose
        holder's lease expired with attempts left. ``SKIP LOCKED`` lets
        concurrent claimers on other processes take disjoint rows.
        """
        if limit <= 0:
            return []
        candidates = (
            select(Execution.id)
            .where(
                Execution.status == _QUEUED,
                or_(
                    Execution.claim_token.is_(None),
                    and_(
                        Execution.heartbeat_at < self._stale_cutoff(),
                        Execution.attempts < settings.execution_max_attempts,
                    ),
                ),
            )
            .order_by(Execution.queued_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        stmt = (
            update(Execution)
            .where(Execution.id.in_(candidates.scalar_subquery()))
            .values(
                claim_token=func.gen_random_uuid(),
                claimed_by=self.instance_id,
                heartbeat_at=func.now(),
                attempts=Execution.attempts + 1,
            )
            .returning(Execution.id, Execution.claim_token, Execution.attempts)
            .execution_options(synchronize_session=False)
        )
        async with self.sessions() as db:
            rows = (await db.execute(stmt)).all()
            await db.commit()
        claims = [Claim(row[0], row[1], row[2]) for row in rows]
        for c in claims:
            logger.info(
                "Claimed execution %s (attempt %d) on %s",
                c.execution_id,
                c.attempt,
                self.instance_id,
            )
        return claims

    def _spawn(self, claim: Claim) -> None:
        active = _Active(claim)
        self._active[claim.execution_id] = active
        task = asyncio.create_task(self._run(active))
        active.task = task

        def _done(t: asyncio.Task[None]) -> None:
            self._active.pop(claim.execution_id, None)
            self._wake.set()  # a slot is free
            if not t.cancelled() and t.exception() is not None:
                logger.error(
                    "Runner for execution %s crashed",
                    claim.execution_id,
                    exc_info=t.exception(),
                )

        task.add_done_callback(_done)

    async def dispatch_once(self) -> list[Claim]:
        """Claim as many executions as there are free slots and start them."""
        claims = await self.claim(self.max_concurrent - len(self._active))
        for c in claims:
            self._spawn(c)
        return claims

    async def _dispatch_loop(self) -> None:
        while self._accepting:
            self._wake.clear()
            try:
                await self.dispatch_once()
            except Exception:
                logger.exception("Execution claim failed; retrying")
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=POLL_INTERVAL_SECONDS)
            except TimeoutError:
                pass

    async def _sweep_loop(self) -> None:
        while True:
            try:
                await self.sweep()
            except Exception:
                logger.exception("Execution recovery sweep failed")
            await asyncio.sleep(SWEEP_INTERVAL_SECONDS)

    # ---------------------------------------------------------------- recovery

    async def sweep(self) -> int:
        """Fail executions whose lease expired and cannot be claimed again.

        A running execution with an expired lease was sent to the Server by a
        process that has stopped, so its outcome is unknown: it is failed, not
        retried. A queued execution that used up its claims is failed too.
        Unclaimed queued executions are left alone; they wait for a process.

        Each statement is a single conditional UPDATE, so sweeps on several
        processes at once are safe. Returns the number of rows failed.
        """
        cutoff = self._stale_cutoff()
        last_seen = func.coalesce(
            Execution.heartbeat_at, Execution.started_at, Execution.queued_at
        )
        async with self.sessions() as db:
            interrupted = (
                await db.execute(
                    update(Execution)
                    .where(Execution.status == _RUNNING, last_seen < cutoff)
                    .values(
                        status=_FAILED,
                        success=False,
                        error_message=INTERRUPTED_MESSAGE,
                        completed_at=func.now(),
                    )
                    .returning(Execution.id)
                    .execution_options(synchronize_session=False)
                )
            ).scalars().all()
            exhausted = (
                await db.execute(
                    update(Execution)
                    .where(
                        Execution.status == _QUEUED,
                        Execution.claim_token.is_not(None),
                        Execution.heartbeat_at < cutoff,
                        Execution.attempts >= settings.execution_max_attempts,
                    )
                    .values(
                        status=_FAILED,
                        success=False,
                        error_message=not_started_message(settings.execution_max_attempts),
                        completed_at=func.now(),
                    )
                    .returning(Execution.id)
                    .execution_options(synchronize_session=False)
                )
            ).scalars().all()
            await db.commit()
            failed = [*interrupted, *exhausted]
            if failed:
                logger.warning(
                    "Recovery sweep failed %d interrupted and %d unstartable execution(s): %s",
                    len(interrupted),
                    len(exhausted),
                    ", ".join(str(i) for i in failed),
                )
                await publish_executions(db, failed)
        return len(failed)

    # ----------------------------------------------------------------- running

    async def run_claim(self, claim: Claim) -> None:
        """Run one claimed execution to completion in the current task."""
        active = _Active(claim, task=asyncio.current_task())
        await self._run(active)

    async def _run(self, active: _Active) -> None:
        heartbeat = asyncio.create_task(self._heartbeat(active))
        try:
            await self._run_body(active)
        except asyncio.CancelledError:
            await self._abandon(active.claim)
            raise
        except Exception as e:
            logger.exception("Error running execution %s", active.claim.execution_id)
            await self._finish(active.claim, _failed_values(str(e)))
        finally:
            heartbeat.cancel()
            await asyncio.gather(heartbeat, return_exceptions=True)

    async def _heartbeat(self, active: _Active) -> None:
        """Refresh the lease; flag ``lost`` when the row is no longer ours."""
        claim = active.claim
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
            try:
                async with self.sessions() as db:
                    row = (
                        await db.execute(
                            self._fenced(claim, ACTIVE_STATUSES)
                            .values(heartbeat_at=func.now())
                            .returning(Execution.id)
                        )
                    ).first()
                    await db.commit()
            except Exception:
                # Transient database trouble: keep trying. If it lasts longer
                # than the lease the row is swept and the next beat sees that.
                logger.exception("Heartbeat failed for execution %s", claim.execution_id)
                continue
            if row is None:
                logger.info(
                    "Execution %s is no longer held by %s (cancelled or recovered)",
                    claim.execution_id,
                    self.instance_id,
                )
                active.lost.set()
                return

    def _fenced(self, claim: Claim, statuses: tuple[str, ...]) -> Any:
        """UPDATE that only applies while ``claim`` still owns the row."""
        return (
            update(Execution)
            .where(
                Execution.id == claim.execution_id,
                Execution.claim_token == claim.token,
                Execution.status.in_(statuses),
            )
            .execution_options(synchronize_session=False)
        )

    async def _finish(self, claim: Claim, values: dict[str, Any]) -> bool:
        """Write a terminal state if the claim still holds. Publishes the event."""
        async with self.sessions() as db:
            row = (
                await db.execute(
                    self._fenced(claim, ACTIVE_STATUSES)
                    .values(completed_at=func.now(), **values)
                    .returning(Execution.id)
                )
            ).first()
            await db.commit()
            if row is None:
                logger.info(
                    "Execution %s no longer held by this runner; result discarded",
                    claim.execution_id,
                )
                return False
            await publish_executions(db, [claim.execution_id])
        return True

    async def _abandon(self, claim: Claim) -> None:
        """Handle this process stopping mid-run (task cancelled).

        A run that never reached the Server is released for another process
        (the attempt is refunded). A running one is marked interrupted.
        """
        try:
            async with self.sessions() as db:
                released = (
                    await db.execute(
                        self._fenced(claim, (_QUEUED,))
                        .values(
                            claim_token=None,
                            claimed_by=None,
                            attempts=func.greatest(Execution.attempts - 1, 0),
                        )
                        .returning(Execution.id)
                    )
                ).first()
                interrupted = (
                    await db.execute(
                        self._fenced(claim, (_RUNNING,))
                        .values(completed_at=func.now(), **_failed_values(INTERRUPTED_MESSAGE))
                        .returning(Execution.id)
                    )
                ).first()
                await db.commit()
                if released:
                    logger.info("Released execution %s for another Hub", claim.execution_id)
                if interrupted:
                    logger.warning("Execution %s interrupted by shutdown", claim.execution_id)
                    await publish_executions(db, [claim.execution_id])
        except Exception:
            # The sweep on a surviving process recovers the row once the lease
            # expires.
            logger.exception(
                "Could not release execution %s on shutdown; it is recovered "
                "after EXECUTION_STALE_SECONDS",
                claim.execution_id,
            )

    async def _run_body(self, active: _Active) -> None:
        from app.domain.capabilities import get_issuer

        claim = active.claim
        execution_id = claim.execution_id

        async with self.sessions() as db:
            execution = await db.get(Execution, execution_id)
            server = await db.get(Server, execution.server_id) if execution else None
            run_as = await ExecutionService(db).resolve_run_as_user_id(execution_id)
        if execution is None or execution.claim_token != claim.token:
            logger.info("Execution %s is no longer held by this runner", execution_id)
            return
        if server is None:
            await self._finish(claim, _failed_values("The target Server no longer exists."))
            return

        try:
            workflow_content = self.file_store.load(execution.workflow_id)
        except Exception as e:
            await self._finish(claim, _failed_values(f"Failed to load workflow: {e}"))
            return

        # Fail fast on a corrupt workflow file before contacting the Server.
        try:
            json.loads(workflow_content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            await self._finish(claim, _failed_values(f"Invalid workflow JSON: {e}"))
            return

        # Manual runs execute as the triggering user, scheduled runs as the
        # schedule creator, so the Server's /internal/authorize check applies
        # that user's grants.
        if run_as is None:
            await self._finish(
                claim,
                _failed_values(
                    "Cannot start execution: the user it runs as no longer exists."
                ),
            )
            return

        # A single-use capability token for this run. There is deliberately no
        # fallback to the Server's long-lived shared secret.
        try:
            server_token = await get_issuer().issue_token(user_id=str(run_as), server=server)
        except Exception:
            logger.exception(
                "Failed to issue capability token for execution %s on server %s",
                execution_id,
                server.name,
            )
            await self._finish(
                claim,
                _failed_values(
                    f"Could not issue an authorization token for server "
                    f"'{server.name}'; the execution was not sent to the server."
                ),
            )
            return

        # queued -> running, only while this claim still holds the row.
        async with self.sessions() as db:
            started = (
                await db.execute(
                    self._fenced(claim, (_QUEUED,))
                    .values(status=_RUNNING, started_at=func.now(), heartbeat_at=func.now())
                    .returning(Execution.id)
                )
            ).first()
            await db.commit()
            if started is None:
                logger.info(
                    "Execution %s was cancelled or reclaimed before it started",
                    execution_id,
                )
                return
            active.started = True
            await publish_executions(db, [execution_id])

        client = ServerClient(server.endpoint_url, server_token.token)
        send = asyncio.create_task(client.execute(workflow_content))
        lost = asyncio.create_task(active.lost.wait())
        try:
            await asyncio.wait({send, lost}, return_when=asyncio.FIRST_COMPLETED)
        finally:
            lost.cancel()
            if not send.done():
                send.cancel()
            await asyncio.gather(send, lost, return_exceptions=True)
        if send.cancelled():
            logger.info(
                "Stopped waiting for execution %s: it was cancelled or recovered",
                execution_id,
            )
            return
        result = send.result()

        if isinstance(result, ServerError):
            await self._finish(claim, _failed_values(result.message))
            return

        values: dict[str, Any] = {"status": _COMPLETED, "success": True}
        duration = result.get("duration") if isinstance(result, dict) else None
        if isinstance(duration, (int, float)):
            values["duration_seconds"] = float(duration)
        else:
            values["duration_seconds"] = func.extract(
                "epoch", func.now() - Execution.started_at
            )
        if not await self._finish(claim, values):
            return
        logger.info("Execution %s completed", execution_id)

        # Outputs are stored as content-addressed artifacts. A storage failure
        # does not fail an otherwise successful execution.
        if isinstance(result, dict):
            try:
                from app.domain.artifacts import ArtifactService

                async with self.sessions() as db:
                    await ArtifactService(db).store_execution_outputs(execution_id, result)
            except Exception:
                logger.exception("Failed to store artifacts for execution %s", execution_id)


def _failed_values(message: str) -> dict[str, Any]:
    return {"status": _FAILED, "success": False, "error_message": message}


_dispatcher: ExecutionDispatcher | None = None


def get_dispatcher() -> ExecutionDispatcher:
    global _dispatcher
    if _dispatcher is None:
        _dispatcher = ExecutionDispatcher()
    return _dispatcher


def wake_dispatcher() -> None:
    """Nudge this process's dispatcher, if one exists, after queuing work."""
    if _dispatcher is not None:
        _dispatcher.wake()


def reset_dispatcher() -> None:
    """Forget the process-wide dispatcher (for testing)."""
    global _dispatcher
    _dispatcher = None
