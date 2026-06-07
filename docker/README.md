# Sigilweaver Loom Docker Deployment

Production Docker deployment for Sigilweaver Loom Hub and Server.

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Generate required secrets
mkdir -p .secrets
openssl rand -hex 32 > .secrets/session_secret
openssl rand -hex 32 > .secrets/secret_key
openssl rand -hex 32 > .secrets/server_registration_secret
openssl rand -hex 16 > .secrets/postgres_password
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" > .secrets/connection_encryption_key

# 3. Build and start the stack
docker compose build
docker compose up -d

# 4. Check status
docker compose ps
docker compose logs -f
```

## Development Quick Start

For local development, use the init script to create placeholder secrets:

```bash
# 1. Initialize development secrets
./init-dev-secrets.sh

# 2. Start services (override file is auto-loaded)
docker compose up

# 3. View logs
docker compose logs -f
```

> **Note for Dev Container users:** The docker-compose.yml includes `network: host` for builds
> to work around DNS resolution issues with Docker-in-Docker. This is transparent in CI/CD.

> **Development mode:** Run `./init-dev-secrets.sh` first to create placeholder secrets,
> then `docker compose up`. The override file (`docker-compose.override.yml`) relaxes security
> settings for local development. For production, use: `docker compose -f docker-compose.yml up -d`

## Testing

The Docker implementation includes a comprehensive test suite:

```bash
# Quick validation (no builds, fast)
./test-docker.sh --quick

# Full test including image builds
./test-docker.sh --build

# Include security scanning
./test-docker.sh --security

# Run everything
./test-docker.sh --all
```

Tests include:
- Dockerfile syntax and best practices (multi-stage builds, non-root user, health checks)
- Docker Compose validation (services, networks, secrets)
- Entrypoint script validation (signal handling, error handling)
- Security configuration checks (read-only filesystems, init process)
- Container runtime tests (with `--build`)
- Vulnerability scanning (with `--security`)

## Architecture

```
hub/
  Dockerfile          # Hub image (frontend + backend)
  entrypoint.sh
  backend/
  frontend/
server/
  Dockerfile          # Server image
  entrypoint.sh
  app/
docker/
  docker-compose.yml  # Orchestration
  docker-compose.tls.yml  # Optional: Caddy HTTPS reverse-proxy overlay
  Caddyfile           # Caddy config used by the TLS overlay
  sidecar/            # Optional: remote Server over Tailscale
  .env.example
  README.md
  build.sh
```

- **PostgreSQL**: Database for Hub (optional, can use external DATABASE_URL)
- **Hub**: Web UI, API, workflow orchestration, user management
- **Server**: Workflow execution engine (stateless, horizontally scalable)

### Optional overlays

- **HTTPS / TLS** - front the Hub with Caddy (automatic Let's Encrypt certs):

  ```bash
  # Set CADDY_DOMAIN, ACME_EMAIL, CORS_ORIGINS in .env first
  docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
  ```

- **Remote Server over Tailscale** - run a Server on a host the Hub cannot
  reach directly. See [`sidecar/README.md`](sidecar/README.md).


## Services

### Hub (`sigilweaver-loom-hub`)

- **Port**: 25802 (configurable via HUB_PORT)
- **Features**:
  - Bundled React frontend (served from /static)
  - User authentication and authorization
  - Workflow storage and scheduling
  - Server coordination
  - Connection management

### Server (`sigilweaver-loom-server`)

- **Port**: 25811 (internal only by default)
- **Features**:
  - Stateless workflow execution
  - Polars-based data processing
  - Horizontal scaling support
  - Hub-authenticated requests

## Configuration

### Secrets (Recommended for Production)

Production deployments should use Docker secrets instead of environment variables:

```bash
# Create secrets directory
mkdir -p .secrets
chmod 700 .secrets

# Generate and store secrets
openssl rand -hex 32 > .secrets/session_secret
openssl rand -hex 32 > .secrets/secret_key
openssl rand -hex 32 > .secrets/server_registration_secret
openssl rand -hex 16 > .secrets/postgres_password
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" > .secrets/connection_encryption_key

