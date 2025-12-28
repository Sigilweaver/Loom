"""Session management for user authentication

This module provides session token generation and database-backed session
storage. Sessions are stored in the database to allow:
- Server-side invalidation (logout, admin revocation)
- Session management UI (view active sessions)
- Expiration enforcement

Session tokens are cryptographically secure random strings. The database
stores a hash of the token, not the plaintext, so a database breach does
not directly compromise active sessions.
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Optional

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Session, User

# Token length in bytes (32 bytes = 256 bits of entropy)
TOKEN_BYTES = 32


@dataclass
class SessionInfo:
    """Information about an active session"""

    session_id: uuid.UUID
    user_id: uuid.UUID
    username: str
    role: str
    created_at: datetime
    expires_at: datetime
    last_used_at: Optional[datetime]


def generate_session_token() -> str:
    """Generate a cryptographically secure session token.

    Returns:
        A URL-safe base64-encoded random string.
    """
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> str:
    """Hash a session token for database storage.

    Uses SHA-256 which is fast (sessions are high-throughput) and
    secure for this use case since tokens have high entropy.

    Args:
        token: The plaintext session token.

    Returns:
        Hex-encoded SHA-256 hash of the token.
    """
    return hashlib.sha256(token.encode()).hexdigest()


def _utcnow() -> datetime:
    """Get current UTC time as timezone-aware datetime."""
    return datetime.now(UTC)


class SessionManager:
    """Manages user sessions with database storage."""

    def __init__(self, db: AsyncSession):
        """Initialize session manager.

        Args:
            db: Async database session.
        """
        self.db = db

    async def create_session(
        self,
        user: User,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        lifetime_hours: Optional[int] = None,
    ) -> str:
        """Create a new session for a user.

        Args:
            user: The user to create a session for.
            user_agent: Client's User-Agent header (for session management UI).
            ip_address: Client's IP address (for session management UI).
            lifetime_hours: Session lifetime in hours. Defaults to config value.

        Returns:
            The plaintext session token (to be sent to client).
        """
        token = generate_session_token()
        token_hash = hash_token(token)

        lifetime = lifetime_hours or settings.session_lifetime_hours
        expires_at = _utcnow() + timedelta(hours=lifetime)

        session = Session(
            user_id=user.id,
            token_hash=token_hash,
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=expires_at,
        )

        self.db.add(session)
        await self.db.commit()

        return token

    async def validate_session(self, token: str) -> Optional[SessionInfo]:
        """Validate a session token and return session info.

        Also updates the last_used_at timestamp for the session.

        Args:
            token: The plaintext session token from the client.

        Returns:
            SessionInfo if valid, None if invalid or expired.
        """
        token_hash = hash_token(token)
        now = _utcnow()

        # Find session with matching token that hasn't expired
        stmt = (
            select(Session, User)
            .join(User, Session.user_id == User.id)
            .where(Session.token_hash == token_hash)
            .where(Session.expires_at > now)
        )

        result = await self.db.execute(stmt)
        row = result.first()

        if row is None:
            return None

        session, user = row[0], row[1]

        # Update last_used_at
        await self.db.execute(
            update(Session)
            .where(Session.id == session.id)
            .values(last_used_at=now)
        )
        await self.db.commit()

        return SessionInfo(
            session_id=session.id,
            user_id=user.id,
            username=user.username,
            role=user.role,
            created_at=session.created_at,
            expires_at=session.expires_at,
            last_used_at=now,
        )

    async def invalidate_session(self, token: str) -> bool:
        """Invalidate a session (logout).

        Args:
            token: The plaintext session token to invalidate.

        Returns:
            True if a session was invalidated, False if not found.
        """
        token_hash = hash_token(token)

        result = await self.db.execute(
            delete(Session).where(Session.token_hash == token_hash)
        )
        await self.db.commit()

        return result.rowcount > 0

    async def invalidate_all_user_sessions(self, user_id: uuid.UUID) -> int:
        """Invalidate all sessions for a user (logout everywhere).

        Args:
            user_id: The user ID whose sessions should be invalidated.

        Returns:
            Number of sessions invalidated.
        """
        result = await self.db.execute(
            delete(Session).where(Session.user_id == user_id)
        )
        await self.db.commit()

        return result.rowcount

    async def get_user_sessions(self, user_id: uuid.UUID) -> list[Session]:
        """Get all active sessions for a user.

        Args:
            user_id: The user ID to get sessions for.

        Returns:
            List of active (non-expired) sessions.
        """
        now = _utcnow()

        stmt = (
            select(Session)
            .where(Session.user_id == user_id)
            .where(Session.expires_at > now)
            .order_by(Session.created_at.desc())
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions from the database.

        This should be called periodically (e.g., via scheduled task)
        to clean up stale session records.

        Returns:
            Number of sessions deleted.
        """
        now = _utcnow()

        result = await self.db.execute(
            delete(Session).where(Session.expires_at <= now)
        )
        await self.db.commit()

        return result.rowcount
