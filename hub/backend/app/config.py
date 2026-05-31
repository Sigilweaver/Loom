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
    # MUST be set via env (32+ random bytes). No default - Hub refuses to boot if empty.
    # Generate: python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
    session_secret: str = ""
    session_lifetime_hours: int = 24

    # Authentication - Legacy JWT (to be removed in Phase 2)
    # MUST be set via env. No default - Hub refuses to boot if empty.
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # Server polling
    server_poll_interval_seconds: int = 30
    server_timeout_seconds: int = 10

    # Health-poller failure handling (WP-12)
    # Number of consecutive failed health checks before a server is marked
    # offline. Transient blips below this threshold leave status untouched.
    server_offline_threshold: int = 3
    # Exponential-backoff cap (seconds) between retry attempts for a
    # failing server. Backoff doubles per failure starting at 1s.
    server_backoff_max_seconds: int = 60

    # Periodic background cleanup (WP-11)
    # Interval between session-cleanup passes, in seconds.
    session_cleanup_interval_seconds: int = 3600
    # Max number of expired session rows removed per pass. Keeps the
    # delete transaction short on large/long-lived deployments.
    session_cleanup_batch_size: int = 1000

    # Workflow storage
    workflow_storage_path: str = "./workflows"

    # Execution artifact storage (content-addressed output blobs)
    artifact_storage_path: str = "./artifacts"

    # Server Token (Capability) Settings
    # RSA private key in PEM format for signing server tokens
    # Generate with: openssl genrsa -out private.pem 2048
    # If empty, an ephemeral key is generated (tokens invalid after restart)
    jwt_private_key: str = ""
    jwt_issuer: str = "sigilweaver-loom-hub"
    # Server token lifetime in seconds (default 5 minutes)
    server_token_ttl_seconds: int = 300

    # Backend for server-token storage.
    #   "memory":   In-process dict. Tokens lost on restart, cannot be shared
    #               across Hub replicas. Default to preserve dev workflow.
    #   "postgres": Tokens persisted to server_tokens table with atomic
    #               claim semantics. Required when running multiple Hub
    #               instances behind a load balancer.
    token_store_backend: str = "memory"

    # Connection Storage
    # Fernet encryption key for credentials
    # Generate with: from cryptography.fernet import Fernet
    #                print(Fernet.generate_key().decode())
    connection_encryption_key: str = ""

    # Server Registration
    # Shared secret that servers must provide to register with Hub.
    # MUST be set via env. No default - Hub refuses to boot if empty.
    server_registration_secret: str = ""

    # Dev-only override: auto-generate ephemeral values for the secrets above
    # at startup instead of refusing to boot. Logs the generated values once.
    # NEVER enable this in production: tokens/sessions will not survive restart.
    allow_insecure_defaults: bool = False

    # Rate limiting (WP-06). When enabled, per-route limits return 429 with
    # a Retry-After header. Disabled by default so existing test suites and
    # tight-loop dev tooling are unaffected.
    rate_limit_enabled: bool = False
    rate_limit_login: str = "10/15 minutes"
    rate_limit_register: str = "5/hour"
    rate_limit_server_registration: str = "20/hour"
    rate_limit_capability_token: str = "60/minute"
    rate_limit_internal_authorize: str = "600/minute"


settings = Settings()
