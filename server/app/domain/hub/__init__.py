"""Hub integration for Server.

This module provides the client used by Server to communicate with Hub
for token authorization and credential resolution in hub auth mode.
"""

from app.domain.hub.client import (
    AuthorizationResult,
    FilePathGrant,
    HubClient,
    get_hub_client,
)

__all__ = [
    "AuthorizationResult",
    "FilePathGrant",
    "HubClient",
    "get_hub_client",
]
