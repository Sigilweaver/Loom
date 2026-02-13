---
sidebar_position: 1
---

# Development Workflow

Daily patterns for working on Sigilweaver.

## Starting Development

The recommended approach:

```bash
# From repo root
./scripts/dev.py
```

This starts both backend and frontend in development mode with hot reload.

### Manual Approach

If you need more control:

```bash
# Terminal 1: Backend (using uv)
cd server
uv run uvicorn app.main:app --reload --port 25811
# Runs at http://localhost:25811

# Terminal 2: Frontend (Vite)
cd studio
npm run dev
# Runs at http://localhost:25810

# Terminal 3: Electron (optional)
cd studio
npm run dev:electron
# Opens desktop window
```

## Development Modes

### Browser Development

For pure frontend work, just use the Vite dev server:

```bash
npm run dev
```

Open http://localhost:25810 in your browser. Faster iteration than Electron, easier to debug.

### Electron Development

For testing desktop-specific features:

```bash
npm run dev       # Start Vite first
npm run dev:electron  # Then Electron
```

The Electron window loads from the Vite dev server, so you still get hot reload.

### Backend Only

For API development:

```bash
cd server
uv run uvicorn app.main:app --reload
```

Test with curl or the Swagger UI at http://localhost:25811/docs.

## File Watching

Both servers watch for changes:

- **Backend**: uvicorn reloads on `.py` file changes
- **Studio**: Vite reloads on `.ts/.tsx/.css` file changes

No manual restart needed for most changes.

## Common Tasks

### Adding a Tool

1. Create `server/app/domain/tools/implementations/my_tool.py`
2. Add import to `server/app/domain/tools/implementations/__init__.py`
3. Add definition to `studio/src/data/tools.ts`
4. Create config panel in `studio/src/components/config/<category>/MyToolConfiguration.tsx`
5. Test with `./scripts/test.py`

See [Adding Tools](../contributing/adding-tools) for details.

### Debugging Server

```python
# Add breakpoints in code
import pdb; pdb.set_trace()

# Or use structured logging
import structlog
logger = structlog.get_logger(__name__)
logger.debug("Value", value=value)
```

View logs in the terminal where uvicorn is running.

### Debugging Studio

- React DevTools for component inspection
- Browser DevTools for network and console
- Zustand DevTools for state inspection (if installed)

```typescript
// Console debugging
console.log('Value:', value);

// Zustand state inspection
console.log(useWorkflowStore.getState());
```

### Running Tests

```bash
# All tests (from repo root)
./scripts/test.py

# Server only
cd server && uv run pytest tests/

# Studio only  
cd studio && npm test

# Specific test file
cd server && uv run pytest tests/test_filter.py -v
cd studio && npm test FilterConfig

# Watch mode (Studio)
cd studio && npm run test:watch
```

### Linting and Formatting

```bash
# Server
cd server
ruff format app/
ruff check --fix app/
mypy app/

# Studio
cd studio
npm run lint:fix
npm run type-check
```

Run these before committing.

### Building a Release

```bash
./scripts/build.py
```

Outputs to `studio/dist/`. See [Packaging](./packaging) for details.

## Project-Specific Quirks

### Server Virtual Environment

Use `uv` to run Server commands:

```bash
cd server
uv run pytest tests/
uv run uvicorn app.main:app --reload
```

### Frontend Path Aliases

The frontend uses `@/` as an alias for `src/`:

```typescript
import { useWorkflowStore } from '@/state/workflowStore';
// Same as: import from '../../state/workflowStore'
```

### Electron Main Process

Changes to `electron/main.ts` require restarting Electron. Hot reload only works for the renderer process.

### Workflow Files

Workflow files (`.swwf`) are JSON. You can inspect them with any text editor:

```bash
cat my_workflow.swwf | jq .
```

## Recommended Editor Setup

### VS Code Extensions

- ESLint
- Prettier
- Python
- Pylance
- Tailwind CSS IntelliSense

### Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "python.formatting.provider": "none",
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff"
  }
}
```

## Troubleshooting

### Backend won't start

```bash
# Check Python version
python --version  # Needs 3.11+

# Check uv is installed
uv --version

# Reinstall dependencies
cd server && uv sync --all-extras
```

### Frontend won't start

```bash
# Check Node version
node --version  # Needs 18+

# Clear cache and reinstall
rm -rf node_modules
npm install
```

### Tests failing mysteriously

```bash
# Backend: check for stale .pyc files
find . -type f -name "*.pyc" -delete
find . -type d -name "__pycache__" -delete

# Frontend: clear Vitest cache
rm -rf node_modules/.vitest
```

### Electron shows blank window

The Vite dev server must be running first. Start `npm run dev`, wait for "ready in XXms", then run `npm run dev:electron`.

---

Next: [Packaging](./packaging) for building distributable releases.
