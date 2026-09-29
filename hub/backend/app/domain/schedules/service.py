"""Schedule management service."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Schedule, Server, Workflow

from .models import CreateScheduleInput, ScheduleInfo, UpdateScheduleInput
from .scheduler import get_scheduler


class ScheduleNotFoundError(Exception):
    """Schedule not found."""

    pass


class WorkflowNotFoundError(Exception):
    """Workflow not found for schedule."""

    pass


class ServerNotFoundError(Exception):
    """Server not found for schedule."""

    pass


class ScheduleService:
    """Service for managing schedules."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_schedules(
        self,
        workflow_id: UUID | None = None,
        enabled_only: bool = False,
        created_by: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ScheduleInfo], int]:
        """List schedules with optional filtering.

        Returns:
            Tuple of (schedules, total_count).
        """
        query = select(Schedule).options(
            selectinload(Schedule.workflow),
            selectinload(Schedule.target_server),
        )
        count_query = select(func.count(Schedule.id))

        if workflow_id:
            query = query.where(Schedule.workflow_id == workflow_id)
            count_query = count_query.where(Schedule.workflow_id == workflow_id)

        if enabled_only:
            query = query.where(Schedule.enabled.is_(True))
            count_query = count_query.where(Schedule.enabled.is_(True))

        if created_by:
            query = query.where(Schedule.created_by == created_by)
            count_query = count_query.where(Schedule.created_by == created_by)

        # Get total count
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # Get paginated results
        query = query.order_by(Schedule.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        schedules = result.scalars().all()

        return [self._to_schedule_info(s) for s in schedules], total

    async def get_schedule(self, schedule_id: UUID) -> ScheduleInfo:
        """Get a schedule by ID.

        Raises:
            ScheduleNotFoundError: If schedule not found.
        """
        result = await self.db.execute(
            select(Schedule)
            .options(
                selectinload(Schedule.workflow),
                selectinload(Schedule.target_server),
            )
            .where(Schedule.id == schedule_id)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise ScheduleNotFoundError(f"Schedule {schedule_id} not found")

        return self._to_schedule_info(schedule)

    async def create_schedule(
        self,
        input: CreateScheduleInput,
        created_by: str,
    ) -> ScheduleInfo:
        """Create a new schedule.

        Raises:
            WorkflowNotFoundError: If workflow not found.
            ServerNotFoundError: If server not found.
        """
        # Verify workflow exists
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == input.workflow_id)
        )
        workflow = result.scalar_one_or_none()
        if not workflow:
            raise WorkflowNotFoundError(f"Workflow {input.workflow_id} not found")

        # Verify server exists if specified
        if input.target_server_id:
            result = await self.db.execute(
                select(Server).where(Server.id == input.target_server_id)
            )
            server = result.scalar_one_or_none()
            if not server:
                raise ServerNotFoundError(f"Server {input.target_server_id} not found")

        schedule = Schedule(
            workflow_id=input.workflow_id,
            target_server_id=input.target_server_id,
            cron_expression=input.cron_expression,
            timezone=input.timezone,
            start_at=input.start_at,
            enabled=input.enabled,
            description=input.description,
            created_by=created_by,
        )

        self.db.add(schedule)
        await self.db.flush()

        # Register with scheduler
        scheduler = get_scheduler()
        if scheduler.is_running:
            scheduler.add_schedule(schedule)
            # Get next trigger time from scheduler
            schedule.next_trigger_at = scheduler.get_next_run_time(schedule.id)

        await self.db.commit()

        # Reload with relationships
        return await self.get_schedule(schedule.id)

    async def update_schedule(
        self,
        schedule_id: UUID,
        input: UpdateScheduleInput,
    ) -> ScheduleInfo:
        """Update a schedule.

        Raises:
            ScheduleNotFoundError: If schedule not found.
            ServerNotFoundError: If new server not found.
        """
        result = await self.db.execute(
            select(Schedule).where(Schedule.id == schedule_id)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise ScheduleNotFoundError(f"Schedule {schedule_id} not found")

        # Verify new server if specified
        if input.target_server_id is not None:
            if input.target_server_id:  # Not None and not empty
                result = await self.db.execute(
                    select(Server).where(Server.id == input.target_server_id)
                )
                server = result.scalar_one_or_none()
                if not server:
                    raise ServerNotFoundError(
                        f"Server {input.target_server_id} not found"
                    )

        # Update fields
        update_data = input.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(schedule, key, value)

        schedule.updated_at = datetime.now(UTC)

        # Update scheduler job
        scheduler = get_scheduler()
        if scheduler.is_running:
            scheduler.add_schedule(schedule)
            schedule.next_trigger_at = scheduler.get_next_run_time(schedule.id)

        await self.db.commit()

        # Reload with relationships
        return await self.get_schedule(schedule_id)

    async def delete_schedule(self, schedule_id: UUID) -> None:
        """Delete a schedule.

        Raises:
            ScheduleNotFoundError: If schedule not found.
        """
        result = await self.db.execute(
            select(Schedule).where(Schedule.id == schedule_id)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise ScheduleNotFoundError(f"Schedule {schedule_id} not found")

        # Remove from scheduler
        scheduler = get_scheduler()
        if scheduler.is_running:
            scheduler.remove_schedule(schedule_id)

        await self.db.delete(schedule)
        await self.db.commit()

    async def toggle_schedule(
        self,
        schedule_id: UUID,
        enabled: bool,
    ) -> ScheduleInfo:
        """Enable or disable a schedule.

        Raises:
            ScheduleNotFoundError: If schedule not found.
        """
        result = await self.db.execute(
            select(Schedule).where(Schedule.id == schedule_id)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise ScheduleNotFoundError(f"Schedule {schedule_id} not found")

        schedule.enabled = enabled
        schedule.updated_at = datetime.now(UTC)

        # Update scheduler job
        scheduler = get_scheduler()
        if scheduler.is_running:
            if enabled:
                scheduler.add_schedule(schedule)
                schedule.next_trigger_at = scheduler.get_next_run_time(schedule.id)
            else:
                scheduler.remove_schedule(schedule_id)
                schedule.next_trigger_at = None

        await self.db.commit()

        return await self.get_schedule(schedule_id)

    def _to_schedule_info(self, schedule: Schedule) -> ScheduleInfo:
        """Convert database model to ScheduleInfo."""
        return ScheduleInfo(
            id=schedule.id,
            workflow_id=schedule.workflow_id,
            workflow_name=schedule.workflow.name if schedule.workflow else None,
            target_server_id=schedule.target_server_id,
            target_server_name=(
                schedule.target_server.name if schedule.target_server else None
            ),
            cron_expression=schedule.cron_expression,
            timezone=schedule.timezone,
            start_at=schedule.start_at,
            enabled=schedule.enabled,
            description=schedule.description,
            next_trigger_at=schedule.next_trigger_at,
            last_triggered_at=schedule.last_triggered_at,
            created_at=schedule.created_at,
            updated_at=schedule.updated_at,
            created_by=schedule.created_by,
        )
