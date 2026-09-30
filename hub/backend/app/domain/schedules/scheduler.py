"""Poll persisted cron occurrences and claim them transactionally."""

import logging
from datetime import datetime
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, or_, select

from app.db.database import async_session_maker
from app.db.models import Schedule
from app.domain.executions.models import TriggerExecutionInput, TriggerType
from app.domain.executions.service import ExecutionService
from app.domain.schedules.cron import cron_trigger

logger = logging.getLogger(__name__)


class Scheduler:
    """Dispatch due occurrences using PostgreSQL row locks and its clock.

    Advancing next_trigger_at and inserting the execution share a transaction.
    Every process polls the database, so another process can take over without
    a leader lease or rebuilding a replica-local set of cron jobs.
    """

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler | None = None
        self._running = False

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
                logger.exception("Invalid cron configuration for schedule %s", schedule_id)
                return
            if schedule.next_trigger_at is None:
                # Legacy schedules initialize once. Existing overdue occurrences
                # remain due across restart and are coalesced into one attempt.
                schedule.next_trigger_at = trigger.get_next_fire_time(None, now)
                await db.commit()
                return
            if schedule.next_trigger_at > now:
                return
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
                )
                await db.commit()
            except Exception:
                # Roll back an uncommitted claim so a later poll can retry.
                # If execution insertion committed before task startup failed,
                # the occurrence stays claimed and the stale-run sweep handles it.
                await db.rollback()
                logger.exception("Failed to trigger schedule %s", schedule_id)

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
