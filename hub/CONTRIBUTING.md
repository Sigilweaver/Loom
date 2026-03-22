# Contributing to Sigilweaver Loom Hub

For comprehensive development documentation, see **[sigilweaver.app/docs/developer/contributing/hub](https://sigilweaver.app/docs/developer/contributing/hub)**.

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

| Topic               | Link                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Hub Development** | [sigilweaver.app/docs/developer/contributing/hub](https://sigilweaver.app/docs/developer/contributing/hub)               |
| **Server Patterns** | [sigilweaver.app/docs/developer/contributing/server](https://sigilweaver.app/docs/developer/contributing/server)         |
| **Studio Patterns** | [sigilweaver.app/docs/developer/contributing/studio](https://sigilweaver.app/docs/developer/contributing/studio)         |
| **Code Style**      | [sigilweaver.app/docs/developer/contributing/code-style](https://sigilweaver.app/docs/developer/contributing/code-style) |

## CLA Requirement

All contributors must sign an IP Assignment CLA. See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root for details.
