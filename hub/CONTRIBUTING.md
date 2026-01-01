# Contributing to Sigilweaver Hub

For comprehensive development documentation, see **[docs.sigilweaver.app/developer/contributing/hub](https://docs.sigilweaver.app/developer/contributing/hub)**.

## Quick Reference

### Development Setup

```bash
# Start PostgreSQL (from hub/ directory)
cd hub && docker compose up -d

# Backend
cd hub/backend
uv sync --all-extras
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 25802

# Frontend (separate terminal)
cd hub/frontend
npm install
npm run dev
```

Or from the repository root:

```bash
./scripts/dev.py --hub
```

### Running Tests

```bash
# Backend
cd hub/backend
uv run pytest tests/ -v

# Frontend
cd hub/frontend
npm test
```

### Database Migrations

```bash
cd hub/backend

# Create migration
uv run alembic revision --autogenerate -m "Description"

# Apply migrations
uv run alembic upgrade head
```

## Key Documentation

| Topic | Link |
|-------|------|
| **Hub Development** | [docs.sigilweaver.app/developer/contributing/hub](https://docs.sigilweaver.app/developer/contributing/hub) |
| **Server Patterns** | [docs.sigilweaver.app/developer/contributing/server](https://docs.sigilweaver.app/developer/contributing/server) |
| **Studio Patterns** | [docs.sigilweaver.app/developer/contributing/studio](https://docs.sigilweaver.app/developer/contributing/studio) |
| **Code Style** | [docs.sigilweaver.app/developer/contributing/code-style](https://docs.sigilweaver.app/developer/contributing/code-style) |

## CLA Requirement

All contributors must sign an IP Assignment CLA. See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root for details.
