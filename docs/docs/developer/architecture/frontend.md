---
sidebar_position: 2
---

# Studio Architecture

The Studio is a React application wrapped in Electron for desktop deployment. It handles all user interaction: the visual canvas, tool configuration, state management. All actual data processing is delegated to the Server.

## Technology Stack

| Layer | Technology | Why |
|-------|------------|-----|
| UI Framework | React 18 | Component model, ecosystem, hiring pool |
| State Management | Zustand | Simple, performant, no boilerplate |
| Canvas | Xyflow (React Flow) | Purpose-built for node-based editors |
| Bundler | Vite | Fast dev server, sensible defaults |
| Desktop | Electron | Cross-platform with native capabilities |
| Styling | Tailwind CSS | Utility-first, consistent design tokens |
| Testing | Vitest | Vite-native, fast, compatible API |

## Directory Structure

```
studio/src/
├── components/         # React components
│   ├── Canvas.tsx      # Main workflow canvas (Xyflow wrapper)
│   ├── ToolPalette.tsx # Drag-and-drop tool library
│   ├── ConfigurationPanel.tsx  # Selected tool config
│   ├── FilterConfiguration.tsx # Tool config components
│   ├── SelectConfiguration.tsx # (named *Configuration.tsx)
│   ├── primitives/     # Reusable config UI primitives
│   └── ui/             # Shared UI components
│
├── state/              # Zustand stores
│   ├── workflowStore.ts   # Tools, wires, selection
│   ├── historyStore.ts    # Undo/redo
│   ├── tabStore.ts        # Multi-tab workflows
│   ├── uiStore.ts         # UI preferences
│   ├── settingsStore.ts   # Persisted settings
│   └── connectionStore.ts # Database connections
│
├── domain/             # Pure TypeScript business logic
│   └── workflow/
│       ├── entities/   # Type definitions (Tool, Wire, etc.)
│       └── services/   # Serialization, validation, loop detection
│
├── api/                # Server communication
│   ├── backend.ts      # HTTP client
│   ├── hooks.ts        # React hooks for API calls
│   ├── cache.ts        # Request caching
│   ├── connectionResolver.ts  # Resolve connections before execution
│   └── serverConnections.ts   # Server connection API client
│
├── data/
│   └── tools.ts        # Tool definitions registry
│
├── types/              # TypeScript interfaces
├── utils/              # Shared utilities
└── themes/             # Theme definitions
```

## State Management

Zustand stores are the source of truth for all application state. Each store has a focused responsibility:

### workflowStore

The core store. Manages the workflow graph:

```typescript
interface WorkflowState {
  tools: Tool[];           // All tools on canvas
  wires: Wire[];           // Connections between tools
  edges: Edge[];           // Xyflow edge representation
  selectedTool: Tool | null;
  workflowMeta: WorkflowMeta;
  
  // CRUD operations
  addTool: (tool: Tool) => void;
  removeTool: (toolId: string) => void;
  addWire: (wire: Wire) => { success: boolean; error?: string };
  // ... etc
}
```

Tools and wires are the domain model. Edges are the Xyflow representation. They're derived from wires, kept in sync automatically.

### historyStore

Manages undo/redo with immutable snapshots:

```typescript
interface HistoryState {
  past: WorkflowSnapshot[];
  future: WorkflowSnapshot[];
  
  undo: () => void;
  redo: () => void;
  pushState: (snapshot: WorkflowSnapshot) => void;
}
```

Every meaningful action (add tool, connect wire, update config) pushes a snapshot. Undo/redo restores from the stack.

### tabStore

Multi-tab workflow support:

```typescript
interface TabState {
  tabs: Tab[];
  activeTabId: string;
  
  createTab: (name?: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
}
```

Each tab has its own workflow state and history. Switching tabs saves the current state and restores the target tab's state.

### uiStore

UI preferences (not workflow state):

```typescript
interface UIState {
  minimapVisible: boolean;
  snapToGrid: boolean;
  notification: Notification | null;
  // ...
}
```

