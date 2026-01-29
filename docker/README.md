# Sigilweaver Docker Deployment

Production Docker deployment for Sigilweaver Hub and Server.

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Generate required secrets
openssl rand -hex 32  # For SESSION_SECRET, SECRET_KEY, SERVER_REGISTRATION_SECRET
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # For CONNECTION_ENCRYPTION_KEY

# 3. Edit .env with your secrets
nano .env

# 4. Build and start the stack
docker compose build
docker compose up -d

# 5. Check status
docker compose ps
docker compose logs -f
```

> **Note for Dev Container users:** The docker-compose.yml includes `network: host` for builds
> to work around DNS resolution issues with Docker-in-Docker. This is transparent in CI/CD.

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
  .env.example
  README.md
  build.sh
```

- **PostgreSQL**: Database for Hub (optional, can use external DATABASE_URL)
- **Hub**: Web UI, API, workflow orchestration, user management
- **Server**: Workflow execution engine (stateless, horizontally scalable)

## Services

### Hub (`sigilweaver-hub`)

- **Port**: 25802 (configurable via HUB_PORT)
- **Features**:
  - Bundled React frontend (served from /static)
  - User authentication and authorization
  - Workflow storage and scheduling
  - Server coordination
  - Connection management

### Server (`sigilweaver-server`)

- **Port**: 25811 (internal only by default)
- **Features**:
  - Stateless workflow execution
  - Polars-based data processing
  - Horizontal scaling support
  - Hub-authenticated requests

## Configuration

### Required Environment Variables

| Variable                     | Description                           |
| ---------------------------- | ------------------------------------- |
| `SESSION_SECRET`             | Session cookie signing key            |
| `SECRET_KEY`                 | JWT signing key                       |
| `CONNECTION_ENCRYPTION_KEY`  | Fernet key for credential encryption  |
| `SERVER_REGISTRATION_SECRET` | Shared secret for server registration |
| `POSTGRES_PASSWORD`          | PostgreSQL password                   |

### Optional Environment Variables

| Variable       | Default  | Description                |
| -------------- | -------- | -------------------------- |
| `VERSION`      | `latest` | Image version tag          |
| `HUB_PORT`     | `25802`  | Hub external port          |
| `LOG_LEVEL`    | `info`   | Logging level              |
| `LOG_FORMAT`   | `json`   | Log format (text/json)     |
| `CORS_ORIGINS` | -        | Allowed CORS origins       |
| `DATABASE_URL` | -        | External PostgreSQL URL    |
| `SERVER_NAME`  | auto     | Server display name in Hub |

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
| `sigilweaver_postgres_data` | PostgreSQL data persistence       |
| `sigilweaver_hub_workflows` | Workflow storage                  |
| `sigilweaver_server_data`   | Data files for server (read-only) |

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

# Or directly
docker build -f hub/Dockerfile -t sigilweaver-hub:dev .
docker build -f server/Dockerfile -t sigilweaver-server:dev .
```

## Production Checklist

- [ ] All secrets generated and stored securely
- [ ] `CORS_ORIGINS` set to your domain(s)
- [ ] `LOG_FORMAT=json` for log aggregation
- [ ] External PostgreSQL (recommended for production)
- [ ] Reverse proxy (nginx/traefik) with TLS
- [ ] Resource limits configured
- [ ] Monitoring and alerting configured
- [ ] Backup strategy for PostgreSQL and workflows
