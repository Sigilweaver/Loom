"""Internal endpoints for server-to-hub communication.

These endpoints are called by registered servers to validate tokens
and retrieve credentials. They require server identity authentication
(server auth token from the server registry).

Security: These endpoints are internal and should be protected at the
network level in production (e.g., only accessible from server IPs).
"""

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.db.models import (
    Connection,
    ConnectionFilesystem,
    Execution,
    ExecutionRecord,
    GrantGroupConnection,
    Server,
    UserGroup,
    UserGroupGrantGroup,
)
from app.domain.audit import AuditService
from app.domain.auth.keys import get_key_manager
from app.domain.auth.tokens import get_token_tracker
from app.domain.executions.schemas import ExecutionReportSchema

router = APIRouter(prefix="/internal", tags=["internal"])
logger = logging.getLogger(__name__)


# Server Identity Authentication


@dataclass
class ServerIdentity:
    """Authenticated server identity."""

    server_id: UUID
    server_name: str


async def get_server_identity(
    authorization: str = Header(..., description="Bearer token for server authentication"),
    db: AsyncSession = Depends(get_db),
) -> ServerIdentity:
    """Authenticate server by its auth token.

    Servers authenticate using the auth_token configured when they were
    registered in Hub. This is a static token, not a JWT.

    Args:
        authorization: Authorization header with Bearer token.
        db: Database session.

    Returns:
        ServerIdentity with server details.

    Raises:
        HTTPException: 401 if authentication fails.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
        )

    token = authorization[7:]

    # Look up server by auth token
    result = await db.execute(select(Server).where(Server.auth_token == token))
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid server token",
        )

    return ServerIdentity(server_id=server.id, server_name=server.name)


# Request/Response Models


class ValidateRequest(BaseModel):
    """Request to validate a server token and get credentials."""

    token: str = Field(..., description="The server token to validate")
    workflow_json: dict = Field(..., description="Full workflow for hash verification")
    connection_ids: list[str] = Field(
        default_factory=list, description="Connection IDs to resolve credentials for"
    )


class ConnectionCredentials(BaseModel):
    """Resolved connection credentials for Server execution.
    
    For database connections: includes host, port, database, username, password.
    For filesystem connections: includes path, path_type.
    """

    type: str  # "database" or "filesystem"
    read_only: bool = False
    # Database fields (only for type="database")
    db_type: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None
    # Filesystem fields (only for type="filesystem")
    path: str | None = None
    path_type: str | None = None


class ValidateFilePathGrant(BaseModel):
    """File path grant for workflow execution.
    
    These are returned separately from connections because file access
    validation applies to ALL file operations in a workflow, not just
    those using explicit filesystem connections.
    """

    path: str
    read_only: bool


class ValidateResponse(BaseModel):
    """Response from token validation."""

    valid: bool
    error: str | None = None
    user_id: str | None = None
    scope: str | None = None
    connections: dict[str, ConnectionCredentials] | None = None
    constraints: dict | None = None
    file_paths: list[ValidateFilePathGrant] = Field(
        default_factory=list,
        description="User's file path grants for file access validation"
    )


# Endpoints


@router.post("/validate", response_model=ValidateResponse)
async def validate_server_token(
    request: ValidateRequest,
    server: ServerIdentity = Depends(get_server_identity),
    db: AsyncSession = Depends(get_db),
) -> ValidateResponse:
    """Validate a server token and return credentials.

    This is the core security checkpoint. Servers call this endpoint
    before executing any workflow to:
    1. Verify the token is valid and not expired
    2. Verify the token hasn't been used before (one-time use)
    3. Verify the workflow hasn't been modified (hash check)
    4. Get credentials for hub-owned connections

    Returns credentials only if all checks pass.
    """
    key_manager = get_key_manager()
    token_tracker = get_token_tracker()

    try:
        # 1. Decode and verify JWT signature, audience, issuer, expiration
        claims = jwt.decode(
            request.token,
            key_manager.public_key,
            algorithms=["RS256"],
            audience=f"server-{server.server_id}",
            issuer=settings.jwt_issuer,
        )

        jti = claims["jti"]
        exp = datetime.fromtimestamp(claims["exp"], tz=UTC)

        # 2. Check one-time use
        if not await token_tracker.mark_used(jti, exp):
            logger.warning(f"Token replay attempt: {jti[:8]}... from server {server.server_name}")
            return ValidateResponse(valid=False, error="Token already used")

        # 3. Verify workflow hash (prevent workflow swap attacks)
        expected_hash = claims.get("workflow_hash")
        if expected_hash:
            actual_hash = _compute_workflow_hash(request.workflow_json)
            if expected_hash != actual_hash:
                logger.warning(
                    f"Workflow hash mismatch for token {jti[:8]}... "
                    f"expected {expected_hash[:20]}..., got {actual_hash[:20]}..."
                )
                return ValidateResponse(
                    valid=False, error="Workflow hash mismatch - workflow was modified"
                )

        # 4. Validate requested connections match allowed
        allowed = set(claims.get("allowed_connections", []))
        requested = set(request.connection_ids)
        if not requested.issubset(allowed):
            unauthorized = requested - allowed
            logger.warning(
                f"Unauthorized connection request from server {server.server_name}: {unauthorized}"
            )
            return ValidateResponse(
                valid=False, error=f"Unauthorized connections: {unauthorized}"
            )

        # 5. Resolve credentials for requested connections
        connections: dict[str, ConnectionCredentials] = {}
        if request.connection_ids:
            from app.domain.connections import (
                ConnectionStore,
                EncryptionKeyError,
                ResolvedDatabaseConnection,
                ResolvedFilesystemConnection,
            )

            try:
                store = ConnectionStore(db)
                for conn_id in request.connection_ids:
                    resolved = await store.resolve_connection(conn_id)
                    if resolved:
                        if isinstance(resolved, ResolvedDatabaseConnection):
                            connections[conn_id] = ConnectionCredentials(
                                type="database",
                                read_only=resolved.read_only,
                                db_type=resolved.db_type.value if hasattr(resolved.db_type, 'value') else resolved.db_type,
                                host=resolved.host,
                                port=resolved.port,
                                database=resolved.database,
                                username=resolved.username,
                                password=resolved.password,
                            )
                        elif isinstance(resolved, ResolvedFilesystemConnection):
                            connections[conn_id] = ConnectionCredentials(
                                type="filesystem",
                                read_only=resolved.read_only,
                                path=resolved.path,
                                path_type=resolved.path_type.value if hasattr(resolved.path_type, 'value') else resolved.path_type,
                            )
                    else:
                        logger.warning(f"Connection {conn_id} not found in store")
            except EncryptionKeyError as e:
                logger.error(f"Connection store not available: {e}")
                # Continue without credentials if store not configured

        # 6. Get user's file path grants (ALL filesystem connections accessible via grant groups)
        # This is critical for security - restricts file access during workflow execution
        user_id = claims.get("sub", "unknown")
        file_path_grants = await _get_user_file_paths_for_validate(UUID(user_id), db)

        # 7. Log audit events
        scope = claims.get("scope", "unknown")

        audit_service = AuditService(db)

        # Log token validated
        await audit_service.log_event(
            event_type="execution.token_validated",
            actor_type="system",
            actor_identity=f"server:{server.server_name}",
            server_id=server.server_id,
            details={
                "user_id": user_id,
                "scope": scope,
                "server_name": server.server_name,
            },
        )

        # Log credentials provided (if any)
        if request.connection_ids:
            await audit_service.log_event(
                event_type="execution.credentials_provided",
                actor_type="system",
                actor_identity="hub",
                server_id=server.server_id,
                details={
                    "connection_ids": request.connection_ids,
                    "connection_count": len(request.connection_ids),
                },
            )

        await db.commit()

        logger.info(
            f"Token validated: user={user_id[:8]}..., server={server.server_name}, "
            f"scope={scope}, connections={len(request.connection_ids)}, file_paths={len(file_path_grants)}"
        )

        return ValidateResponse(
            valid=True,
            user_id=user_id,
            scope=scope,
            connections=connections if connections else None,
            constraints=claims.get("constraints"),
            file_paths=file_path_grants,
        )

    except jwt.ExpiredSignatureError:
        logger.warning(f"Expired token from server {server.server_name}")
        return ValidateResponse(valid=False, error="Token expired")
    except jwt.InvalidAudienceError:
        logger.warning(f"Invalid audience in token from server {server.server_name}")
        return ValidateResponse(valid=False, error="Token not valid for this server")
    except jwt.InvalidIssuerError:
        logger.warning(f"Invalid issuer in token from server {server.server_name}")
        return ValidateResponse(valid=False, error="Invalid token issuer")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token from server {server.server_name}: {e}")
        return ValidateResponse(valid=False, error=f"Invalid token: {e}")


def _compute_workflow_hash(workflow: dict) -> str:
    """Compute a deterministic hash of the workflow.

    Must match the hashing algorithm in CapabilityIssuer.

    Args:
        workflow: The workflow JSON.

    Returns:
        Hash string in format "sha256:hexdigest".
    """
    canonical = json.dumps(workflow, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    return f"sha256:{digest}"


@router.post("/executions/{execution_id}/report")
async def receive_execution_report(
    execution_id: UUID,
    report: ExecutionReportSchema,
    server: ServerIdentity = Depends(get_server_identity),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive execution report from Server.

    Called by Server after execution completes (success or failure).
    Creates ExecutionRecord and final AuditEvent.

    Args:
        execution_id: The execution ID.
        report: Full execution report with details.
        server: Authenticated server identity.
        db: Database session.

    Returns:
        Confirmation of receipt.
    """
    # Verify execution exists
    result = await db.execute(
        select(Execution).where(Execution.id == execution_id)
    )
    execution = result.scalar_one_or_none()

    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )

    # Verify server matches
    if execution.server_id != server.server_id:
        logger.warning(
            f"Server {server.server_name} attempted to report for execution "
            f"{execution_id} but it was assigned to server {execution.server_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Execution not assigned to this server",
        )

    # Check if record already exists (prevent duplicate reports)
    existing_record = await db.execute(
        select(ExecutionRecord).where(ExecutionRecord.execution_id == execution_id)
    )
    if existing_record.scalar_one_or_none():
        logger.warning(f"Duplicate report received for execution {execution_id}")
        return {"status": "already_received"}

    # Create execution record
    connection_ids_list = [UUID(c) if isinstance(c, str) else c for c in report.connection_ids]

    record = ExecutionRecord(
        execution_id=execution_id,
        status=report.status,
        success=report.success,
        started_at=report.started_at,
        completed_at=report.completed_at,
        duration_ms=report.duration_ms,
        output_rows=report.output_rows,
        output_columns=report.output_columns,
        output_bytes=report.output_bytes,
        error_type=report.error_type,
        connection_ids=connection_ids_list,
        details=report.details,
    )
    db.add(record)

    # Update execution status
    execution.status = report.status
    execution.success = report.success
    execution.started_at = report.started_at
    execution.completed_at = report.completed_at
    if report.duration_ms:
        execution.duration_seconds = report.duration_ms / 1000.0
    if not report.success and report.details.get("error"):
        execution.error_message = report.details["error"].get("message")

    # Log audit event
    audit_service = AuditService(db)
    event_type = "execution.completed" if report.success else "execution.failed"

    await audit_service.log_event(
        event_type=event_type,
        actor_type="system",
        actor_identity=f"server:{server.server_name}",
        execution_id=execution_id,
        workflow_id=execution.workflow_id,
        schedule_id=execution.schedule_id,
        server_id=server.server_id,
        details={
            "success": report.success,
            "status": report.status,
            "duration_ms": report.duration_ms,
            "output_rows": report.output_rows,
            "error_type": report.error_type,
        },
    )

    await db.commit()

    logger.info(
        f"Execution report received: {execution_id} "
        f"status={report.status} success={report.success} "
        f"from server {server.server_name}"
    )

    return {"status": "received"}


