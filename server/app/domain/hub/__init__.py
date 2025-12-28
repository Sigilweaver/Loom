"""Hub integration for Server.

This module provides the client used by Server to communicate with Hub
for token validation and credential resolution in hub auth mode.
"""

from app.domain.hub.client import HubClient, ValidationResult, get_hub_client

__all__ = ["HubClient", "ValidationResult", "get_hub_client"]
