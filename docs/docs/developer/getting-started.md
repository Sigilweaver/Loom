---
sidebar_position: 2
title: Getting Started
---

# Getting Started

Set up a development environment and run Studio, Server and Hub from source.

## Prerequisites

| Tool | Version | Used for |
| ---- | ------- | -------- |
| [uv](https://docs.astral.sh/uv/) | current | Python environments for Server and Hub |
| Python | 3.11 or newer (the repo pins 3.13 in `server/.python-version`; uv fetches it for you) | Server and Hub backend |
| [Bun](https://bun.sh) | current | JavaScript dependencies and scripts for Studio, Hub frontend and docs |
| Node.js | 22 (pinned in `.nvmrc` and `.node-version`; 20.19 is the minimum) | Toolchain that Vite, Electron and Docusaurus run on |
| Git | any | |
| Docker | optional | PostgreSQL for Hub development, and the Docker stacks |

The repo uses **Bun** for JavaScript and **uv** for Python. Do not use npm, pnpm or pip in the repository. They will not respect the lockfiles (`bun.lock`, `uv.lock`).

Install uv and select the pinned Node version:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
nvm use        # or: fnm use
```

### Platform notes

| Platform | Status |
| -------- | ------ |
| **Linux** | Primary development platform. Most tested. |
| **macOS** | Should work. Less tested. |
| **Windows** | Use WSL2. Native Windows development is not a supported path. |

If you must use native Windows, use PowerShell, run `git config --global core.autocrlf input`, and let `pathlib` and Node's `path` handle separators.

## Get the code

```bash
git clone https://github.com/Sigilweaver/Loom.git
cd Loom
```

## Run everything

```bash
./scripts/dev.py
```

The script installs missing dependencies, starts PostgreSQL through Docker if Hub needs it, applies Hub migrations, and starts every service:

| Service | URL |
| ------- | --- |
| Studio (Vite) | http://localhost:25810 |
| Server | http://localhost:25811 |
| Hub backend | http://localhost:25802 (API docs at `/docs`) |
| Hub frontend | http://localhost:25803 |
| PostgreSQL | localhost:25801 |
| Docs (with `--docs`) | http://localhost:25809 |

Pick what to run:

```bash
./scripts/dev.py --server            # Server only
./scripts/dev.py --studio            # Studio only, in the browser
./scripts/dev.py --hub               # Hub backend and frontend
./scripts/dev.py --docs              # Documentation site
./scripts/dev.py --studio-electron   # everything, plus the Electron desktop app
./scripts/dev.py --studio-tauri      # everything, plus the Tauri desktop app
./scripts/dev.py --install           # install dependencies, then exit
```

Studio in the browser proxies API calls to the Server, so both need to be running. See [Development Workflow](./building/development.md) for the daily loop.

### Hub needs its secrets

Hub refuses to start without four secrets. The dev script does not create them. Once:

```bash
cp hub/backend/.env.example hub/backend/.env
```

Then either fill in `SESSION_SECRET`, `SECRET_KEY`, `CONNECTION_ENCRYPTION_KEY` and `SERVER_REGISTRATION_SECRET`, or add this line to make Hub invent throwaway values on each start:

```bash
ALLOW_INSECURE_DEFAULTS=true
```

Open http://localhost:25803 and register. The first account becomes the Owner. See [Hub Configuration](../admin/hub-configuration.md) for how to generate real values.

## Run the pieces by hand

If you want more control than `dev.py` gives you:

```bash
# Server
cd server
uv sync --all-extras
AUTH_MODE=disabled uv run uvicorn app.main:app --reload --port 25811

# Studio (second terminal)
cd studio
bun install
NO_ELECTRON=1 bun run dev   # browser only, http://localhost:25810
bun run dev:electron        # Vite plus an Electron window
bun run dev:tauri           # Vite plus a Tauri window (needs the Rust toolchain)
```

Plain `bun run dev` also opens an Electron window when a display is available. Set `NO_ELECTRON=1` to stay in the browser.

`AUTH_MODE=disabled` lets you call the Server API without a token. The default is `ephemeral`, which requires a bearer token that the Server prints once at startup.

```bash
# Hub (needs PostgreSQL on port 25801 and hub/backend/.env)
docker compose -f hub/docker-compose.yml up -d postgres
cd hub/backend
uv sync --all-extras
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 25802

cd ../frontend
bun install
bun run dev                 # http://localhost:25803
```

## Check that it works

```bash
curl http://localhost:25811/api/health/
# {"status":"healthy","version":"0.0.0-dev", ...}
```

Open http://localhost:25810 and you should see the Studio canvas. Drag a **Read** tool onto it.

## Run the tests

```bash
./scripts/test.py            # smart mode: only components you changed
./scripts/test.py --full     # everything, as CI does
```

Or one component at a time:

```bash
cd server && uv run pytest
cd studio && bun run test
cd hub/backend && uv run pytest
cd hub/frontend && bun run test
```

See [Testing Philosophy](./testing/philosophy.md).

## Repository layout

```
Loom/
|-- server/        Python: FastAPI + Polars (Server)
|   |-- app/       api/, domain/, middleware/, utils/
|   `-- tests/
|-- studio/        TypeScript: React + Vite, Electron and Tauri shells
|   |-- src/       components/, state/, domain/, api/, platform/, ai/, data/
|   |-- electron/  Electron main and preload
|   `-- tauri/     Tauri (Rust) shell
|-- hub/           Hub
|   |-- backend/   FastAPI + PostgreSQL + Alembic
|   |-- frontend/  React admin and user app
|   `-- scripts/   Hub-only dev helpers
|-- docker/        Compose files for production deployment
|-- scripts/       dev.py, test.py, build.py and friends
`-- docs/          This documentation site
```

Read the [Architecture Overview](./architecture/overview.md) next.

## Troubleshooting

**Module not found in Server.** Run `uv sync --all-extras` in `server/`.

**Studio cannot reach the Server.** Confirm the Server answers on port 25811. In Studio, open **Settings > Execution** and check the Server URL.

**Hub exits with "refuses to start".** A required secret is empty. See above.

**Hub cannot connect to PostgreSQL.** Start it with `docker compose -f hub/docker-compose.yml up -d postgres` and check that port 25801 is free.

**Electron window is blank.** Check the terminal that runs Vite for build errors. The window loads from the Vite dev server.

**Tests fail on Windows.** Fix line endings: `git config --global core.autocrlf input`, then `git checkout -- .`.