# =============================================================================
# Browse Token Validation
# =============================================================================


class FilePathGrant(BaseModel):
    """File path permission for browse operations."""

    path: str
    read_only: bool


class ValidateBrowseRequest(BaseModel):
    """Request to validate a browse token."""

    token: str = Field(..., description="The browse token to validate")


class ValidateBrowseResponse(BaseModel):
    """Response from browse token validation."""

    valid: bool
    error: str | None = None
    user_id: str | None = None
    file_paths: list[FilePathGrant] = Field(default_factory=list)


@router.post("/validate-browse", response_model=ValidateBrowseResponse)
async def validate_browse_token(
    request: ValidateBrowseRequest,
    server: ServerIdentity = Depends(get_server_identity),
    db: AsyncSession = Depends(get_db),
) -> ValidateBrowseResponse:
    """Validate a browse token and return file path permissions.

    This is a simpler validation than /validate - it doesn't require
    workflow hash verification or connection credentials. Used for
    file browser operations.

    Returns:
        ValidateBrowseResponse with file paths the user can access.
    """
    key_manager = get_key_manager()
    token_tracker = get_token_tracker()

    try:
        # 1. Decode and verify JWT signature, audience, issuer, expiration
        claims = jwt.decode(
            request.token,
            key_manager.public_key,
            algorithms=["RS256"],
            audience=f"server-{server.server_id}",
            issuer=settings.jwt_issuer,
        )

        jti = claims["jti"]
        exp = datetime.fromtimestamp(claims["exp"], tz=UTC)
        token_type = claims.get("type", "exec")

        # Verify this is a browse token
        if token_type != "browse":
            return ValidateBrowseResponse(
                valid=False,
                error=f"Invalid token type: expected 'browse', got '{token_type}'",
            )

        # 2. Check one-time use
        if not await token_tracker.mark_used(jti, exp):
            logger.warning(f"Browse token replay attempt: {jti[:8]}... from server {server.server_name}")
            return ValidateBrowseResponse(valid=False, error="Token already used")

        # 3. Get user's file paths via grant groups
        user_id = claims.get("sub")
        if not user_id:
            return ValidateBrowseResponse(valid=False, error="Token missing user ID")

        file_paths = await _get_user_file_paths(UUID(user_id), db)

        logger.info(
            f"Browse token validated: user={user_id[:8]}..., server={server.server_name}, "
            f"file_paths={len(file_paths)}"
        )

        return ValidateBrowseResponse(
            valid=True,
            user_id=user_id,
            file_paths=file_paths,
        )

    except jwt.ExpiredSignatureError:
        logger.warning(f"Expired browse token from server {server.server_name}")
        return ValidateBrowseResponse(valid=False, error="Token expired")
    except jwt.InvalidAudienceError:
        logger.warning(f"Invalid audience in browse token from server {server.server_name}")
        return ValidateBrowseResponse(valid=False, error="Token not valid for this server")
    except jwt.InvalidIssuerError:
        logger.warning(f"Invalid issuer in browse token from server {server.server_name}")
        return ValidateBrowseResponse(valid=False, error="Invalid token issuer")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid browse token from server {server.server_name}: {e}")
        return ValidateBrowseResponse(valid=False, error=f"Invalid token: {e}")


