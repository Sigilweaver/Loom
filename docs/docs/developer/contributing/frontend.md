---
sidebar_position: 3
---

# Frontend Patterns

Conventions and patterns for frontend development. These aren't arbitrary rules—they solve real problems encountered during development.

## Component Structure

### File Organization

```
components/
├── Canvas.tsx                  # Top-level canvas wrapper
├── ToolPalette.tsx             # Tool library sidebar
├── ConfigurationPanel.tsx      # Selected tool config
├── FilterConfiguration.tsx     # Per-tool config components
├── SelectConfiguration.tsx     # (named *Configuration.tsx)
├── FormulaConfiguration.tsx
├── primitives/                 # Reusable config UI primitives
│   ├── ConfigText.tsx
│   ├── ConfigSelect.tsx
│   └── ConfigNumber.tsx
└── ui/                         # Shared UI primitives
    ├── Button.tsx
    └── Input.tsx
```

One component per file. Name the file after the component.

### Component Pattern

```typescript
// Prefer this pattern
interface Props {
  tool: Tool;
  onConfigChange: (config: Partial<Tool['config']>) => void;
}

export function MyComponent({ tool, onConfigChange }: Props) {
  // Hooks at the top
  const [localState, setLocalState] = useState(initial);
  const store = useWorkflowStore((s) => s.tools);
  
  // Derived values
  const isValid = tool.config.expression !== '';
  
  // Handlers
  const handleChange = useCallback((value: string) => {
    onConfigChange({ expression: value });
  }, [onConfigChange]);
  
  // Early returns for edge cases
  if (!tool) return null;
  
  // Render
  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}
```

### Avoid

```typescript
// Don't use class components
class MyComponent extends React.Component { ... }

// Don't inline complex logic in JSX
<div onClick={() => {
  const x = compute();
  store.update(x);
  if (x > 10) navigate('/');
}}>

// Don't destructure store calls (causes re-renders)
const { tools, wires, addTool } = useWorkflowStore();

// Do this instead
const tools = useWorkflowStore((s) => s.tools);
const addTool = useWorkflowStore((s) => s.addTool);
```

## State Management

### Store Subscriptions

Subscribe to specific slices to minimize re-renders:

```typescript
// Bad - re-renders on ANY store change
const store = useWorkflowStore();

// Good - re-renders only when tools change
const tools = useWorkflowStore((s) => s.tools);

// Good - multiple subscriptions are fine
const tools = useWorkflowStore((s) => s.tools);
const selectedTool = useWorkflowStore((s) => s.selectedTool);
```

### History Management

Always push history before mutations for undo/redo:

```typescript
const { pushState } = useHistoryStore.getState();
const { tools, wires, workflowMeta, addTool } = useWorkflowStore.getState();

// Capture state BEFORE mutation
pushState(tools, wires, workflowMeta);

// Then mutate
addTool(newTool);
```

### Cross-Store Communication

Stores can read each other:

```typescript
// Inside a store action
updateToolConfiguration: (toolId, config) => {
  // Read from another store
  const settings = useSettingsStore.getState();
  
  set((state) => {
    // Update logic using settings
  });
}
```

## API Integration

### Fetching Schema

```typescript
import { useSchema } from '@/api/hooks';
import { useWorkflowStore } from '@/state/workflowStore';

function MyConfig({ tool }) {
  const { schema, loading, fetchSchema, getColumns } = useSchema();
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const meta = useWorkflowStore((s) => s.workflowMeta);
  
  useEffect(() => {
    const workflow = WorkflowSerializer.toJSON(tools, wires, meta);
    fetchSchema(tool.id, JSON.parse(workflow));
  }, [tool.id, wires]); // Refetch when connections change
  
  const columns = getColumns('input');
  // columns: [{name: "age", dtype: "Int64", nullable: false}, ...]
}
```

### Previewing Data

