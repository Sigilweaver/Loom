"""
Connection resolver for workflow execution.

Resolves server-managed connection references in workflows before execution.
This is the single point where connection IDs are converted to connection URIs.

Future: Add RBAC checks here (can this user access this connection?).
"""

import logging

from app.api.models.workflow import Tool, Workflow
from app.domain.connections.store import ConnectionStore, get_connection_store
from app.utils.errors import ExecutionError

logger = logging.getLogger(__name__)


class ConnectionResolver:
    """
    Resolves connection references in workflows.
    
    For server-owned connections (owner="server"), resolves connectionId to a
    full connection URI with embedded credentials.
    
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

    def resolve_workflow_connections(self, workflow: Workflow) -> Workflow:
        """
        Resolve all server connections in a workflow.
        
        Iterates through all tools and resolves server-owned database connections
        by injecting the connection URI into the tool config.
        
        Args:
            workflow: The workflow to resolve connections for
            
        Returns:
            A new Workflow with resolved connections (tool configs modified)
            
        Raises:
            ExecutionError: If a connection cannot be resolved or is unauthorized
        """
        # Find all database tools that need server connection resolution
        server_connections = self._find_server_connections(workflow)

        if not server_connections:
            # No server connections to resolve
            return workflow

        # Validate all connections exist before modifying anything (fail-fast)
        self._validate_connections_exist(server_connections)

        # Future: Add RBAC authorization check here
        # self._authorize_connections(server_connections, user)

        # Resolve all connections
        resolved_tools = []
        for tool in workflow.tools:
            if tool.id in server_connections:
                resolved_tool = self._resolve_tool_connection(tool)
                resolved_tools.append(resolved_tool)
            else:
                resolved_tools.append(tool)

        # Return new workflow with resolved tools
        return Workflow(
            meta=workflow.meta,
            tools=resolved_tools,
            wires=workflow.wires,
        )

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
        return owner == "server"

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