async def _get_user_file_paths_for_validate(user_id: UUID, db: AsyncSession) -> list[ValidateFilePathGrant]:
    """Get filesystem connections accessible to user for workflow validation.

    This is the critical security function that determines what file paths
    a user can access during workflow execution. Returns all filesystem
    connections the user has access to via their grant group memberships.

    Access path: User -> UserGroup -> UserGroupGrantGroup -> GrantGroup -> GrantGroupConnection -> Connection (type=filesystem)

    Returns:
        List of ValidateFilePathGrant with path and read_only flag.
    """
    result = await db.execute(
        select(Connection, ConnectionFilesystem)
        .join(ConnectionFilesystem, Connection.id == ConnectionFilesystem.connection_id)
        .join(GrantGroupConnection, GrantGroupConnection.connection_id == Connection.id)
        .join(UserGroupGrantGroup, UserGroupGrantGroup.grant_group_id == GrantGroupConnection.grant_group_id)
        .join(UserGroup, UserGroup.group_id == UserGroupGrantGroup.user_group_id)
        .where(UserGroup.user_id == user_id)
        .where(Connection.type == "filesystem")
        .distinct()
    )
    rows = result.all()

    return [
        ValidateFilePathGrant(path=fs.path, read_only=conn.read_only)
        for conn, fs in rows
    ]


async def _get_user_file_paths(user_id: UUID, db: AsyncSession) -> list[FilePathGrant]:
    """Get filesystem connections accessible to user via grant group membership.

    Access path: User -> UserGroup -> UserGroupGrantGroup -> GrantGroup -> GrantGroupConnection -> Connection (type=filesystem)
    """
    result = await db.execute(
        select(Connection, ConnectionFilesystem)
        .join(ConnectionFilesystem, Connection.id == ConnectionFilesystem.connection_id)
        .join(GrantGroupConnection, GrantGroupConnection.connection_id == Connection.id)
        .join(UserGroupGrantGroup, UserGroupGrantGroup.grant_group_id == GrantGroupConnection.grant_group_id)
        .join(UserGroup, UserGroup.group_id == UserGroupGrantGroup.user_group_id)
        .where(UserGroup.user_id == user_id)
        .where(Connection.type == "filesystem")
        .distinct()
    )
    rows = result.all()

    return [
        FilePathGrant(path=fs.path, read_only=conn.read_only)
        for conn, fs in rows
    ]
