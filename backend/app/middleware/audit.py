"""Audit logging middleware for request/response tracking"""

import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings


def setup_audit_logger() -> logging.Logger:
    """Configure a dedicated audit logger that writes to file."""
    logger = logging.getLogger("audit")
    logger.setLevel(logging.INFO)
    logger.propagate = False  # Don't send to root logger

    # Clear any existing handlers
    logger.handlers.clear()

    if settings.audit_enabled:
        # Ensure audit directory exists
        audit_path = Path(settings.audit_path)
        audit_path.mkdir(parents=True, exist_ok=True)

        # Create file handler with date-based filename
        log_file = audit_path / f"audit_{datetime.now().strftime('%Y-%m-%d')}.log"
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.INFO)

        # JSON-like format for easy parsing
        formatter = logging.Formatter("%(message)s")
        file_handler.setFormatter(formatter)

        logger.addHandler(file_handler)

    return logger


def cleanup_old_audit_logs() -> int:
    """
    Remove audit logs older than retention period.
    
    Returns:
        Number of files deleted
    """
    if not settings.audit_enabled or settings.audit_retention_days <= 0:
        return 0

    audit_path = Path(settings.audit_path)
    if not audit_path.exists():
        return 0

    cutoff = datetime.now() - timedelta(days=settings.audit_retention_days)
    deleted = 0

    for log_file in audit_path.glob("audit_*.log"):
        try:
            # Parse date from filename (audit_YYYY-MM-DD.log)
            date_str = log_file.stem.replace("audit_", "")
            file_date = datetime.strptime(date_str, "%Y-%m-%d")

            if file_date < cutoff:
                log_file.unlink()
                deleted += 1
        except (ValueError, OSError):
            continue

    return deleted


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware for structured audit logging of HTTP requests.
    
    Logs:
    - Request ID, timestamp, method, path
    - Client IP, user agent
    - Response status code and duration
    - Request body for mutation endpoints (POST/PUT/DELETE)
    """

    # Endpoints to skip logging (health checks, static files)
    SKIP_PATHS = {"/api/health", "/api/health/", "/docs", "/redoc", "/openapi.json"}

    # Max body size to log (avoid logging huge payloads)
    MAX_BODY_LOG_SIZE = 10000

    def __init__(self, app, logger: logging.Logger | None = None):
        super().__init__(app)
        self.logger = logger or setup_audit_logger()
        # Run cleanup on startup
        if settings.audit_enabled:
            deleted = cleanup_old_audit_logs()
            if deleted > 0:
                self.logger.info(json.dumps({
                    "type": "cleanup",
                    "deleted_files": deleted,
                    "retention_days": settings.audit_retention_days
                }))

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip logging for certain paths
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        # Skip if audit disabled
        if not settings.audit_enabled:
            return await call_next(request)

        request_id = str(uuid.uuid4())[:8]
        start_time = time.perf_counter()
        timestamp = datetime.now().isoformat()

        # Extract client info
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "unknown")[:100]

        # Read body for mutation requests
        body_summary = None
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            body_summary = await self._get_body_summary(request)

        # Process request
        try:
            response = await call_next(request)
            status_code = response.status_code
            error = None
        except Exception as e:
            status_code = 500
            error = str(e)[:200]
            raise
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Build audit record
            audit_record = {
                "timestamp": timestamp,
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params) if request.query_params else None,
                "client_ip": client_ip,
                "user_agent": user_agent,
                "status_code": status_code,
                "duration_ms": round(duration_ms, 2),
            }

            if body_summary:
                audit_record["body_summary"] = body_summary

            if error:
                audit_record["error"] = error

            # Log as JSON
            self.logger.info(json.dumps(audit_record))

        return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, handling proxies."""
        # Check X-Forwarded-For header (common for proxied requests)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()

        # Check X-Real-IP header
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fall back to direct client
        if request.client:
            return request.client.host

        return "unknown"

    async def _get_body_summary(self, request: Request) -> str | None:
        """Get a summary of the request body for audit purposes."""
        try:
            body = await request.body()
            if not body:
                return None

            # Truncate if too large
            if len(body) > self.MAX_BODY_LOG_SIZE:
                return f"[{len(body)} bytes, truncated]"

            # Try to parse as JSON and summarize
            try:
                data = json.loads(body)
                # For workflows, just log tool count and wire count
                if isinstance(data, dict):
                    if "tools" in data and "wires" in data:
                        return f"workflow: {len(data.get('tools', []))} tools, {len(data.get('wires', []))} wires"
                    # For other objects, list top-level keys
                    keys = list(data.keys())[:5]
                    if len(data.keys()) > 5:
                        keys.append(f"...+{len(data.keys()) - 5} more")
                    return f"json: {{{', '.join(keys)}}}"
                elif isinstance(data, list):
                    return f"json: [{len(data)} items]"
            except json.JSONDecodeError:
                pass

            # Non-JSON body
            return f"[{len(body)} bytes]"

        except Exception:
            return None
