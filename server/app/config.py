"""Configuration management for the backend service"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # Server
    host: str = "0.0.0.0"
    port: int = 58000  # High port to avoid collisions with common services
    reload: bool = False
    log_level: str = "info"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173"]  # Vite dev server default
    cors_mode: str = "development"  # "development" (permissive) | "production" (strict)

    # Execution limits
    max_execution_time_seconds: int = 300
    max_memory_mb: int = 4096
    max_preview_rows: int = 10000

    # Security - File Access
    allowed_file_paths: list[str] = []
    restrict_file_access: bool = True

    # Security - Authentication
    # Auth mode options:
    #  - "disabled": no auth
    #  - "ephemeral": Electron-generated token
    #  - "static": env token
    #  - "hub": Hub-validated
    auth_mode: str = "disabled"
    # Session token for ephemeral/static modes (set by Electron or .env)
    session_token: str = ""
    # Protect /docs and /redoc endpoints (default: protected)
    auth_protect_docs: bool = True
    # Protect /api/health endpoint (default: protected)
    auth_protect_health: bool = True

    # Hub Integration (for auth_mode="hub")
    # URL of the Hub server for token validation
    hub_url: str = ""
    # This server's auth token registered in Hub (used to authenticate to Hub)
    hub_server_token: str = ""
    # Shared secret for registering with Hub (must match Hub's server_registration_secret)
    hub_registration_secret: str = ""

    # Workflow Archive
    archive_enabled: bool = True
    archive_path: str = "./workflow_archives"
    archive_retention_days: int = 30  # 0 = keep forever

    # Audit Logging
    audit_enabled: bool = True
    audit_path: str = "./audit/logs"
    audit_retention_days: int = 30  # 0 = keep forever

    # Blocking Tool Cache
    # Cache outputs of blocking operations (sort, summarize, join) and database inputs
    cache_enabled: bool = True
    cache_path: str = "./cache"
    # Cache retention: delete cache files older than this many days (0 = keep forever)
    cache_retention_days: int = 7
    # Cache quota: maximum total cache size in GB (0 = unlimited)
    cache_max_size_gb: float = 20.0
    # Clear workflow cache when workflow is closed (default: on)
    cache_clear_on_close: bool = True

    # Parallel Execution
    # Execute independent tools concurrently for improved performance
    # Modes: "sequential" (default, safe), "parallel" (concurrent independent tools)
    execution_mode: str = "sequential"
    # Maximum concurrent tool executions (0 = unlimited)
    max_parallel_tools: int = 4

    # Safety Limits
    # These prevent tools from creating outputs that could crash the application
    # Set to 0 to disable individual limits (not recommended)
    safety_max_pivot_columns: int = 1000  # Max unique values in pivot "on" column
    safety_max_cross_join_rows: int = 10_000_000  # Max rows from cross join (left * right)
    safety_max_unpivot_rows: int = 100_000_000  # Max rows after unpivot (rows * columns)

    # Server Connection Store
    # Fernet encryption key for credentials
    # Generate with: Fernet.generate_key().decode()
    connection_encryption_key: str = ""
    connection_store_path: str = "./connections.json"


settings = Settings()
