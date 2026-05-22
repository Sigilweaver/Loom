"""Configuration management for the backend service"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # Server
    host: str = "0.0.0.0"
    port: int = 25811  # Part of 258xx port scheme (founding date 2025-08-01)
    reload: bool = False
    log_level: str = "info"
    log_format: str = "text"  # "text" or "json"

    # CORS
    cors_origins: list[str] = ["http://localhost:25810"]  # Studio dev server
    cors_mode: str = "development"  # "development" (permissive) | "production" (strict)

    # Execution limits
    max_execution_time_seconds: int = 300
    max_memory_mb: int = 4096
    max_preview_rows: int = 10000

    # Security - File Access
    # Explicit modes:
    #  - "open":      no path restriction (logs a startup warning)
    #  - "allowlist": deny anything outside allowed_file_paths (which must be non-empty)
    #  - "hub":       Hub-issued per-request grants (auth_mode must be "hub")
    #  - "auto":      derived from auth_mode/restrict_file_access (default; back-compat)
    file_access_mode: str = "auto"
    allowed_file_paths: list[str] = []
    # Legacy boolean. With file_access_mode="auto" it selects allowlist vs open;
    # ignored for explicit modes. Kept for backward compatibility.
    # Default is False so an unconfigured server fails open (with a warning)
    # rather than refusing to boot; explicit configs are required for prod.
    restrict_file_access: bool = False

    # Security - Authentication
    # Auth mode options:
    #  - "disabled": no auth (explicit opt-in; logs a startup warning)
    #  - "ephemeral": auto-generated session token, also accepted from Electron
    #  - "static": env-provided token (required)
    #  - "hub": Hub-validated
    # Default is "ephemeral" so an unconfigured server is not silently open.
    auth_mode: str = "ephemeral"
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
    archive_path: str = "../.working/server/archives"
    archive_retention_days: int = 30  # 0 = keep forever

    # Audit Logging
    audit_enabled: bool = True
    audit_path: str = "../.working/server/audit"
    audit_retention_days: int = 30  # 0 = keep forever

    # Blocking Tool Cache
    # Cache outputs of blocking operations (sort, summarize, join) and database inputs
    cache_enabled: bool = True
    cache_path: str = "../.working/server/cache"
    # Cache retention: delete cache files older than this many days (0 = keep forever)
    cache_retention_days: int = 7
    # Cache quota: maximum total cache size in GB (0 = unlimited)
    cache_max_size_gb: float = 20.0
    # Clear workflow cache when workflow is closed (default: on)
    cache_clear_on_close: bool = True

    # Parallel Execution
    # Execute independent tools concurrently for improved performance.
    # Modes: "sequential" (safe), "parallel" (concurrent independent tools).
    # WP-18: default is "parallel" so independent branches run concurrently.
    # Tuning: lower max_parallel_tools on memory-constrained hosts.
    execution_mode: str = "parallel"
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
    connection_store_path: str = "../.working/server/connections.json"

    # Rate limiting (WP-06). When enabled, a per-key limit is applied to all
    # /api/workflow/* endpoints. Disabled by default so existing test suites
    # are unaffected.
    rate_limit_enabled: bool = False
    rate_limit_workflow: str = "600/minute"


settings = Settings()
