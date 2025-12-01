---
sidebar_position: 2
---

# Getting Started

This is the single source of truth for setting up a Sigilweaver development environment.

## Prerequisites

You'll need:
- **Python 3.11+** (for the backend)
- **Node.js 18+** (for the frontend)
- **Git** (obviously)

## Platform Notes

| Platform | Development | Notes |
|----------|-------------|-------|
| **Linux** | ✅ Primary | Most heavily tested |
| **Windows** | ⚠️ WSL2 recommended | Native Windows dev tooling is painful |
| **macOS** | ✅ Should work | Needs testing before v1.0 |

I develop on Arch Linux. The venv + package-lock approach means everything should work on any platform, but I can only verify what I actually run.

## Quick Setup

### Linux

```bash
# Install dependencies using your package manager
# You'll need: python 3.11+, nodejs 18+, npm, git, and build tools

# Clone and setup
git clone https://github.com/sigilweaver/sigilweaver-app.git
cd sigilweaver-app

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Frontend
cd ../frontend
npm install
```

### Windows (WSL2)

Native Windows development is possible but frustrating. I recommend WSL2:

```bash
# In WSL2 (Ubuntu)
sudo apt update && sudo apt install python3 python3-venv nodejs npm git build-essential

# Then follow Linux instructions above
```

If you must use native Windows:
- Use PowerShell, not cmd
- Watch for CRLF line endings (configure Git: `git config --global core.autocrlf input`)
- Paths use backslashes—let Node's `path` module and Python's `pathlib` handle it

### macOS

```bash
# Install dependencies
brew install python node git

# Then follow Linux instructions above
```

## Running Development Servers

The recommended approach:

```bash
# From repo root - starts both backend and frontend
python ./scripts/dev.py
```

Or manually:

```bash
# Terminal 1: Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
# Runs at http://localhost:8000

# Terminal 2: Frontend
cd frontend
npm run dev
# Runs at http://localhost:5173

# Terminal 3: Electron (optional, for desktop app testing)
cd frontend
npm run electron
```

The frontend dev server proxies API calls to the backend, so you need both running.

## Verifying Your Setup

### Backend Health Check

```bash
curl http://localhost:8000/api/health/
# Should return: {"status":"healthy","version":"0.0.0-dev","message":"SigilWeaver Backend is running"}
```

### Frontend

Electron should have started, but you can also open http://localhost:5173 in your browser. You should see the Sigilweaver canvas.

### Run Tests

```bash
# All tests
python ./scripts/test.py

# Or individually
cd backend && pytest
cd frontend && npm test
```

If tests pass, you're ready to contribute.

## Daily Workflow

```bash
# Start development
python ./scripts/dev.py

# Run tests before committing
python ./scripts/test.py

# Build a release (when needed)
python ./scripts/build.py
```

## Project Structure Overview

```
sigilweaver-app/
├── backend/           # Python (FastAPI + Polars)
│   ├── app/          # Application code
│   │   ├── api/      # REST endpoints
│   │   └── domain/   # Business logic, tools
│   └── tests/        # pytest suite
├── frontend/          # TypeScript (React + Electron)
│   ├── src/          # React application
│   ├── electron/     # Electron main process
│   └── tests/        # Vitest suite
├── scripts/          # Build and dev utilities
└── docs/             # Project documentation
```

For deeper understanding, see [Architecture Overview](./architecture/overview).

## Troubleshooting

### "Module not found" in backend

Make sure you activated the venv:
```bash
source backend/.venv/bin/activate
```

### Frontend can't reach backend

Check that the backend is actually running on port 8000. The Vite dev server proxies `/api/*` requests.

### Electron window is blank

The Electron app needs the Vite dev server running first. Start `npm run dev`, wait for it to be ready, then run `npm run electron`.

### Tests fail on Windows

Check line endings. Run:
```bash
git config --global core.autocrlf input
git checkout -- .
```

---

Next: [Architecture Overview](./architecture/overview) to understand how the pieces fit together.
