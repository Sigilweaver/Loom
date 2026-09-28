"""
Connection resolver for workflow execution.

Resolves server-managed and hub-managed connection references in workflows
before execution. This is the single point where connection IDs are converted
to connection URIs.

Connection ownership types:
- server: Credentials stored locally on this Server instance
- hub: Credentials managed by Hub, provided via token validation
- client: Credentials managed by client (Studio), passed in request

Future: Add RBAC checks here (can this user access this connection?).
"""

import logging

from app.domain.connections.models import ResolvedConnection
from app.domain.connections.store import ConnectionStore, get_connection_store
from app.domain.connections.uri import build_connection_uri
from app.domain.models.workflow import Tool, Workflow
from app.utils.errors import ExecutionError

logger = logging.getLogger(__name__)


class ConnectionResolver:
    """
    Resolves connection references in workflows.

    For server-owned connections (owner="server"), resolves connectionId to a
    full connection URI with embedded credentials from local store.

    For hub-owned connections (owner="hub"), uses credentials provided by Hub
    via token validation.

    For client-owned connections (owner="client"), the client is expected to
    have already resolved the connection - this class validates that source
    is present.

    Future: Add user context for RBAC authorization checks.
    """

    def __init__(self, connection_store: ConnectionStore | None = None):
        """
        Initialize the resolver.

        Args:
            connection_store: Optional store instance (uses singleton if None)
        """
        self._store = connection_store

    @property
    def store(self) -> ConnectionStore:
        """Get the connection store (lazy initialization)."""
        if self._store is None:
            self._store = get_connection_store()
        return self._store

    def resolve_workflow_connections(
        self,
        workflow: Workflow,
        hub_connections: dict[str, ResolvedConnection] | None = None,
    ) -> Workflow:
        """
        Resolve all server and hub connections in a workflow.

        Iterates through all tools and resolves database connections by
        injecting the connection URI into the tool config.

        Args:
            workflow: The workflow to resolve connections for
            hub_connections: Hub-provided credentials for hub-owned connections

        Returns:
            A new Workflow with resolved connections (tool configs modified)

        Raises:
            ExecutionError: If a connection cannot be resolved or is unauthorized
        """
        # Find all database tools that need connection resolution
        server_connections = self._find_server_connections(workflow)
        hub_connection_refs = self._find_hub_connections(workflow)

        if not server_connections and not hub_connection_refs:
            # No connections to resolve
            return workflow

        # Validate server connections exist (fail-fast)
        if server_connections:
            self._validate_connections_exist(server_connections)

        # Validate hub connections are provided (fail-fast)
        if hub_connection_refs:
            self._validate_hub_connections_provided(hub_connection_refs, hub_connections)

        # Resolve all connections
        provided_hub_connections = hub_connections or {}
        resolved_tools = []
        for tool in workflow.tools:
            if tool.id in server_connections:
                resolved_tool = self._resolve_tool_connection(tool)
                resolved_tools.append(resolved_tool)
            elif tool.id in hub_connection_refs:
                connection_id = hub_connection_refs[tool.id]
                hub_conn = provided_hub_connections[connection_id]
                resolved_tool = self._resolve_hub_tool_connection(tool, hub_conn)
                resolved_tools.append(resolved_tool)
            else:
                resolved_tools.append(tool)

        # Return a copy with resolved tools; every other field (version, engines)
        # is carried over unchanged
        return workflow.model_copy(update={"tools": resolved_tools})

    def _find_server_connections(self, workflow: Workflow) -> dict[str, str]:
        """
        Find all tools with server-owned connections.

        Returns:
            Dict of tool_id -> connection_id for server-owned database tools
        """
        server_connections: dict[str, str] = {}

        for tool in workflow.tools:
            if self._is_server_database_tool(tool):
                connection_id = tool.config.get("connectionId")
                if connection_id:
                    server_connections[tool.id] = connection_id

        return server_connections

    def _is_server_database_tool(self, tool: Tool) -> bool:
        """Check if a tool is a server-owned database input."""
        if tool.type != "Input":
            return False
        if tool.config.get("category") != "database":
            return False
        # Already has source URI - no resolution needed
        if tool.config.get("source"):
            return False
        # Must be server-owned
        owner = tool.config.get("owner", "client")
        return bool(owner == "server")

    def _find_hub_connections(self, workflow: Workflow) -> dict[str, str]:
        """
        Find all tools with hub-owned connections.

        Returns:
            Dict of tool_id -> connection_id for hub-owned database tools
        """
        hub_connections: dict[str, str] = {}

        for tool in workflow.tools:
            if self._is_hub_database_tool(tool):
                connection_id = tool.config.get("connectionId")
                if connection_id:
                    hub_connections[tool.id] = connection_id

        return hub_connections

    def _is_hub_database_tool(self, tool: Tool) -> bool:
        """Check if a tool is a hub-owned database input."""
        if tool.type != "Input":
            return False
        if tool.config.get("category") != "database":
            return False
        # Already has source URI - no resolution needed
        if tool.config.get("source"):
            return False
        # Must be hub-owned
        owner = tool.config.get("owner", "client")
        return bool(owner == "hub")

    def _validate_hub_connections_provided(
        self,
        hub_connection_refs: dict[str, str],
        hub_connections: dict[str, ResolvedConnection] | None,
    ) -> None:
        """
        Validate that all hub connection credentials were provided.

        Raises:
            ExecutionError: If hub connections are needed but not provided
        """
        if not hub_connections:
            raise ExecutionError(
                "Workflow uses hub-owned connections but no hub credentials provided. "
                "Ensure auth_mode='hub' and valid Bearer token is passed."
            )

        for tool_id, connection_id in hub_connection_refs.items():
            if connection_id not in hub_connections:
                raise ExecutionError(
                    f"Tool {tool_id}: Hub connection '{connection_id}' not authorized. "
                    "User may not have access to this connection."
                )

    def _resolve_hub_tool_connection(self, tool: Tool, connection: ResolvedConnection) -> Tool:
        """
        Resolve a single tool's hub connection using provided credentials.

        Args:
            tool: The tool to resolve
            connection: Resolved connection with decrypted credentials

        Returns:
            New Tool with resolved connection URI in config
        """
        uri = self._build_uri(connection)

        # Create new config with source URI
        new_config = dict(tool.config)
        new_config["source"] = uri

        logger.info(
            f"Tool {tool.id}: Resolved hub connection '{connection.id}' ({connection.name})"
        )

        # Return new Tool with updated config
        return Tool(
            id=tool.id,
            type=tool.type,
            x=tool.x,
            y=tool.y,
            config=new_config,
            sockets=tool.sockets,
        )

    def _build_uri(self, connection: ResolvedConnection) -> str:
        """Build a database URI from a resolved connection."""
        return build_connection_uri(connection)

    def _validate_connections_exist(self, server_connections: dict[str, str]) -> None:
        """
        Validate that all referenced connections exist.

        Raises:
            ExecutionError: If store is not enabled or any connection not found
        """
        if not server_connections:
            return

        if not self.store.is_enabled:
            raise ExecutionError(
                "Server connection store not enabled. "
                "Set CONNECTION_ENCRYPTION_KEY environment variable."
            )

        for tool_id, connection_id in server_connections.items():
            if not self.store.has_connection(connection_id):
                raise ExecutionError(
                    f"Tool {tool_id}: Server connection '{connection_id}' not found"
                )

    def _resolve_tool_connection(self, tool: Tool) -> Tool:
        """
        Resolve a single tool's server connection.

        Returns:
            New Tool with resolved connection URI in config
        """
        connection_id = tool.config.get("connectionId")
        if not connection_id or not isinstance(connection_id, str):
            raise ExecutionError(f"Tool {tool.id}: Missing or invalid connectionId")

        uri = self.store.build_connection_uri(connection_id)
        if not uri:
            raise ExecutionError(
                f"Tool {tool.id}: Failed to build URI for connection '{connection_id}'"
            )

        # Create new config with source URI
        new_config = dict(tool.config)
        new_config["source"] = uri

        logger.info(f"Tool {tool.id}: Resolved server connection '{connection_id}'")

        # Return new Tool with updated config
        return Tool(
            id=tool.id,
            type=tool.type,
            x=tool.x,
            y=tool.y,
            config=new_config,
            sockets=tool.sockets,
        )

    def validate_client_connections(self, workflow: Workflow) -> None:
        """
        Validate that client-owned connections have been resolved.

        Client connections should have their source URI already populated
        by the frontend before sending to the backend.

        Raises:
            ExecutionError: If a client connection is missing its source URI
        """
        for tool in workflow.tools:
            if tool.type != "Input":
                continue
            if tool.config.get("category") != "database":
                continue

            owner = tool.config.get("owner", "client")
            connection_id = tool.config.get("connectionId")
            source = tool.config.get("source")

            # Client-owned with connectionId but no source = error
            if owner == "client" and connection_id and not source:
                raise ExecutionError(
                    f"Tool {tool.id}: Client-owned connection '{connection_id}' not resolved. "
                    "Client must provide 'source' URI for client-managed connections."
                )


def get_connection_resolver() -> ConnectionResolver:
    """
    Get a ConnectionResolver instance.

    This is the FastAPI dependency function.
    """
    return ConnectionResolver()
