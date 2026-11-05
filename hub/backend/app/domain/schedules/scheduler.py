"""Poll persisted cron occurrences and claim them transactionally."""

import logging
from datetime import datetime
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.db.database import async_session_maker
from app.db.models import Schedule
from app.domain.executions.models import TriggerExecutionInput, TriggerType
from app.domain.executions.service import (
    ExecutionService,
    NoAvailableServerError,
    ServerNotFoundError,
    WorkflowNotFoundError,
)
from app.domain.schedules.cron import cron_trigger

logger = logging.getLogger(__name__)


class Scheduler:
    """Dispatch due occurrences using PostgreSQL row locks and its clock.

    Advancing next_trigger_at and inserting the execution share a transaction,
    and the execution carries the occurrence as ``scheduled_for`` under a
    unique index, so an occurrence produces at most one execution. Every
    process polls the database, so another process can take over without a
    leader lease or rebuilding a replica-local set of cron jobs.
    """

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler | None = None
        self._running = False
        # schedule id -> occurrence whose failure was already logged, so an
        # occurrence retried every poll (e.g. no Server online) logs once.
        self._reported: dict[UUID, datetime | None] = {}

    @property
    def is_running(self) -> bool:
        return self._running and self._scheduler is not None

    async def start(self) -> None:
        if self._running:
            return
        self._scheduler = AsyncIOScheduler()
        self._scheduler.add_job(
            self._load_schedules,
            "interval",
            seconds=1,
            id="dispatch-schedules",
            max_instances=1,
            coalesce=True,
        )
        self._scheduler.start()
        self._running = True
        await self._load_schedules()
        logger.info("Scheduler started")

    async def stop(self) -> None:
        if self._scheduler:
            self._scheduler.shutdown(wait=False)
            self._scheduler = None
        self._running = False
        logger.info("Scheduler stopped")

    async def _load_schedules(self) -> None:
        """Discover new and overdue schedules, including edits on other replicas."""
        async with async_session_maker() as db:
            result = await db.execute(
                select(Schedule.id).where(
                    Schedule.enabled.is_(True),
                    or_(
                        Schedule.next_trigger_at.is_(None),
                        Schedule.next_trigger_at <= func.clock_timestamp(),
                    ),
                )
            )
            schedule_ids = result.scalars().all()
        for schedule_id in schedule_ids:
            await self._execute_schedule(schedule_id)

    async def _execute_schedule(self, schedule_id: UUID) -> None:
        """Claim a due occurrence; skip rows another dispatcher already owns."""
        async with async_session_maker() as db:
            result = await db.execute(
                select(Schedule)
                .where(Schedule.id == schedule_id)
                .with_for_update(skip_locked=True)
            )
            schedule = result.scalar_one_or_none()
            if schedule is None or not schedule.enabled:
                return
            now = (await db.execute(select(func.clock_timestamp()))).scalar_one()
            try:
                trigger = cron_trigger(
                    schedule.cron_expression, schedule.timezone, schedule.start_at
                )
            except ValueError:
                self._report(
                    schedule_id,
                    schedule.next_trigger_at,
                    "has an invalid cron configuration",
                    exc_info=True,
                )
                return
            if schedule.next_trigger_at is None:
                # Legacy schedules initialize once. Existing overdue occurrences
                # remain due across restart and are coalesced into one attempt.
                schedule.next_trigger_at = trigger.get_next_fire_time(None, now)
                await db.commit()
                return
            if schedule.next_trigger_at > now:
                return
            occurrence = schedule.next_trigger_at
            schedule.last_triggered_at = now
            schedule.next_trigger_at = trigger.get_next_fire_time(now, now)
            try:
                await ExecutionService(db).trigger_execution(
                    input=TriggerExecutionInput(
                        workflow_id=schedule.workflow_id,
                        server_id=schedule.target_server_id,
                    ),
                    triggered_by="scheduler",
                    trigger_type=TriggerType.SCHEDULED,
                    schedule_id=schedule_id,
                    scheduled_for=occurrence,
                )
            except IntegrityError:
                await db.rollback()
                await self._skip_dispatched_occurrence(schedule_id, occurrence)
                return
            except (NoAvailableServerError, ServerNotFoundError, WorkflowNotFoundError) as e:
                # Nothing committed: the occurrence stays due and is retried on
                # the next poll, so it runs once the condition clears.
                await db.rollback()
                self._report(schedule_id, occurrence, f"cannot start yet: {e}")
                return
            except Exception:
                await db.rollback()
                self._report(schedule_id, occurrence, "failed to trigger", exc_info=True)
                return
            self._reported.pop(schedule_id, None)

    def _report(
        self,
        schedule_id: UUID,
        occurrence: datetime | None,
        message: str,
        *,
        exc_info: bool = False,
    ) -> None:
        if schedule_id in self._reported and self._reported[schedule_id] == occurrence:
            logger.debug("Schedule %s occurrence %s still %s", schedule_id, occurrence, message)
            return
        self._reported[schedule_id] = occurrence
        logger.warning(
            "Schedule %s occurrence %s %s; retrying every poll",
            schedule_id,
            occurrence.isoformat() if occurrence else "(none)",
            message,
            exc_info=exc_info,
        )

    async def _skip_dispatched_occurrence(self, schedule_id: UUID, occurrence: datetime) -> None:
        """Advance past an occurrence that already has an execution.

        Only reachable if next_trigger_at was moved back to an occurrence that
        already ran (for example by restoring a backup); without this the
        schedule would retry the same occurrence forever.
        """
        logger.warning(
            "Schedule %s occurrence %s already has an execution; skipping it",
            schedule_id,
            occurrence.isoformat(),
        )
        async with async_session_maker() as db:
            schedule = (
                await db.execute(
                    select(Schedule)
                    .where(Schedule.id == schedule_id)
                    .with_for_update(skip_locked=True)
                )
            ).scalar_one_or_none()
            if schedule is None or schedule.next_trigger_at != occurrence:
                return
            now = (await db.execute(select(func.clock_timestamp()))).scalar_one()
            trigger = cron_trigger(schedule.cron_expression, schedule.timezone, schedule.start_at)
            schedule.next_trigger_at = trigger.get_next_fire_time(now, now)
            await db.commit()

    def add_schedule(self, schedule: Schedule, now: datetime) -> None:
        """Persist the next occurrence when configuration changes, even stopped."""
        trigger = cron_trigger(schedule.cron_expression, schedule.timezone, schedule.start_at)
        schedule.next_trigger_at = (
            trigger.get_next_fire_time(None, now) if schedule.enabled else None
        )


_scheduler: Scheduler | None = None


def get_scheduler() -> Scheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = Scheduler()
    return _scheduler


def reset_scheduler() -> None:
    """Reset the global scheduler (for testing)."""
    global _scheduler
    _scheduler = None
