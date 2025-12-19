---
sidebar_position: 1
---

# Architecture Overview

Sigilweaver is a desktop application with a clear separation between frontend (UI) and backend (data processing). Understanding this split is key to navigating the codebase.

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Electron Shell                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     React Frontend                        │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │  │
│  │  │   Canvas    │  │    State     │  │   Config Panels │   │  │
│  │  │  (Xyflow)   │  │  (Zustand)   │  │    (React)      │   │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │ HTTP                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Python Backend                          │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │  │
│  │  │  FastAPI    │  │  Tool        │  │   Polars        │   │  │
│  │  │  Routes     │  │  Registry    │  │   Execution     │   │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

Everything lives in one repository. This isn't arbitrary—it solves real problems.

```
sigilweaver-app/
├── backend/              # Python: FastAPI + Polars
│   ├── app/
│   │   ├── api/          # REST endpoints
│   │   │   ├── routes/   # Route handlers
│   │   │   └── models/   # Pydantic request/response schemas
│   │   ├── domain/       # Business logic
│   │   │   ├── tools/    # Tool implementations (Select, Filter, etc.)
│   │   │   ├── workflow/ # Execution engine
│   │   │   └── datasources/  # CSV, Parquet handlers
│   │   └── utils/        # Shared utilities
│   └── tests/            # pytest suite
│
├── frontend/             # TypeScript: React + Electron
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── state/        # Zustand stores
│   │   ├── domain/       # Pure TS business logic
│   │   ├── api/          # Backend client
│   │   ├── data/         # Tool definitions
│   │   └── types/        # TypeScript interfaces
│   ├── electron/         # Main process
│   └── tests/            # Vitest suite
│
├── scripts/              # Build and dev utilities
└── docs/                 # Project documentation
```

## Why This Architecture?

### Separation of Concerns

The frontend handles:
- Visual workflow representation (canvas, tools, wires)
- User interaction (drag-drop, selection, configuration)
- State management (undo/redo, tabs, settings)
- Workflow serialization (save/load `.swwf` files)

The backend handles:
- Data loading and type inference
- Tool execution (actual transformations)
- Schema propagation (what columns exist after each step)
- Preview data generation

This split means the frontend never touches actual data. It works with schemas and metadata, keeping the UI responsive regardless of dataset size.

### Communication Pattern

The frontend and backend talk over HTTP:

1. **User adds a data source** → Frontend sends path to backend → Backend returns schema (column names, types)
2. **User configures a tool** → Frontend sends workflow JSON to backend → Backend returns output schema
3. **User requests preview** → Frontend sends workflow + tool ID → Backend executes upstream tools, returns sample rows
4. **User runs workflow** → Frontend sends complete workflow → Backend executes everything, writes output

All requests are synchronous from the user's perspective—they click, something happens. Under the hood, Polars' lazy evaluation means we only compute what's actually needed.

## Frontend Architecture

See [Frontend Architecture](./frontend) for details. Key points:

- **React** for UI components
- **Zustand** for state management (workflow, history, UI, tabs)
- **Xyflow** for the visual canvas (nodes and edges)
- **Vite** for development and bundling
- **Electron** for desktop packaging

State is split across multiple Zustand stores:
- `workflowStore`: Tools, wires, selection
- `historyStore`: Undo/redo stack
- `tabStore`: Multi-tab workflows
- `uiStore`: UI preferences (minimap, snap-to-grid)
- `settingsStore`: Persisted settings

## Backend Architecture

See [Backend Architecture](./backend) for details. Key points:

- **FastAPI** for REST API
- **Polars** for dataframe operations (lazy evaluation)
- **Pydantic** for request/response validation
- **Tool Registry** pattern for extensibility

The execution engine is decomposed into focused components:

| Component | Purpose |
|-----------|---------|
| **ExecutionPlanner** | Creates immutable execution plans with topological sort |
| **CacheManager** | Handles lineage hashes and caching decisions |
| **WorkflowExecutor** | Orchestrates tool execution (sequential or parallel) |

The tool system uses a decorator-based registry:
```python
@register_tool("Filter")
class FilterTool(BaseTool):
    async def execute(self, config, inputs):
        # Transformation logic
```

Socket IDs are defined as constants in both frontend and backend to prevent mismatches:
```python
# Backend: app/domain/tools/sockets.py
class CommonSockets:
    INPUT = "input"
    OUTPUT = "output"
```

This makes adding new tools straightforward—implement the interface, register it, done.

## Data Flow Example

Here's what happens when a user connects an Input tool to a Filter tool:

1. **Input tool configured** with `data.csv`
2. Frontend calls `POST /api/workflow/tool/schema` with workflow JSON
3. Backend loads CSV, infers schema, returns `{columns: [{name: "age", type: "Int64"}, ...]}`
4. Frontend stores schema, shows columns in Filter config dropdown
5. **User configures Filter**: `pl.col('age') > 30`
6. Frontend calls `POST /api/workflow/tool/schema` again with updated workflow
7. Backend computes Filter's output schema (same columns, different row count unknown until execution)
8. **User clicks Preview**
9. Frontend calls `POST /api/workflow/tool/execute` with workflow + Filter tool ID
10. Backend executes Input → Filter lazily, collects 100 rows, returns preview data
11. Frontend displays preview in data grid

All of this happens in milliseconds for reasonable-sized data because Polars is lazy—it only reads enough of the CSV to return the preview.

## Key Design Decisions

For the rationale behind major architectural choices, see [Architectural Decisions](./decisions).

---

Next: [Frontend Architecture](./frontend) or [Backend Architecture](./backend) for deeper dives.