```typescript
const { data, loading, executePreview } = usePreview();

const handlePreview = async () => {
  const workflow = WorkflowSerializer.toJSON(tools, wires, meta);
  await executePreview(tool.id, JSON.parse(workflow), 100);
};

// data[socketId] contains the preview rows
```

## Styling

### Tailwind Conventions

```typescript
// Use Tailwind utilities
<div className="flex items-center gap-2 p-4 bg-white rounded shadow">

// Theme-aware colors
<div className="bg-background text-foreground border-border">

// Responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// States
<button className="hover:bg-accent active:scale-95 disabled:opacity-50">
```

### Theme Integration

Access theme colors in JavaScript when needed:

```typescript
import { getThemeColor } from '@/utils/themeColors';

const color = getThemeColor('accent');
```

### Avoid

```typescript
// Don't use inline styles unless dynamic
<div style={{ color: 'red' }}>  // Bad

// Do this instead
<div className="text-red-500">  // Good

// Or for dynamic values
<div style={{ width: `${percentage}%` }}>  // OK when truly dynamic
```

## Testing

### What to Test

```typescript
// Test behavior, not implementation
it('calls onConfigChange when input changes', () => {
  const onChange = vi.fn();
  render(<MyConfig tool={mockTool} onConfigChange={onChange} />);
  
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });
  
  expect(onChange).toHaveBeenCalledWith({ expression: 'new' });
});

// Test user-visible outcomes
it('shows error message for invalid input', () => {
  render(<MyConfig tool={invalidTool} />);
  expect(screen.getByText(/invalid expression/i)).toBeInTheDocument();
});
```

### What Not to Test

```typescript
// Don't test implementation details
it('sets internal state to X')  // Bad - tests implementation

// Don't test Tailwind classes
it('has the correct className')  // Bad - brittle

// Don't snapshot test frequently-changing UI
it.skip('matches snapshot')  // Will break constantly
```

### Mocking

```typescript
// Mock stores
vi.mock('@/state/workflowStore', () => ({
  useWorkflowStore: vi.fn((selector) => selector({
    tools: [],
    wires: [],
    addTool: vi.fn(),
  })),
}));

// Mock API
vi.mock('@/api/hooks', () => ({
  useSchema: () => ({
    schema: mockSchema,
    loading: false,
    fetchSchema: vi.fn(),
  }),
}));
```

## Common Patterns

### Debounced Input

For inputs that trigger API calls:

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedUpdate = useDebouncedCallback(
  (value: string) => onConfigChange({ expression: value }),
  300
);

<input
  value={localValue}
  onChange={(e) => {
    setLocalValue(e.target.value);
    debouncedUpdate(e.target.value);
  }}
/>
```

### Conditional Rendering

```typescript
// Prefer early returns
if (loading) return <Spinner />;
if (error) return <Error message={error} />;
if (!data) return null;

return <DataDisplay data={data} />;

// Avoid deeply nested ternaries
{loading ? <Spinner /> : error ? <Error /> : data ? <Data /> : null}  // Hard to read
```

### Event Handlers

```typescript
// Define handlers outside JSX
const handleClick = useCallback(() => {
  // Complex logic
}, [dependency]);

<button onClick={handleClick}>

// OK to inline simple handlers
<button onClick={() => setOpen(true)}>
```

## Domain Logic

Keep pure TypeScript logic in `src/domain/`:

```typescript
// src/domain/workflow/services/WorkflowSerializer.ts

export class WorkflowSerializer {
  static toJSON(tools: Tool[], wires: Wire[], meta: WorkflowMeta): string {
    // Pure logic, no React, no side effects
  }
  
  static fromJSON(json: string): { tools: Tool[], wires: Wire[], meta: WorkflowMeta } {
    // Validation, parsing
  }
}
```

This logic is testable without React, usable in workers, and easy to reason about.

---

Next: [Backend Patterns](./backend) or [Testing Philosophy](../testing/philosophy).
