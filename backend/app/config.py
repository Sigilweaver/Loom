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

    # Security
    allowed_file_paths: list[str] = []
    restrict_file_access: bool = True

    # Workflow Archive
    archive_enabled: bool = True
    archive_path: str = "./workflow_archives"
    archive_retention_days: int = 30  # 0 = keep forever

    # Audit Logging
    audit_enabled: bool = True
    audit_path: str = "./audit/logs"
    audit_retention_days: int = 30  # 0 = keep forever


settings = Settings()
