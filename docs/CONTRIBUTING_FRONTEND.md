# Frontend Contributor Guide

Quick reference for React/TypeScript/Electron frontend development.

## Setup

```bash
cd frontend
npm install
```

## Run & Test

```bash
# Development
npm run dev              # Vite dev server (http://localhost:5173)
npm run electron         # Launch Electron (needs dev server running)

# Testing
npm test                 # All tests (Vitest)
npm run test:watch       # Watch mode
npm run test:unit        # Domain/state only
npm run test:coverage    # With coverage report

# Quality checks
npm run type-check       # TypeScript
npm run lint             # ESLint
npm run lint:fix         # Auto-fix
npm run verify           # All checks (CI equivalent)
```

## Project Structure

```
frontend/
  src/
    App.tsx              # Main component
    main.tsx             # Entry point
    api/                 # Backend client & hooks
    components/          # React components
      canvas/            # Workflow canvas
      panels/            # Side panels (config, preview, etc.)
      ui/                # Shared UI components
    data/
      tools.ts           # Tool definitions (the registry!)
    domain/              # Pure TypeScript business logic
      workflow/          # Serialization, validation
    state/               # Zustand stores
      workflowStore.ts   # Tools, wires, selection
      historyStore.ts    # Undo/redo
    types/               # TypeScript interfaces
  electron/
    main.ts              # Electron main process
    preload.ts           # IPC bridge
  tests/                 # Additional test files
```

## Adding a New Tool (Frontend Side)

### 1. Define the tool

`src/data/tools.ts`:

```typescript
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ... existing tools
  {
    type: 'MyTool',           // Must match @register_tool("MyTool") in backend
    name: 'My Tool',
    icon: '🔧',               // Emojis OK for UI icons
    category: 'preparation',  // preparation | join | aggregate | in-out
    defaultConfig: {
      minAge: 0,
      enabled: true,
    },
    sockets: [
      { id: 0, direction: 'input', label: 'Data In' },
      { id: 1, direction: 'output', label: 'Data Out' },
    ],
  },
];
```

### 2. Create config panel (if custom UI needed)

`src/components/panels/config/MyToolConfig.tsx`:

```typescript
import { Tool } from '@/types/workflow';

interface Props {
  tool: Tool;
  onConfigChange: (config: Partial<Tool['config']>) => void;
}

export function MyToolConfig({ tool, onConfigChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Min Age</span>
        <input
          type="number"
          value={tool.config.minAge ?? 0}
          onChange={(e) => onConfigChange({ minAge: Number(e.target.value) })}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </label>
    </div>
  );
}
```

### 3. Register in config panel router

`src/components/panels/config/ConfigPanel.tsx`:

```typescript
// Add case for your tool
case 'MyTool':
  return <MyToolConfig tool={tool} onConfigChange={handleConfigChange} />;
```

### 4. Write tests

`src/components/panels/config/__tests__/MyToolConfig.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MyToolConfig } from '../MyToolConfig';

describe('MyToolConfig', () => {
  it('updates minAge on change', () => {
    const onConfigChange = vi.fn();
    const tool = { id: '1', type: 'MyTool', config: { minAge: 10 } };
    
    render(<MyToolConfig tool={tool} onConfigChange={onConfigChange} />);
    
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } });
    expect(onConfigChange).toHaveBeenCalledWith({ minAge: 25 });
  });
});
```

## State Management

Zustand stores with Immer for immutable updates:

```typescript
import { useWorkflowStore } from '@/state/workflowStore';
import { useHistoryStore } from '@/state/historyStore';

// Reading state
const tools = useWorkflowStore((s) => s.tools);
const selectedTool = useWorkflowStore((s) => s.selectedToolId);

// Mutations (always push history first for undo/redo)
const { pushState } = useHistoryStore();
const { updateToolConfiguration } = useWorkflowStore();

pushState(tools, wires, meta);  // Capture before mutation
updateToolConfiguration(toolId, { minAge: 25 });
```

## API Integration

```typescript
import { useSchema, usePreview } from '@/api/hooks';
import { WorkflowSerializer } from '@/domain/workflow/services/WorkflowSerializer';

// Fetch schema (for column dropdowns)
const { fetchSchema, getColumns } = useSchema();
const workflow = WorkflowSerializer.toJSON(tools, wires, meta);
await fetchSchema(toolId, JSON.parse(workflow));
const columns = getColumns(socketId);  // [{name, dtype, nullable}]

// Preview execution
const { executePreview, getData } = usePreview();
await executePreview(toolId, JSON.parse(workflow), 100);
const rows = getData(socketId);
```

## Key Rules

1. **Push history before mutations** - Or undo/redo breaks.

2. **Use WorkflowSerializer** - Don't manually build workflow JSON.

3. **Socket IDs must match backend** - Check `tools.ts` against Python tool.

4. **Sync edges after wire changes** - Call `syncEdges()` after mutations.

5. **Domain logic is pure TypeScript** - No React in `src/domain/`.

## Component Patterns

```typescript
// Prefer functional components with hooks
export function MyComponent({ data }: Props) {
  const [state, setState] = useState(initial);
  
  // Derive values, don't duplicate state
  const filtered = useMemo(() => data.filter(...), [data]);
  
  return <div>...</div>;
}

// Extract hooks for reusable logic
function useMyFeature() {
  const store = useWorkflowStore((s) => s.tools);
  // ...
  return { tools, actions };
}
```

## Debugging

```typescript
// Zustand devtools (browser console)
window.__ZUSTAND_STORES__

// React DevTools
// Install browser extension

// Check backend connection
fetch('http://localhost:8000/api/health/')
  .then(r => r.json())
  .then(console.log);
```

## Common Issues

**Tool not appearing**: Check `type` matches backend exactly (case-sensitive).

**Config not saving**: Are you calling `onConfigChange` with the right shape?

**Undo not working**: Did you call `pushState()` before the mutation?

**API errors**: Is backend running? Check CORS in `backend/app/config.py`.

**Type errors**: Run `npm run type-check` to see all issues.
