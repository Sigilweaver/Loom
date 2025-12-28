"""Configuration management for Hub backend"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # Server
    host: str = "0.0.0.0"
    port: int = 58001
    reload: bool = False
    log_level: str = "info"

    # CORS
    cors_origins: list[str] = ["http://localhost:5174"]

    # Database
    database_url: str = "postgresql+asyncpg://sigilweaver:sigilweaver@localhost:25802/sigilweaver_hub"

    # Authentication - Session
    session_secret: str = "CHANGE_ME_IN_PRODUCTION"
    session_lifetime_hours: int = 24

    # Authentication - Legacy JWT (to be removed in Phase 2)
    secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # Server polling
    server_poll_interval_seconds: int = 30
    server_timeout_seconds: int = 10

    # Workflow storage
    workflow_storage_path: str = "./workflows"


settings = Settings()
