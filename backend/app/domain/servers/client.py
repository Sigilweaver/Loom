"""HTTP client for communicating with Sigilweaver Server instances"""

import logging
from dataclasses import dataclass

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class HealthResponse:
    """Response from server health endpoint"""

    status: str
    version: str | None = None


@dataclass
class ServerError:
    """Error from server communication"""

    message: str
    status_code: int | None = None


class ServerClient:
    """HTTP client for a single Sigilweaver Server instance"""

    def __init__(self, endpoint_url: str, auth_token: str | None = None):
        """Initialize client for a server.

        Args:
            endpoint_url: Base URL of the server (e.g., "http://server:58000")
            auth_token: Optional auth token for the server
        """
        self.endpoint_url = endpoint_url.rstrip("/")
        self.auth_token = auth_token
        self.timeout = settings.server_timeout_seconds

    def _get_headers(self) -> dict[str, str]:
        """Get headers for requests, including auth if configured"""
        headers = {"Accept": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    async def health(self) -> HealthResponse | ServerError:
        """Check server health.

        Returns:
            HealthResponse if successful, ServerError if failed
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(
                    f"{self.endpoint_url}/api/health/",
                    headers=self._get_headers(),
                )

                if response.status_code == 200:
                    data = response.json()
                    return HealthResponse(
                        status=data.get("status", "ok"),
                        version=data.get("version"),
                    )
                else:
                    return ServerError(
                        message=f"Server returned {response.status_code}",
                        status_code=response.status_code,
                    )

        except httpx.ConnectError as e:
            logger.debug("Connection error to %s: %s", self.endpoint_url, e)
            return ServerError(message="Connection refused")

        except httpx.TimeoutException:
            logger.debug("Timeout connecting to %s", self.endpoint_url)
            return ServerError(message="Connection timeout")

        except Exception as e:
            logger.warning("Unexpected error polling %s: %s", self.endpoint_url, e)
            return ServerError(message=str(e))

    async def execute(self, workflow_content: bytes) -> dict | ServerError:
        """Execute a workflow on this server.

        Args:
            workflow_content: Raw .swwf file content

        Returns:
            Execution result dict if successful, ServerError if failed
        """
        try:
            async with httpx.AsyncClient(timeout=settings.server_timeout_seconds * 10) as client:
                response = await client.post(
                    f"{self.endpoint_url}/api/workflow/execute",
                    headers=self._get_headers(),
                    content=workflow_content,
                )

                if response.status_code == 200:
                    return response.json()
                else:
                    return ServerError(
                        message=f"Execution failed: {response.status_code}",
                        status_code=response.status_code,
                    )

        except httpx.TimeoutException:
            return ServerError(message="Execution timeout")

        except Exception as e:
            logger.error("Execution error on %s: %s", self.endpoint_url, e)
            return ServerError(message=str(e))

    async def get_connections(self) -> list[dict] | ServerError:
        """Get available connections from the server.

        Returns:
            List of connection info dicts if successful, ServerError if failed
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.endpoint_url}/api/connections",
                    headers=self._get_headers(),
                )

                if response.status_code == 200:
                    return response.json()
                else:
                    return ServerError(
                        message=f"Failed to get connections: {response.status_code}",
                        status_code=response.status_code,
                    )

        except Exception as e:
            return ServerError(message=str(e))