### settingsStore

Persisted settings (survives restart):

```typescript
interface SettingsState {
  author: string;
  ui: {
    theme: 'light' | 'dark' | 'sigilweaver';
    edgeStyle: 'bezier' | 'straight' | 'smoothstep';
    // ...
  };
}
```

### connectionStore

Database connection management with dual-source support:

```typescript
interface ConnectionState {
  connections: ConnectionInfo[];      // Merged client + server connections
  loading: boolean;
  error: string | null;
  encryptionAvailable: boolean;       // Electron safeStorage available?
  serverConnectionsEnabled: boolean;  // Server has encryption key?
  
  loadConnections: () => Promise<void>;  // Refresh from both sources
  createConnection: (input: CreateConnectionInput) => Promise<ConnectionInfo>;
  updateConnection: (id: string, input: UpdateConnectionInput) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<ConnectionTestResult>;
}
```

Connections from both sources are merged into a single list. The `owner` field distinguishes them:
- `owner: 'client'` - stored in Electron via IPC
- `owner: 'server'` - stored on backend via REST API

## Configuration Hooks

Tool configuration components share common patterns: wire connection tracking, metadata fetching, and emission map management. These patterns are extracted into reusable hooks.

### useToolConfiguration

For single-input tools (Filter, Select, Sort, Formula, Summarize):

```typescript
import { useToolConfiguration } from '@/hooks/useToolConfiguration';
import { CommonSockets } from '@domain/workflow/constants/socketIds';

function FilterConfiguration({ toolId, config, onChange, tools, wires, workflowMeta }) {
  const {
    columns,       // Upstream columns available for configuration
    loading,       // Metadata fetch in progress
    error,         // Error message if fetch failed
    hasInput,      // Whether socket has incoming connection
    connectionKey, // String identifying current connections (for deps)
    updateField,   // Update single field with emission tracking
    updateFields,  // Update multiple fields at once
    refreshMetadata, // Manual re-fetch
  } = useToolConfiguration({
    toolId,
    socketId: CommonSockets.INPUT,
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  return (
    <Select
      value={config.column}
      onChange={(v) => updateField('column', v)}
      disabled={!hasInput || loading}
    >
      {columns.map(col => <Option key={col.name}>{col.name}</Option>)}
    </Select>
  );
}
```

Key benefits:
- **Automatic metadata refresh**: When wire connections change, metadata is re-fetched
- **Emission tracking**: `updateField` automatically marks fields in `_emit` for partial updates
- **Connection detection**: `hasInput` tells you if the socket is connected

### useMultiSocketConfiguration

For multi-input tools like Join:

```typescript
import { useMultiSocketConfiguration } from '@/hooks/useToolConfiguration';
import { JoinSockets } from '@domain/workflow/constants/socketIds';

function JoinConfiguration({ toolId, config, onChange, tools, wires, workflowMeta }) {
  const result = useMultiSocketConfiguration({
    toolId,
    socketIds: [JoinSockets.INPUT_LEFT, JoinSockets.INPUT_RIGHT],
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  // Access per-socket state by socket ID
  const { columns: leftColumns, hasInput: hasLeft } = result[JoinSockets.INPUT_LEFT];
  const { columns: rightColumns, hasInput: hasRight } = result[JoinSockets.INPUT_RIGHT];

  return (
    <>
      <Select disabled={!hasLeft}>
        {leftColumns.map(col => <Option key={col.name}>{col.name}</Option>)}
      </Select>
      <Select disabled={!hasRight}>
        {rightColumns.map(col => <Option key={col.name}>{col.name}</Option>)}
      </Select>
    </>
  );
}
```

### Socket ID Constants

Socket IDs are defined as constants to prevent mismatches between frontend and backend:

