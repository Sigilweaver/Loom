"""Audit service for creating and querying audit events.

Provides immutable, hash-chained audit trail for compliance.
"""

import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditEvent

logger = logging.getLogger(__name__)


class AuditService:
    """Service for creating and querying audit events.

    Audit events are immutable and hash-chained for tamper evidence.
    Each event contains a hash of itself plus the previous event's hash,
    creating a verifiable chain.
    """

    def __init__(self, db: AsyncSession):
        """Initialize audit service.

        Args:
            db: Async database session.
        """
        self.db = db

    async def log_event(
        self,
        event_type: str,
        actor_type: str,
        actor_identity: str,
        *,
        execution_id: UUID | None = None,
        workflow_id: UUID | None = None,
        schedule_id: UUID | None = None,
        actor_id: UUID | None = None,
        auth_method: str | None = None,
        client_ip: str | None = None,
        user_agent: str | None = None,
        server_id: UUID | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditEvent:
        """Create an immutable audit event with hash chain.

        Args:
            event_type: Type of event (e.g., "execution.requested").
            actor_type: Type of actor ("user", "schedule", "system").
            actor_identity: Human-readable identity (username, schedule name).
            execution_id: Associated execution ID.
            workflow_id: Associated workflow ID.
            schedule_id: Associated schedule ID.
            actor_id: Actor's UUID (user ID, etc.).
            auth_method: Authentication method used.
            client_ip: Client IP address.
            user_agent: Client user agent string.
            server_id: Target server ID.
            details: Event-specific details (small - IDs and outcomes only).

        Returns:
            The created AuditEvent.
        """
        # Get previous hash for chain
        previous_hash = await self._get_previous_hash()

        # Create event (without hash initially)
        event = AuditEvent(
            event_type=event_type,
            execution_id=execution_id,
            workflow_id=workflow_id,
            schedule_id=schedule_id,
            actor_type=actor_type,
            actor_id=actor_id,
            actor_identity=actor_identity,
            auth_method=auth_method,
            client_ip=client_ip,
            user_agent=user_agent,
            server_id=server_id,
            details=details or {},
            previous_hash=previous_hash,
            event_hash="",  # Will be computed
        )

        # Compute hash
        event.event_hash = self._compute_hash(event, previous_hash)

        # Save
        self.db.add(event)
        await self.db.flush()

        logger.debug(
            f"Audit event logged: {event_type} by {actor_identity} "
            f"(hash: {event.event_hash[:16]}...)"
        )

        return event

    def _compute_hash(self, event: AuditEvent, previous_hash: str | None) -> str:
        """Compute SHA-256 hash for event integrity.

        Creates a deterministic hash of the event content plus the previous
        event's hash, forming a tamper-evident chain.

        Args:
            event: The event to hash.
            previous_hash: Hash of the previous event in the chain.

        Returns:
            SHA-256 hex digest.
        """
        timestamp_str = (
            event.timestamp.isoformat() if event.timestamp else datetime.now(UTC).isoformat()
        )
        canonical = json.dumps(
            {
                "id": str(event.id),
                "timestamp": timestamp_str,
                "event_type": event.event_type,
                "execution_id": str(event.execution_id) if event.execution_id else None,
                "workflow_id": str(event.workflow_id) if event.workflow_id else None,
                "schedule_id": str(event.schedule_id) if event.schedule_id else None,
                "actor_type": event.actor_type,
                "actor_id": str(event.actor_id) if event.actor_id else None,
                "actor_identity": event.actor_identity,
                "details": event.details,
                "previous_hash": previous_hash,
            },
            sort_keys=True,
        )
        return hashlib.sha256(canonical.encode()).hexdigest()

    async def _get_previous_hash(self) -> str | None:
        """Get hash of most recent audit event.

        Returns:
            The event_hash of the most recent event, or None if no events exist.
        """
        result = await self.db.execute(
            select(AuditEvent.event_hash)
            .order_by(desc(AuditEvent.timestamp), desc(AuditEvent.id))
            .limit(1)
        )
        row = result.first()
        return row[0] if row else None

    async def verify_chain(self, limit: int = 1000) -> dict[str, Any]:
        """Verify hash chain integrity for recent events.

        Checks that each event's hash correctly includes the previous
        event's hash, detecting any tampering.

        Args:
            limit: Maximum number of events to verify.

        Returns:
            Dict with verification results:
            - valid: True if chain is intact
            - events_checked: Number of events verified
            - first_event_id: ID of oldest event checked
            - last_event_id: ID of newest event checked
            - error: Error message if invalid
        """
        result = await self.db.execute(
            select(AuditEvent)
            .order_by(desc(AuditEvent.timestamp), desc(AuditEvent.id))
            .limit(limit)
        )
        events = list(result.scalars().all())

        if not events:
            return {
                "valid": True,
                "events_checked": 0,
                "first_event_id": None,
                "last_event_id": None,
            }

        # Reverse to check from oldest to newest
        events.reverse()

        for i, event in enumerate(events):
            expected_previous = events[i - 1].event_hash if i > 0 else event.previous_hash
            if event.previous_hash != expected_previous:
                return {
                    "valid": False,
                    "events_checked": i,
                    "first_event_id": str(events[0].id),
                    "last_event_id": str(event.id),
                    "error": f"Chain broken at event {event.id}: "
                    f"expected previous_hash {expected_previous[:16] if expected_previous else 'None'}..., "
                    f"got {event.previous_hash[:16] if event.previous_hash else 'None'}...",
                }

            # Verify event's own hash
            computed = self._compute_hash(event, event.previous_hash)
            if computed != event.event_hash:
                return {
                    "valid": False,
                    "events_checked": i,
                    "first_event_id": str(events[0].id),
                    "last_event_id": str(event.id),
                    "error": f"Hash mismatch at event {event.id}: "
                    f"stored {event.event_hash[:16]}..., "
                    f"computed {computed[:16]}...",
                }

        return {
            "valid": True,
            "events_checked": len(events),
            "first_event_id": str(events[0].id),
            "last_event_id": str(events[-1].id),
        }

    async def list_events(
        self,
        *,
        execution_id: UUID | None = None,
        workflow_id: UUID | None = None,
        actor_id: UUID | None = None,
        event_type: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditEvent], int]:
        """List audit events with filtering.

        Args:
            execution_id: Filter by execution.
            workflow_id: Filter by workflow.
            actor_id: Filter by actor.
            event_type: Filter by event type.
            from_date: Filter events after this time.
            to_date: Filter events before this time.
            limit: Maximum results.
            offset: Pagination offset.

        Returns:
            Tuple of (events, total_count).
        """
        query = select(AuditEvent)

        if execution_id:
            query = query.where(AuditEvent.execution_id == execution_id)
        if workflow_id:
            query = query.where(AuditEvent.workflow_id == workflow_id)
        if actor_id:
            query = query.where(AuditEvent.actor_id == actor_id)
        if event_type:
            query = query.where(AuditEvent.event_type == event_type)
        if from_date:
            query = query.where(AuditEvent.timestamp >= from_date)
        if to_date:
            query = query.where(AuditEvent.timestamp <= to_date)

        # Count total
        from sqlalchemy import func

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination and ordering
        query = (
            query.order_by(desc(AuditEvent.timestamp), desc(AuditEvent.id))
            .offset(offset)
            .limit(limit)
        )

        result = await self.db.execute(query)
        events = list(result.scalars().all())

        return events, total
