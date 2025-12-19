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
    # Auth mode: "disabled" (no auth), "ephemeral" (Electron-generated token), "static" (env token)
    auth_mode: str = "disabled"
    # Session token for ephemeral/static modes (set by Electron or .env)
    session_token: str = ""
    # Protect /docs and /redoc endpoints (default: protected)
    auth_protect_docs: bool = True
    # Protect /api/health endpoint (default: protected)
    auth_protect_health: bool = True

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

    # Parallel Execution
    # Execute independent tools concurrently for improved performance
    # Modes: "sequential" (default, safe), "parallel" (concurrent independent tools)
    execution_mode: str = "sequential"
    # Maximum concurrent tool executions (0 = unlimited)
    max_parallel_tools: int = 4

    # Server Connection Store
    # Fernet encryption key for credentials
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    connection_encryption_key: str = ""
    connection_store_path: str = "./connections.json"


settings = Settings()
