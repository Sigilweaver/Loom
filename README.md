# Sigilweaver Hub

Web-based management interface for storing workflows and coordinating their execution across Sigilweaver Server instances.

## Overview

Hub is the "control room" for your data operations:
- **Workflow Repository**: Store and organize `.swwf` workflow files
- **Server Registry**: Manage and monitor Sigilweaver Server instances
- **Remote Execution**: Trigger workflows on servers manually or via schedules
- **Operational History**: View logs and execution history across all servers

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- uv (Python package manager)

### Development Setup

```bash
# 1. Start PostgreSQL (via Docker or local install)
docker-compose up -d postgres

# 2. Install dependencies
cd backend && uv sync --all-extras
cd ../frontend && npm install

# 3. Run database migrations
cd backend && uv run alembic upgrade head

# 4. Start development servers
cd .. && ./scripts/dev.py
```

Hub will be available at:
- Frontend: http://localhost:5174
- Backend API: http://localhost:58001
- API Docs: http://localhost:58001/docs

## Architecture

```
Hub (this project)
├── Stores workflow files (opaque blobs)
├── Tracks registered servers
├── Routes execution requests
├── Manages schedules
└── Provides admin UI

Servers (app/backend containers)
├── Execute workflows
├── Manage their own cache
├── Manage their own connections
└── Report health to Hub
```

## Project Structure

```
hub/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── db/        # Database models & migrations
│   │   └── domain/    # Business logic
│   └── tests/
├── frontend/          # React frontend
│   └── src/
│       ├── pages/     # Page components
│       ├── components/# Shared components
│       └── api/       # API client
├── scripts/           # Development scripts
└── docker-compose.yml # Local development stack
```

## Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `SECRET_KEY` | (required) | JWT signing key |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `58001` | Server port |

### Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:58001` | Backend API URL |

## Related Projects

- **Studio** (`../app/`): Desktop workflow designer
- **Server**: Backend container for workflow execution (same as `../app/backend/`)

## License

Proprietary - See LICENSE file for details.
