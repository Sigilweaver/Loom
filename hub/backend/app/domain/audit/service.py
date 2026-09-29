"""Audit service for creating and querying audit events.

Provides immutable, hash-chained audit trail for compliance.
"""

import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditEvent

logger = logging.getLogger(__name__)

# Rows written before the hash was reproducible (see #110) carry version 1.
# Their content hash cannot be recomputed, so they are reported as legacy.
HASH_VERSION_LEGACY = 1
HASH_VERSION_CURRENT = 2

# Fixed key for the transaction-scoped advisory lock that serializes writers
# to the audit chain ("AUDT" in ASCII).
_AUDIT_CHAIN_LOCK_KEY = 0x41554454


def _short(digest: str | None) -> str:
    """Abbreviate a hash for error messages."""
    return f"{digest[:16]}..." if digest else "None"


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
        # Serialize previous-hash read + insert so concurrent writers cannot
        # fork the chain, then assign id and timestamp BEFORE hashing so the
        # hash can be reproduced from the stored columns at verify time.
        previous_hash, previous_ts = await self._lock_and_get_tail()
        timestamp = datetime.now(UTC)
        if previous_ts is not None and timestamp <= previous_ts:
            # Keep (timestamp, id) ordering aligned with chain order.
            timestamp = previous_ts + timedelta(microseconds=1)

        event = AuditEvent(
            id=uuid4(),
            timestamp=timestamp,
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
            hash_version=HASH_VERSION_CURRENT,
            event_hash="",  # Will be computed
        )

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
        ts = event.timestamp
        if ts.tzinfo is None:
            # SQLite drops tzinfo on read; timestamps are always written as UTC.
            ts = ts.replace(tzinfo=UTC)
        timestamp_str = ts.astimezone(UTC).isoformat()
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
                "auth_method": event.auth_method,
                "client_ip": event.client_ip,
                "user_agent": event.user_agent,
                "server_id": str(event.server_id) if event.server_id else None,
                "details": event.details,
                "previous_hash": previous_hash,
            },
            sort_keys=True,
        )
        return hashlib.sha256(canonical.encode()).hexdigest()

    async def _lock_and_get_tail(self) -> tuple[str | None, datetime | None]:
        """Serialize chain writers and return the current chain tail.

        On PostgreSQL this takes a transaction-scoped advisory lock, released
        at commit/rollback, so the previous-hash read and the insert that
        follows cannot interleave with another writer. SQLite serializes
        writes on its own, so no lock is taken there.

        Returns:
            (event_hash, timestamp) of the most recent event, or (None, None)
            if no events exist.
        """
        bind = self.db.get_bind()
        if bind.dialect.name == "postgresql":
            await self.db.execute(
                text("SELECT pg_advisory_xact_lock(:key)"), {"key": _AUDIT_CHAIN_LOCK_KEY}
            )
        result = await self.db.execute(
            select(AuditEvent.event_hash, AuditEvent.timestamp)
            .order_by(desc(AuditEvent.timestamp), desc(AuditEvent.id))
            .limit(1)
        )
        row = result.first()
        if row is None:
            return None, None
        ts = row[1]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        return row[0], ts

    async def verify_chain(self, limit: int = 1000) -> dict[str, Any]:
        """Verify hash chain integrity for recent events.

        For events with hash_version >= 2, checks that the stored hash matches
        the event's content and that previous_hash equals the preceding
        event's stored hash (detecting edits and deleted or reordered events).
        Legacy (version 1) events were hashed before id and timestamp were
        assigned, so neither their content hash nor their linkage can be
        verified; they are counted in ``legacy_events`` and are not reported
        as tampering.

        Args:
            limit: Maximum number of events to verify.

        Returns:
            Dict with verification results:
            - valid: True if no tampering was detected
            - events_checked: Number of events examined
            - first_event_id: ID of oldest event checked
            - last_event_id: ID of newest event checked
            - legacy_events: Number of examined events that are unverifiable (legacy)
            - warning: Note about legacy events, if any
            - error: Error message if invalid
        """
        # Fetch one extra (oldest) row as a linkage anchor for the window.
        result = await self.db.execute(
            select(AuditEvent)
            .order_by(desc(AuditEvent.timestamp), desc(AuditEvent.id))
            .limit(limit + 1)
        )
        rows = list(result.scalars().all())
        rows.reverse()  # oldest to newest

        anchor: AuditEvent | None = None
        if len(rows) > limit:
            anchor = rows.pop(0)
        events = rows

        if not events:
            return {
                "valid": True,
                "events_checked": 0,
                "first_event_id": None,
                "last_event_id": None,
                "legacy_events": 0,
            }

        legacy = 0
        for i, event in enumerate(events):
            if event.hash_version < HASH_VERSION_CURRENT:
                legacy += 1
                continue

            predecessor = events[i - 1] if i > 0 else anchor
            if predecessor is not None and event.previous_hash != predecessor.event_hash:
                return self._failure(
                    events,
                    i,
                    legacy,
                    f"Chain broken at event {event.id}: "
                    f"expected previous_hash {_short(predecessor.event_hash)}, "
                    f"got {_short(event.previous_hash)}",
                )

            computed = self._compute_hash(event, event.previous_hash)
            if computed != event.event_hash:
                return self._failure(
                    events,
                    i,
                    legacy,
                    f"Hash mismatch at event {event.id}: "
                    f"stored {event.event_hash[:16]}..., "
                    f"computed {computed[:16]}...",
                )

        response: dict[str, Any] = {
            "valid": True,
            "events_checked": len(events),
            "first_event_id": str(events[0].id),
            "last_event_id": str(events[-1].id),
            "legacy_events": legacy,
        }
        if legacy:
            response["warning"] = (
                f"{legacy} event(s) are unverifiable (legacy): written before "
                "the hash chain was reproducible"
            )
        return response

    @staticmethod
    def _failure(events: list[AuditEvent], index: int, legacy: int, error: str) -> dict[str, Any]:
        """Build a verification failure result for the event at ``index``."""
        return {
            "valid": False,
            "events_checked": index,
            "first_event_id": str(events[0].id),
            "last_event_id": str(events[index].id),
            "legacy_events": legacy,
            "error": error,
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
