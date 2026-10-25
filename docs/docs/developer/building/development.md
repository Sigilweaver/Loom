---
sidebar_position: 1
title: Development Workflow
---

# Development Workflow

Daily patterns for working on Sigilweaver Loom. Set up your environment first with [Getting Started](../getting-started.md).

## The loop

```bash
./scripts/dev.py          # start what you need, with hot reload
# edit code
./scripts/test.py         # smart mode: checks only the components you changed
./scripts/test.py --full  # everything CI runs, before you open a PR
```

Flags for both scripts are in `scripts/README.md`.

## Development modes

| Mode | Command | Use it for |
| ---- | ------- | ---------- |
| Studio in the browser | `NO_ELECTRON=1 bun run dev` in `studio/` | Fast UI iteration and easy debugging |
| Studio in Electron | `bun run dev:electron` in `studio/` | Desktop-only features: native dialogs, credential storage |
| Studio in Tauri | `bun run dev:tauri` in `studio/` | The Tauri shell |
| Server only | `AUTH_MODE=disabled uv run uvicorn app.main:app --reload` in `server/` | API work. Swagger UI is at http://localhost:25811/docs |
| Hub | `./scripts/dev.py --hub` | Hub backend and frontend |

The Vite dev server reloads on `.ts`, `.tsx` and `.css` changes. Uvicorn reloads on `.py` changes. Changes to `studio/electron/main.ts` need an Electron restart, because hot reload only covers the renderer.

## Common tasks

### Add a tool

1. Implement it in `server/app/domain/tools/implementations/`.
2. Export it from `implementations/__init__.py` and import it in `register.py`.
3. Add its definition to `studio/src/data/tools.ts` and its config component to `studio/src/data/toolConfigComponents.tsx`.
4. Add tests, then a page under `docs/docs/user/tools/`.

See [Adding Tools](../contributing/adding-tools.md) for the full walk-through, and [Adding Data Formats](../contributing/adding-formats.md) for new file types.

### Debug the Server

Run it in the foreground with `LOG_LEVEL=debug` and read the terminal. Use the Swagger UI to call endpoints. To drop into a debugger, add `breakpoint()` and run Uvicorn without `--reload`.

The execution engine also writes an archive of each run under `ARCHIVE_PATH` (by default `.working/server/archives` at the repository root when you start the Server from `server/`). It records the workflow, tool order, timings and errors. See [Server Configuration](../../admin/server-configuration.md).

### Debug Studio

- React DevTools for components.
- The browser network tab, or Studio's own **Network Logs** tab, for Server calls.
- Zustand DevTools or a temporary `console.log(useWorkflowStore.getState())` to inspect state.

### Lint, type-check and format

The zero-warning policy is enforced in CI, so run these before you push.

```bash
# Server and Hub backend
cd server            # or hub/backend
uv run ruff check app
uv run ruff format app
uv run mypy app

# Studio and Hub frontend
cd studio            # or hub/frontend
bun run lint
bun run type-check
bun run verify       # Studio: type-check, tests and lint together
```

`./scripts/test.py --repo` also lints the `scripts/` directory with ruff.

### Run one test

```bash
cd server && uv run pytest tests/test_filter.py -v
cd studio && bun run test FilterConfig
cd studio && bun run test:watch
```

### Build a desktop app

```bash
./scripts/build.py
```

See [Packaging](./packaging.md).

## Project quirks

### Python environments

Always go through uv: `uv run pytest`, `uv run uvicorn ...`. Each of `server/` and `hub/backend/` has its own `pyproject.toml` and `uv.lock`.

### Studio path aliases

Studio imports use path aliases from `tsconfig.json`, not `@/`:

```typescript
import { useWorkflowStore } from '@state/workflowStore';
import { getToolDefinition } from '@data/tools';
import { previewTool, executeWorkflow } from '@api';   // Hub-aware; do not import @api/backend directly
```

The aliases are `@api`, `@components`, `@contexts`, `@data`, `@domain`, `@hooks`, `@platform`, `@state` and `@utils`.

### Workflow files

`.swwf` files are JSON. Inspect one with any editor, or `jq . my_workflow.swwf`.

### Platform code

Anything that differs between Electron, Tauri and the browser lives behind the adapter in `studio/src/platform/`. Do not call `window.electronAPI` from components.

## Editor setup

Useful VS Code extensions: ESLint, Prettier, Python, Pylance, Ruff and Tailwind CSS IntelliSense. Format Python with Ruff, not Black.

## Troubleshooting

**Server will not start.** `uv --version`, then `cd server && uv sync --all-extras`.

**Studio will not start.** `bun --version`, then `rm -rf node_modules && bun install`.

**Odd test failures.** Clear stale bytecode with `find . -name __pycache__ -prune -exec rm -rf {} +`, and clear the Vitest cache with `rm -rf node_modules/.vitest`.

---

Next: [Packaging](./packaging.md).
