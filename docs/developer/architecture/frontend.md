---
sidebar_position: 2
---

# Frontend Architecture

The frontend is a React application wrapped in Electron for desktop deployment. It handles all user interaction—the visual canvas, tool configuration, state management—while delegating actual data processing to the backend.

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
frontend/src/
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
│   └── settingsStore.ts   # Persisted settings
│
├── domain/             # Pure TypeScript business logic
│   └── workflow/
│       ├── entities/   # Type definitions (Tool, Wire, etc.)
│       └── services/   # Serialization, validation, loop detection
│
├── api/                # Backend communication
│   ├── backend.ts      # HTTP client
│   ├── hooks.ts        # React hooks for API calls
│   └── cache.ts        # Request caching
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

Tools and wires are the domain model. Edges are the Xyflow representation—derived from wires, kept in sync automatically.

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

These are pure UI—they render form fields and emit config changes. The workflowStore handles persistence.

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
