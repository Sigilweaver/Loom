---
sidebar_position: 2
---

# Getting Started

## Prerequisites

You'll need:
- **Python 3.11+** (for the backend)
- **Node.js 18+** (for the frontend)
- **Git** (obviously)

## Platform Notes

| Platform    | Development        | Notes                                 |
| ----------- | ------------------ | ------------------------------------- |
| **Linux**   | ✅ Primary          | Most heavily tested                   |
| **Windows** | ⚠️ WSL2 recommended | Native Windows dev tooling is painful |
| **macOS**   | ✅ Should work      | Needs testing before v1.0             |

I develop on Arch Linux. The venv + package-lock approach means everything should work on any platform, but I can only verify what I actually run.

## Quick Setup

### Prerequisites

- **Python 3.11+** with [uv](https://github.com/astral-sh/uv) package manager
- **Node.js 18+** with npm
- **Git**

Install uv if you don't have it:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Linux

```bash
# Clone the repository
git clone https://github.com/Sigilweaver/Sigilweaver.git
cd sigilweaver

# Backend setup (uses uv, not pip)
cd server
uv sync --all-extras

# Frontend setup
cd ../studio
npm install
```

### Windows (WSL2)

Native Windows development is possible but frustrating. I recommend WSL2:

```bash
# In WSL2 (Ubuntu)
sudo apt update && sudo apt install python3 nodejs npm git build-essential
curl -LsSf https://astral.sh/uv/install.sh | sh

# Then follow Linux instructions above
```

If you must use native Windows:
- Use PowerShell, not cmd
- Watch for CRLF line endings (configure Git: `git config --global core.autocrlf input`)
- Paths use backslashes. Let Node's `path` module and Python's `pathlib` handle it

### macOS

```bash
# Install dependencies
brew install python node git
curl -LsSf https://astral.sh/uv/install.sh | sh

# Then follow Linux instructions above
```

## Running Development Servers

The recommended approach:

```bash
# From repo root - starts both backend and frontend
./scripts/dev.py
```

Or manually:

```bash
# Terminal 1: Backend (using uv)
cd server
uv run uvicorn app.main:app --reload --port 25811
# Runs at http://localhost:25811

# Terminal 2: Frontend
cd studio
npm run dev
# Runs at http://localhost:25810

# Terminal 3: Electron (optional, for desktop app testing)
cd studio
npm run dev:electron
```

The frontend dev server proxies API calls to the backend, so you need both running.

## Hub Development

Hub is the orchestration platform for managing workflows across multiple servers. It lives at the top level in `hub/`.

### Hub Setup

```bash
# From hub/ directory

# Start PostgreSQL (required for Hub)
docker compose up -d

# Backend setup
cd backend
uv sync --all-extras
uv run alembic upgrade head  # Run database migrations

# Frontend setup
cd ../frontend
npm install

# Start Hub dev servers
cd ..
./scripts/dev.py
```

Hub will be available at:
- Frontend: http://localhost:25803
- Backend API: http://localhost:25802
- API Docs: http://localhost:25802/docs

## Verifying Your Setup

### Backend Health Check

```bash
curl http://localhost:25811/api/health/
# Should return: {"status":"healthy","version":"0.0.0-dev","message":"Sigilweaver Backend is running"}
```

### Frontend

Electron should have started, but you can also open http://localhost:25810 in your browser. You should see the Sigilweaver canvas.

### Run Tests

```bash
# All tests (from repo root)
./scripts/test.py

# Or individually
cd server && uv run pytest tests/
cd studio && npm test
```

If tests pass, you're ready to contribute.

## Daily Workflow

```bash
# Start development (from repo root)
./scripts/dev.py

# Run tests before committing
./scripts/test.py

# Build a release (when needed)
./scripts/build.py
```

## Project Structure Overview

```
sigilweaver/
├── server/            # Python (FastAPI + Polars)
│   ├── app/          # Application code
│   │   ├── api/      # REST endpoints
│   │   └── domain/   # Business logic, tools
│   └── tests/        # pytest suite
├── studio/            # TypeScript (React + Electron)
│   ├── src/          # React application
│   ├── electron/     # Electron main process
│   └── tests/        # Vitest suite
├── hub/               # Hub orchestration platform
│   ├── backend/      # FastAPI + PostgreSQL
│   ├── frontend/     # React admin UI
│   └── scripts/      # Hub dev scripts
├── scripts/          # Build and dev utilities
└── docs/             # Project documentation
```

For deeper understanding, see [Architecture Overview](./architecture/overview).

## Troubleshooting

### "Module not found" in Server

Make sure you've run `uv sync`:
```bash
cd server && uv sync --all-extras
```

### Studio can't reach Server

Check that the Server is actually running on port 25811. The Vite dev server proxies `/api/*` requests.

### Electron window is blank

The Electron app needs the Vite dev server running first. Start `npm run dev`, wait for it to be ready, then run `npm run dev:electron`.

### Tests fail on Windows

Check line endings. Run:
```bash
git config --global core.autocrlf input
git checkout -- .
```

---

Next: [Architecture Overview](./architecture/overview) to understand how the pieces fit together.