# Secure the files
chmod 600 .secrets/*
```

Secrets are mounted to `/run/secrets/` in containers and read via `*_FILE` environment variables.

The Hub entrypoint supports two patterns for database credentials:

1. **Preferred**: `DATABASE_URL_TEMPLATE` with a `__PASSWORD__` placeholder + `DATABASE_PASSWORD_FILE` pointing to the secret file. The entrypoint substitutes the password at runtime.
2. **Legacy**: `DATABASE_URL` with an empty password (`user:@host`) + `POSTGRES_PASSWORD` loaded from a secret file. The entrypoint reconstructs the full URL.

Both patterns keep the database password out of `docker inspect` output.

### Environment Variables (Development)

For development, you can use environment variables in `.env` instead of secrets files.
The `docker-compose.override.yml` file disables secrets for local development.

| Variable                     | Description                           |
| ---------------------------- | ------------------------------------- |
| `SESSION_SECRET`             | Session cookie signing key            |
| `SECRET_KEY`                 | JWT signing key                       |
| `CONNECTION_ENCRYPTION_KEY`  | Fernet key for credential encryption  |
| `SERVER_REGISTRATION_SECRET` | Shared secret for server registration |
| `POSTGRES_PASSWORD`          | PostgreSQL password                   |

### Optional Environment Variables

| Variable       | Default         | Description                                    |
| -------------- | --------------- | ---------------------------------------------- |
| `VERSION`      | `latest`        | Image version tag                              |
| `HUB_PORT`     | `25802`         | Hub external port                              |
| `ENVIRONMENT`  | `development`   | `production` enforces secret validation at startup |
| `LOG_LEVEL`    | `info`          | Logging level                                  |
| `LOG_FORMAT`   | `json`          | Log format (text/json)                         |
| `CORS_ORIGINS` | -               | Allowed CORS origins                           |
| `DATABASE_URL` | -               | External PostgreSQL URL                        |
| `SERVER_NAME`  | auto            | Server display name in Hub                     |

## Scaling Servers

```bash
# Scale to 3 server instances
docker compose up -d --scale server=3

# Check running instances
docker compose ps

# View logs from all servers
docker compose logs -f server
```

## Using External PostgreSQL

1. Set `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/database
   ```

2. Remove or comment out the postgres service in `docker-compose.yml`

3. Remove the `depends_on` section from the hub service

## Volumes

| Volume                      | Purpose                           |
| --------------------------- | --------------------------------- |
| `sigilweaver_loom_postgres_data` | PostgreSQL data persistence       |
| `sigilweaver_loom_hub_workflows` | Workflow storage                  |
| `sigilweaver_loom_server_data`   | Data files for server (read-only) |

## Health Checks

Both Hub and Server expose health endpoints:

- **Hub**: `GET /api/v1/health`
- **Server**: `GET /api/health`

Docker Compose uses these for container orchestration.

## Logs

JSON-formatted logs for easy aggregation:

```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f hub
docker compose logs -f server

# Parse JSON logs with jq
docker compose logs hub --no-log-prefix | jq .
```

## Troubleshooting

### Hub won't start

1. Check secrets are set:
   ```bash
   docker compose config | grep -E "SESSION_SECRET|SECRET_KEY"
   ```

2. Check database connectivity:
   ```bash
   docker compose exec hub curl -f http://postgres:5432 || echo "Cannot reach PostgreSQL"
   ```

3. View startup logs:
   ```bash
   docker compose logs hub
   ```

### Server can't reach Hub

1. Verify Hub is healthy:
   ```bash
   docker compose exec server curl -f http://hub:25802/api/v1/health
   ```

2. Check registration secret matches:
   ```bash
   docker compose exec server env | grep HUB_REGISTRATION_SECRET
   docker compose exec hub env | grep SERVER_REGISTRATION_SECRET
   ```

### Database migration issues

Migrations run automatically on Hub startup. If issues occur:

```bash
# Run migrations manually
docker compose exec hub alembic upgrade head

# Check current migration version
docker compose exec hub alembic current
```

## Building Images Locally

```bash
# From repo root
./docker/build.sh          # Build both
./docker/build.sh hub      # Hub only
./docker/build.sh server   # Server only

# Build with version tag
VERSION=1.0.0 ./docker/build.sh

# Build and scan for vulnerabilities
SCAN=1 ./docker/build.sh

# Scan existing images only
./docker/build.sh scan
```

## Security Features

- **Read-only root filesystems** - Containers run with immutable filesystems
- **Non-root users** - All containers run as `appuser` (UID 1000)
- **Docker secrets** - Sensitive data stored outside container images; passwords never in `docker inspect`
- **Network isolation** - Internal network for service-to-service communication
- **Resource limits** - Memory constraints prevent runaway containers
- **Health checks** - Automatic restart on failure
- **Init process** - Proper signal handling via tini
- **Startup validation** - In production mode (`ENVIRONMENT=production`), Hub rejects default/insecure secrets; in development mode, a warning is logged instead
- **Cryptographic entropy** - Dev secrets generated with `/dev/urandom`, not timestamps

## Production Checklist

- [ ] All secrets generated and stored in `.secrets/` directory
- [ ] `.secrets/` directory has `chmod 700` permissions
- [ ] Secret files have `chmod 600` permissions
- [ ] `ENVIRONMENT=production` is set (enforces secret validation at startup)
- [ ] `SESSION_SECRET` and `SECRET_KEY` are NOT the default `CHANGE_ME_IN_PRODUCTION`
- [ ] `SERVER_REGISTRATION_SECRET` is set (empty = open server registration)
- [ ] Using production compose: `docker compose -f docker-compose.yml up -d`
- [ ] `CORS_ORIGINS` set to your domain(s)
- [ ] `LOG_FORMAT=json` for log aggregation
- [ ] External PostgreSQL (recommended for production)
- [ ] Reverse proxy (nginx/traefik) with TLS
- [ ] Resource limits configured
- [ ] Monitoring and alerting configured
- [ ] Backup strategy for PostgreSQL and workflows
- [ ] Vulnerability scanning enabled: `SCAN=1 ./docker/build.sh`
