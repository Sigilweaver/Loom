"""APScheduler integration for workflow scheduling.

Manages a background scheduler that triggers workflow executions
based on cron expressions.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.db.database import async_session_maker
from app.db.models import Schedule
from app.domain.executions.models import TriggerExecutionInput, TriggerType
from app.domain.executions.service import ExecutionService

logger = logging.getLogger(__name__)


class Scheduler:
    """Wrapper around APScheduler for workflow scheduling.

    Manages cron-based job scheduling for workflow executions.
    Jobs are persisted in the database and reloaded on startup.
    """

    def __init__(self):
        self._scheduler: AsyncIOScheduler | None = None
        self._running = False

    @property
    def is_running(self) -> bool:
        """Check if scheduler is running."""
        return self._running and self._scheduler is not None

    async def start(self) -> None:
        """Start the scheduler and load existing jobs."""
        if self._running:
            logger.warning("Scheduler already running")
            return

        self._scheduler = AsyncIOScheduler()
        self._scheduler.start()
        self._running = True

        # Load existing schedules from database
        await self._load_schedules()

        logger.info("Scheduler started")

    async def stop(self) -> None:
        """Stop the scheduler."""
        if self._scheduler:
            self._scheduler.shutdown(wait=False)
            self._scheduler = None
        self._running = False
        logger.info("Scheduler stopped")

    async def _load_schedules(self) -> None:
        """Load and register all enabled schedules from database."""
        async with async_session_maker() as db:
            result = await db.execute(
                select(Schedule).where(Schedule.enabled == True)  # noqa: E712
            )
            schedules = result.scalars().all()

            for schedule in schedules:
                self._register_job(schedule)

            logger.info("Loaded %d schedules", len(schedules))

    def _register_job(self, schedule: Schedule) -> None:
        """Register a schedule as an APScheduler job."""
        if not self._scheduler:
            return

        job_id = str(schedule.id)

        # Remove existing job if present
        existing = self._scheduler.get_job(job_id)
        if existing:
            self._scheduler.remove_job(job_id)

        if not schedule.enabled:
            return

        try:
            # Parse cron expression (5 fields: minute hour day month day_of_week)
            parts = schedule.cron_expression.split()
            if len(parts) != 5:
                raise ValueError(f"Expected 5 fields, got {len(parts)}")

            trigger = CronTrigger(
                minute=parts[0],
                hour=parts[1],
                day=parts[2],
                month=parts[3],
                day_of_week=parts[4],
                timezone=schedule.timezone,
                start_date=schedule.start_at,
            )
        except ValueError as e:
            logger.error(
                "Invalid cron expression for schedule %s: %s",
                schedule.id,
                e,
            )
            return

        self._scheduler.add_job(
            self._execute_schedule,
            trigger=trigger,
            id=job_id,
            args=[schedule.id, schedule.workflow_id, schedule.target_server_id],
            name=f"schedule-{schedule.id}",
            replace_existing=True,
        )

        logger.debug("Registered schedule job: %s", job_id)

    async def _execute_schedule(
        self,
        schedule_id: UUID,
        workflow_id: UUID,
        target_server_id: UUID | None,
    ) -> None:
        """Execute a scheduled workflow (called by APScheduler)."""
        logger.info("Executing schedule %s", schedule_id)

        async with async_session_maker() as db:
            # Update last_triggered_at
            result = await db.execute(
                select(Schedule).where(Schedule.id == schedule_id)
            )
            schedule = result.scalar_one_or_none()

            if not schedule:
                logger.error("Schedule %s not found", schedule_id)
                return

            if not schedule.enabled:
                logger.info("Schedule %s is disabled, skipping", schedule_id)
                return

            schedule.last_triggered_at = datetime.now(UTC)

            # Trigger execution
            service = ExecutionService(db)
            try:
                input = TriggerExecutionInput(
                    workflow_id=workflow_id,
                    server_id=target_server_id,
                )
                await service.trigger_execution(
                    input=input,
                    triggered_by="scheduler",
                    trigger_type=TriggerType.SCHEDULED,
                    schedule_id=schedule_id,
                )
            except Exception as e:
                logger.error(
                    "Failed to trigger execution for schedule %s: %s",
                    schedule_id,
                    e,
                )

            await db.commit()

    def add_schedule(self, schedule: Schedule) -> None:
        """Add or update a schedule job."""
        self._register_job(schedule)

        # Update next trigger time
        if self._scheduler and schedule.enabled:
            job = self._scheduler.get_job(str(schedule.id))
            if job and job.next_run_time:
                schedule.next_trigger_at = job.next_run_time

    def remove_schedule(self, schedule_id: UUID) -> None:
        """Remove a schedule job."""
        if self._scheduler:
            job_id = str(schedule_id)
            existing = self._scheduler.get_job(job_id)
            if existing:
                self._scheduler.remove_job(job_id)
                logger.debug("Removed schedule job: %s", job_id)

    def get_next_run_time(self, schedule_id: UUID) -> datetime | None:
        """Get the next scheduled run time for a schedule."""
        if not self._scheduler:
            return None

        job = self._scheduler.get_job(str(schedule_id))
        if job:
            return job.next_run_time
        return None

    def pause_schedule(self, schedule_id: UUID) -> None:
        """Pause a schedule."""
        if self._scheduler:
            job = self._scheduler.get_job(str(schedule_id))
            if job:
                self._scheduler.pause_job(str(schedule_id))

    def resume_schedule(self, schedule_id: UUID) -> None:
        """Resume a paused schedule."""
        if self._scheduler:
            job = self._scheduler.get_job(str(schedule_id))
            if job:
                self._scheduler.resume_job(str(schedule_id))


# Global scheduler instance
_scheduler: Scheduler | None = None


def get_scheduler() -> Scheduler:
    """Get the global scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = Scheduler()
    return _scheduler


def reset_scheduler() -> None:
    """Reset the global scheduler (for testing)."""
    global _scheduler
    _scheduler = None
