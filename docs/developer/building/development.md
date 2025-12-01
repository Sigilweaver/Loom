---
sidebar_position: 1
---

# Development Workflow

Daily patterns for working on Sigilweaver.

## Starting Development

The recommended approach:

```bash
# From repo root
./scripts/dev.sh
```

This starts both backend and frontend in development mode with hot reload.

### Manual Approach

If you need more control:

```bash
# Terminal 1: Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
# Runs at http://localhost:8000

# Terminal 2: Frontend (Vite)
cd frontend
npm run dev
# Runs at http://localhost:5173

# Terminal 3: Electron (optional)
cd frontend
npm run electron
# Opens desktop window
```

## Development Modes

### Browser Development

For pure frontend work, just use the Vite dev server:

```bash
npm run dev
```

Open http://localhost:5173 in your browser. Faster iteration than Electron, easier to debug.

### Electron Development

For testing desktop-specific features:

```bash
npm run dev       # Start Vite first
npm run electron  # Then Electron
```

The Electron window loads from the Vite dev server, so you still get hot reload.

### Backend Only

For API development:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

Test with curl or the Swagger UI at http://localhost:8000/docs.

## File Watching

Both servers watch for changes:

- **Backend**: uvicorn reloads on `.py` file changes
- **Frontend**: Vite reloads on `.ts/.tsx/.css` file changes

No manual restart needed for most changes.

## Common Tasks

### Adding a Tool

1. Create `backend/app/domain/tools/implementations/my_tool.py`
2. Add import to `backend/app/domain/tools/register.py`
3. Add definition to `frontend/src/data/tools.ts`
4. Create config panel in `frontend/src/components/panels/config/`
5. Test with `./scripts/test.sh`

See [Adding Tools](../contributing/adding-tools) for details.

### Debugging Backend

```python
# Add breakpoints in code
import pdb; pdb.set_trace()

# Or use logging
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Value: {value}")
```

View logs in the terminal where uvicorn is running.

### Debugging Frontend

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
# All tests
./scripts/test.sh

# Backend only
cd backend && pytest

# Frontend only  
cd frontend && npm test

# Specific test file
cd backend && pytest tests/test_filter.py -v
cd frontend && npm test FilterConfig

# Watch mode (frontend)
cd frontend && npm run test:watch
```

### Linting and Formatting

```bash
# Backend
cd backend
ruff format app/
ruff check --fix app/
mypy app/

# Frontend
cd frontend
npm run lint:fix
npm run type-check
```

Run these before committing.

### Building a Release

```bash
./scripts/build.sh
```

Outputs to `frontend/dist/`. See [Packaging](./packaging) for details.

## Project-Specific Quirks

### Backend Virtual Environment

Always activate the venv before running backend commands:

```bash
cd backend
source .venv/bin/activate
# Now pip, pytest, uvicorn work correctly
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

# Check venv is activated
which python  # Should point to .venv/bin/python

# Reinstall dependencies
pip install -e ".[dev]"
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

The Vite dev server must be running first. Start `npm run dev`, wait for "ready in XXms", then run `npm run electron`.

---

Next: [Packaging](./packaging) for building distributable releases.