```typescript
// src/domain/workflow/constants/socketIds.ts
export const CommonSockets = {
  INPUT: "input",
  OUTPUT: "output",
} as const;

export const FilterSockets = {
  INPUT: "input",
  OUTPUT_TRUE: "output-true",
  OUTPUT_FALSE: "output-false",
} as const;

export const JoinSockets = {
  INPUT_LEFT: "input-left",
  INPUT_RIGHT: "input-right",
  OUTPUT_LEFT: "output-left",
  OUTPUT_MATCH: "output-match",
  OUTPUT_RIGHT: "output-right",
} as const;
```

These constants are mirrored in the backend (`app/domain/tools/sockets.py`) and validated by type contract tests.

## Component Architecture

### Canvas

The main workspace. Wraps Xyflow's `ReactFlow` component:

- Renders tools as custom nodes
- Renders wires as edges
- Handles drag-drop from tool palette
- Manages selection, panning, zooming

### ToolNode

Custom Xyflow node representing a tool:

- Displays tool icon and name
- Renders input/output sockets (handles)
- Shows connection points for wiring

### ConfigurationPanel

Dynamic configuration panel for the selected tool:

- Reads tool type, loads appropriate config component
- Passes config to child, receives updates
- Calls API for schema (available columns)

### Tool Config Components

Each tool type has a config component in `components/panels/`:

```
panels/
├── FilterConfig.tsx
├── SelectConfig.tsx
├── FormulaConfig.tsx
└── ...
```

These are pure UI. They render form fields and emit config changes. The workflowStore handles persistence.

## Tool Definitions

Tools are defined in `data/tools.ts`:

```typescript
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'Filter',           // Must match backend @register_tool name
    name: 'Filter',           // Display name
    icon: '🔍',               // Emoji for now, SVG later
    category: 'preparation',  // Tool palette category
    defaultConfig: {
      expression: '',
      mode: 'Custom',
    },
    sockets: [
      { id: 'input', direction: 'input' },
      { id: 'output-true', direction: 'output', type: 'T' },
      { id: 'output-false', direction: 'output', type: 'F' }
    ]
  },
  // ...
];
```

When a tool is dragged onto the canvas, we clone this definition and assign it a unique ID.

## API Layer

The `api/` directory contains the backend client:

### backend.ts

Type-safe HTTP client:

```typescript
export async function getToolSchema(
  toolId: string, 
  workflow: WorkflowJSON
): Promise<SchemaResponse> {
  const response = await fetch('/api/schema/', {
    method: 'POST',
    body: JSON.stringify({ tool_id: toolId, workflow }),
  });
  return response.json();
}
```

### hooks.ts

React hooks for API calls:

```typescript
export function useSchema(toolId: string) {
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fetchSchema = useCallback(async (workflow) => {
    setLoading(true);
    const result = await getToolSchema(toolId, workflow);
    setSchema(result);
    setLoading(false);
  }, [toolId]);
  
  return { schema, loading, fetchSchema };
}
```

## Workflow Serialization

Workflows are saved as `.swwf` files (JSON):

```json
{
  "version": "2.0",
  "meta": {
    "name": "My Workflow",
    "author": "User",
    "created": "2024-01-15T..."
  },
  "tools": [...],
  "wires": [...]
}
```

The `domain/workflow/services/WorkflowSerializer.ts` handles serialization/deserialization with validation.

## Electron Integration

The Electron main process (`electron/main.ts`):

1. Spawns the backend executable (or connects to running dev server)
2. Waits for backend health check
3. Creates the main window loading the React app
4. Handles native menus, file dialogs, IPC

Preload script (`electron/preload.ts`) exposes safe APIs to the renderer:

```typescript
contextBridge.exposeInMainWorld('electron', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
});
```

## Testing Strategy

Frontend tests focus on:

1. **Domain logic**: Serialization, validation, loop detection
2. **State management**: Store actions, state transitions
3. **Utilities**: ID generation, positioning algorithms

We don't exhaustively test React component rendering. The UI changes frequently during development; the underlying logic must remain stable.

See [Frontend Testing](../testing/frontend) for details.

---

Next: [Backend Architecture](./backend) or [Adding Tools](../contributing/adding-tools).
