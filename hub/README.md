# Sigilweaver Loom Hub

The orchestration platform - turning Sigilweaver Loom into a complete data pipeline ecosystem.

## What is Hub?

Hub is what transforms Sigilweaver Loom from a workflow designer into a full platform. It's the central nervous system that:

- **Stores workflows** in a central location accessible to your team
- **Manages servers** across different environments (dev, staging, production)
- **Schedules automated runs** with cron-like scheduling
- **Provides access control** with production-grade security

**You don't need Hub to use Sigilweaver Loom.** Studio can connect directly to a Server for single-user workflows. Hub adds value when you need centralization, automation, or collaboration.

## Philosophy: Production Grade for Everyone

Hub is built with Zero-Trust security principles and production-grade RBAC, but that doesn't mean it's only for large organizations:

- **Your homelab deserves the same security as a Fortune 500** - Why should your personal data be less protected?
- **Self-hosting should be easy** - One `docker compose up` and you're running.
- **No artificial limits** - The same features work whether you're a solo user or a 100-person team.

## Quick Start

### One command (full stack)

Bring up Postgres + Hub + Server with development secrets baked in:

```bash
docker compose -f hub/docker-compose.yml up --build
```

Open `http://localhost:25802` and register the first account - it becomes the
owner. The execution Server auto-registers with the Hub. The dev secrets in that
compose file are intentionally insecure; for production use
`docker/docker-compose.yml` with real Docker secrets.

### Local development (hot reload)

```bash
cd hub

# Start PostgreSQL only
docker compose up -d postgres

# Start the backend
cd backend && uv sync && uv run uvicorn app.main:app --port 25802

# Start the frontend (in another terminal)
cd frontend && bun install && bun run dev
```

Or use the unified dev script from the repository root:

```bash
./scripts/dev.py --hub
```

Hub backend runs at `http://localhost:25802`, frontend at `http://localhost:25803`.

## Security Model

### Zero-Trust Architecture

- **All requests require authentication** - No anonymous access
- **Sessions are server-controlled** - Database-backed tokens allow server-side invalidation
- **Credentials never transit** - Data source credentials stay on servers, never pass through Hub

### Role-Based Access Control (RBAC)

| Role        | Capabilities                                                |
| ----------- | ----------------------------------------------------------- |
| **Owner**   | Full control. First registered user. Only one per instance. |
| **Admin**   | Manage non-admin users, register servers, create schedules. |
| **Auditor** | Read-only access to workflows and execution history.        |
| **User**    | Execute workflows, view assigned servers.                   |

## Key Features

### Server Management

Register multiple servers and route workflows to the right environment:

```bash
curl -X POST https://hub.example.com/api/v1/servers \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Production", "endpoint_url": "https://server.example.com"}'
```

### Scheduling

Automate workflow execution with cron syntax:

```bash
curl -X POST https://hub.example.com/api/v1/schedules \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workflow_id": "...", "cron_expression": "0 3 * * *"}'
```

### API Keys

Programmatic access for CI/CD pipelines:

```bash
curl -X POST https://hub.example.com/api/v1/executions \
  -H "X-API-Key: sw_key_abc123..." \
  -d '{"workflow_id": "...", "server_id": "..."}'
```

## Homelab Deployment

Running Hub on a Raspberry Pi or home server works great:

```yaml
# docker-compose.homelab.yml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: sigilweaver_hub
      POSTGRES_USER: sigilweaver
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  hub:
    image: sigilweaver/hub:latest
    ports:
      - "8080:25802"
    environment:
      DATABASE_URL: postgresql+asyncpg://sigilweaver:${POSTGRES_PASSWORD}@postgres:5432/sigilweaver_hub
      SECRET_KEY: ${SECRET_KEY}
    depends_on:
      - postgres

volumes:
  postgres_data:
```

Tips:
- Put it behind a reverse proxy (Caddy, nginx) with automatic HTTPS
- Use Docker volumes to persist data
- Set resource limits to prevent runaway processes

## For Developers

For architecture details, API documentation, and development setup, see:
- [Developer Documentation](https://sigilweaver.app/loom/docs/developer/contributing/hub)
- [CONTRIBUTING.md](CONTRIBUTING.md) (quick reference)

## License

AGPLv3 - See [LICENSE](LICENSE.md).

---

**Hub is for everyone.** Whether you're managing pipelines for a large organization or just automating your personal data workflows, you deserve production-grade reliability.
