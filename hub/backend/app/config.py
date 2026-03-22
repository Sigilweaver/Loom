"""Configuration management for Hub backend"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # Server
    host: str = "0.0.0.0"
    port: int = 25802
    reload: bool = False
    log_level: str = "info"
    log_format: str = "text"  # "text" or "json"
    environment: str = "development"  # "development" or "production"

    # Static files - serve frontend from this directory (empty = disabled)
    static_files_path: str = ""

    # CORS - Allow Hub frontend (25803) and Studio (25810)
    cors_origins: list[str] = ["http://localhost:25803", "http://localhost:25810"]

    # Database
    database_url: str = (
        "postgresql+asyncpg://sigilweaver_loom:sigilweaver_loom@localhost:25801/sigilweaver_loom_hub"
    )

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

    # Server Token (Capability) Settings
    # RSA private key in PEM format for signing server tokens
    # Generate with: openssl genrsa -out private.pem 2048
    # If empty, an ephemeral key is generated (tokens invalid after restart)
    jwt_private_key: str = ""
    jwt_issuer: str = "sigilweaver-loom-hub"
    # Server token lifetime in seconds (default 5 minutes)
    server_token_ttl_seconds: int = 300

    # Connection Storage
    # Fernet encryption key for credentials
    # Generate with: from cryptography.fernet import Fernet
    #                print(Fernet.generate_key().decode())
    connection_encryption_key: str = ""

    # Server Registration
    # Shared secret that servers must provide to register with Hub
    # If empty, server registration is open (insecure - dev only)
    server_registration_secret: str = ""


settings = Settings()
