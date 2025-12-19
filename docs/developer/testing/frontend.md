---
sidebar_position: 3
---

# Frontend Testing

Patterns and practices for testing the TypeScript/React frontend.

## Framework

- **Vitest** for test execution (Vite-native, fast)
- **React Testing Library** for component tests
- **jsdom** for DOM environment

## Running Tests

```bash
cd frontend

# All unit tests
npm test

# Watch mode (re-runs on change)
npm run test:watch

# With coverage
npm run test:coverage

# Specific file
npm test WorkflowSerializer

# Integration tests (requires backend)
npm run test:integration
```

## Test Organization

```
frontend/src/
├── __tests__/
│   └── type-contracts.test.ts      # Frontend/backend contract tests
├── domain/
│   └── workflow/
│       └── services/
│           └── __tests__/
│               ├── WorkflowSerializer.test.ts
│               └── loopDetection.test.ts
├── state/
│   └── __tests__/
│       ├── workflowStore.test.ts
│       ├── historyStore.test.ts
│       └── store-integration.test.ts
├── hooks/
│   └── __tests__/
│       └── useToolConfiguration.test.ts
├── utils/
│   └── __tests__/
│       ├── id.test.ts
│       └── alignDistribute.test.ts
├── components/
│   ├── __tests__/
│   │   ├── FilterConfiguration.test.tsx
│   │   └── FormulaConfiguration.test.tsx
│   └── primitives/
│       └── __tests__/
│           ├── ConfigText.test.tsx
│           └── ConfigSelect.test.tsx
└── api/
    └── __tests__/
        └── backend.test.ts
```

Tests live next to what they test, in `__tests__` directories.

## Domain Logic Testing

Pure TypeScript, no React. These are the most valuable tests.

### Serialization Tests

```typescript
import { describe, it, expect } from 'vitest';
import { WorkflowSerializer } from '../WorkflowSerializer';
import { createTestTool, createTestWire } from '@/test-utils';

describe('WorkflowSerializer', () => {
  describe('toJSON', () => {
    it('serializes tools correctly', () => {
      const tools = [createTestTool('t1', 'Input')];
      const wires = [];
      const meta = createTestMeta();
      
      const json = WorkflowSerializer.toJSON(tools, wires, meta);
      const parsed = JSON.parse(json);
      
      expect(parsed.tools).toHaveLength(1);
      expect(parsed.tools[0].type).toBe('Input');
    });
    
    it('preserves wire connections', () => {
      const tools = [
        createTestTool('t1', 'Input'),
        createTestTool('t2', 'Filter'),
      ];
      const wires = [createTestWire('t1', 'output', 't2', 'input')];
      
      const json = WorkflowSerializer.toJSON(tools, wires, createTestMeta());
      const parsed = JSON.parse(json);
      
      expect(parsed.wires).toHaveLength(1);
      expect(parsed.wires[0].from.tool).toBe('t1');
    });
  });
  
  describe('fromJSON', () => {
    it('round-trips without data loss', () => {
      const original = {
        tools: [createTestTool('t1', 'Input')],
        wires: [],
        meta: createTestMeta(),
      };
      
      const json = WorkflowSerializer.toJSON(
        original.tools, 
        original.wires, 
        original.meta
      );
      const restored = WorkflowSerializer.fromJSON(json);
      
      expect(restored.tools).toEqual(original.tools);
    });
  });
});
```

### Loop Detection Tests

```typescript
import { describe, it, expect } from 'vitest';
import { wouldCreateCycle } from '../loopDetection';

describe('wouldCreateCycle', () => {
  it('returns false for valid connections', () => {
    const tools = [
      { id: 'a', ... },
      { id: 'b', ... },
    ];
    const wires = [];
    const newWire = { from: { tool: 'a' }, to: { tool: 'b' } };
    
    expect(wouldCreateCycle(tools, wires, newWire)).toBe(false);
  });
  
  it('returns true for direct cycle', () => {
    const tools = [
      { id: 'a', ... },
      { id: 'b', ... },
    ];
    const wires = [
      { from: { tool: 'a' }, to: { tool: 'b' } },
    ];
    const newWire = { from: { tool: 'b' }, to: { tool: 'a' } };
    
    expect(wouldCreateCycle(tools, wires, newWire)).toBe(true);
  });
  
  it('returns true for transitive cycle', () => {
    const tools = [
      { id: 'a', ... },
      { id: 'b', ... },
      { id: 'c', ... },
    ];
    const wires = [
      { from: { tool: 'a' }, to: { tool: 'b' } },
      { from: { tool: 'b' }, to: { tool: 'c' } },
    ];
    const newWire = { from: { tool: 'c' }, to: { tool: 'a' } };
    
    expect(wouldCreateCycle(tools, wires, newWire)).toBe(true);
  });
});
```

## State Store Testing

Testing Zustand stores directly:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from '../workflowStore';
import { createTestTool, createTestWire } from '@/test-utils';

describe('workflowStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useWorkflowStore.getState().clear();
  });
  
  describe('addTool', () => {
    it('adds tool to state', () => {
      const tool = createTestTool('t1', 'Input');
      
      useWorkflowStore.getState().addTool(tool);
      
      const { tools } = useWorkflowStore.getState();
      expect(tools).toHaveLength(1);
      expect(tools[0].id).toBe('t1');
    });
  });
  
  describe('addWire', () => {
    it('creates valid connection', () => {
      const t1 = createTestTool('t1', 'Input');
      const t2 = createTestTool('t2', 'Filter');
      useWorkflowStore.getState().addTool(t1);
      useWorkflowStore.getState().addTool(t2);
      
      const result = useWorkflowStore.getState().addWire({
        from: { tool: 't1', socket: 'output' },
        to: { tool: 't2', socket: 'input' },
      });
      
      expect(result.success).toBe(true);
      expect(useWorkflowStore.getState().wires).toHaveLength(1);
    });
    
    it('rejects cycle-creating connection', () => {
      // Setup: t1 -> t2
      // Attempt: t2 -> t1 (would create cycle)
      
      const result = useWorkflowStore.getState().addWire({
        from: { tool: 't2', socket: 'output' },
        to: { tool: 't1', socket: 'input' },
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('cycle');
    });
  });
  
  describe('updateToolConfiguration', () => {
    it('updates config immutably', () => {
      const tool = createTestTool('t1', 'Filter', { expression: '' });
      useWorkflowStore.getState().addTool(tool);
      
      useWorkflowStore.getState().updateToolConfiguration('t1', {
        expression: 'age > 30',
      });
      
      const updated = useWorkflowStore.getState().tools[0];
      expect(updated.config.expression).toBe('age > 30');
      
      // Original unchanged (immutability)
      expect(tool.config.expression).toBe('');
    });
  });
});
```

### History Store Tests

```typescript
describe('historyStore', () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
  });
  
  it('tracks state changes', () => {
    const state1 = createSnapshot([]);
    const state2 = createSnapshot([createTestTool()]);
    
    useHistoryStore.getState().pushState(state1);
    useHistoryStore.getState().pushState(state2);
    
    expect(useHistoryStore.getState().canUndo()).toBe(true);
  });
  
  it('undoes to previous state', () => {
    const tool = createTestTool();
    useHistoryStore.getState().pushState(createSnapshot([]));
    useHistoryStore.getState().pushState(createSnapshot([tool]));
    
    const restored = useHistoryStore.getState().undo();
    
    expect(restored.tools).toHaveLength(0);
  });
  
  it('limits history size', () => {
    for (let i = 0; i < 100; i++) {
      useHistoryStore.getState().pushState(createSnapshot([]));
    }
    
    // Should cap at max size (e.g., 50)
    expect(useHistoryStore.getState().past.length).toBeLessThanOrEqual(50);
  });
});
```

## Hook Testing

### useToolConfiguration Tests

The `useToolConfiguration` hook is tested with React Testing Library's `renderHook`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useToolConfiguration } from '../useToolConfiguration';
import { CommonSockets } from '@domain/workflow/constants/socketIds';

describe('useToolConfiguration', () => {
  const mockOnChange = vi.fn();
  
  beforeEach(() => {
    mockOnChange.mockClear();
  });
  
  it('detects connected inputs', () => {
    const tools = [createTestTool('input', 'Input'), createTestTool('filter', 'Filter')];
    const wires = [createTestWire('input', 'output', 'filter', 'input')];
    
    const { result } = renderHook(() => useToolConfiguration({
      toolId: 'filter',
      socketId: CommonSockets.INPUT,
      tools,
      wires,
      workflowMeta: createTestMeta(),
      config: {},
      onChange: mockOnChange,
    }));
    
    expect(result.current.hasInput).toBe(true);
  });
  
  it('generates stable connectionKey', () => {
    const wires = [createTestWire('a', 'output', 'target', 'input')];
    
    const { result, rerender } = renderHook(() => useToolConfiguration({...}));
    const key1 = result.current.connectionKey;
    
    rerender();
    
    expect(result.current.connectionKey).toBe(key1);
  });
  
  it('refetches metadata when connections change', async () => {
    const fetchMetadata = vi.fn();
    vi.mock('../api/hooks', () => ({
      useMetadata: () => ({
        columns: [],
        loading: false,
        error: null,
        fetchMetadata,
      }),
    }));
    
    const wires1 = [createTestWire('a', 'output', 'target', 'input')];
    const wires2 = [createTestWire('b', 'output', 'target', 'input')];
    
    const { rerender } = renderHook(
      ({ wires }) => useToolConfiguration({ toolId: 'target', wires, ... }),
      { initialProps: { wires: wires1 } }
    );
    
    await waitFor(() => expect(fetchMetadata).toHaveBeenCalledTimes(1));
    
    rerender({ wires: wires2 });
    
    await waitFor(() => expect(fetchMetadata).toHaveBeenCalledTimes(2));
  });
  
  it('updateField tracks emission', () => {
    const { result } = renderHook(() => useToolConfiguration({
      config: { expression: '' },
      onChange: mockOnChange,
      ...
    }));
    
    act(() => {
      result.current.updateField('expression', 'age > 30');
    });
    
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        expression: 'age > 30',
        _emit: { expression: true },
      })
    );
  });
});
```

## Type Contract Testing

Type contract tests validate that frontend and backend stay in sync.

### Socket ID Contracts

```typescript
// src/__tests__/type-contracts.test.ts
import { describe, it, expect } from 'vitest';
import { CommonSockets, FilterSockets, JoinSockets } from '@domain/workflow/constants/socketIds';
import { TOOL_DEFINITIONS } from '@/data/tools';

describe('Socket ID Contracts', () => {
  it('Filter tool uses correct socket IDs', () => {
    const filterDef = TOOL_DEFINITIONS.find(t => t.type === 'Filter')!;
    const socketIds = filterDef.sockets.map(s => s.id);
    
    expect(socketIds).toContain(FilterSockets.INPUT);
    expect(socketIds).toContain(FilterSockets.OUTPUT_TRUE);
    expect(socketIds).toContain(FilterSockets.OUTPUT_FALSE);
  });
  
  it('Join tool uses correct socket IDs', () => {
    const joinDef = TOOL_DEFINITIONS.find(t => t.type === 'Join')!;
    const socketIds = joinDef.sockets.map(s => s.id);
    
    expect(socketIds).toContain(JoinSockets.INPUT_LEFT);
    expect(socketIds).toContain(JoinSockets.INPUT_RIGHT);
    expect(socketIds).toContain(JoinSockets.OUTPUT_LEFT);
    expect(socketIds).toContain(JoinSockets.OUTPUT_MATCH);
    expect(socketIds).toContain(JoinSockets.OUTPUT_RIGHT);
  });
});
```

### Workflow Serialization Contracts

```typescript
describe('Workflow Serialization Contracts', () => {
  it('produces valid workflow JSON for backend', () => {
    const tools = [
      createTestTool('input', 'Input', { path: '/data/test.csv' }),
      createTestTool('filter', 'Filter', { expression: 'age > 30' }),
    ];
    const wires = [createTestWire('input', 'output', 'filter', 'input')];
    
    const json = WorkflowSerializer.toJSON(tools, wires, createTestMeta());
    const workflow = JSON.parse(json);
    
    // Validate structure matches backend Pydantic models
    expect(workflow).toHaveProperty('version');
    expect(workflow).toHaveProperty('meta.workflow_id');
    expect(workflow).toHaveProperty('tools');
    expect(workflow).toHaveProperty('wires');
    
    // Tools have required fields
    for (const tool of workflow.tools) {
      expect(tool).toHaveProperty('id');
      expect(tool).toHaveProperty('type');
      expect(tool).toHaveProperty('config');
      expect(tool).toHaveProperty('sockets');
      expect(tool).toHaveProperty('position');
    }
    
    // Wires have required fields
    for (const wire of workflow.wires) {
      expect(wire).toHaveProperty('from.tool');
      expect(wire).toHaveProperty('from.socket');
      expect(wire).toHaveProperty('to.tool');
      expect(wire).toHaveProperty('to.socket');
    }
  });
});
```

These tests ensure that changes to either frontend or backend serialization formats are caught before they cause runtime errors.

## Component Testing

Light coverage for components. Focus on behavior, not rendering.

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfigText } from '../ConfigText';

describe('ConfigText', () => {
  it('renders current value', () => {
    render(<ConfigText value="hello" onChange={() => {}} />);
    
    expect(screen.getByRole('textbox')).toHaveValue('hello');
  });
  
  it('calls onChange when input changes', () => {
    const onChange = vi.fn();
    render(<ConfigText value="" onChange={onChange} />);
    
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'new value' },
    });
    
    expect(onChange).toHaveBeenCalledWith('new value', expect.anything(), true);
  });
  
  it('shows validation error', () => {
    render(
      <ConfigText 
        value="" 
        onChange={() => {}} 
        required 
        errorMessage="Field is required"
      />
    );
    
    expect(screen.getByText('Field is required')).toBeInTheDocument();
  });
});
```

### Testing with Store Dependencies

Mock the store:

```typescript
import { vi } from 'vitest';

vi.mock('@/state/workflowStore', () => ({
  useWorkflowStore: vi.fn((selector) => 
    selector({
      tools: [],
      wires: [],
      selectedTool: null,
      addTool: vi.fn(),
    })
  ),
}));
```

Or provide test values:

```typescript
import { useWorkflowStore } from '@/state/workflowStore';

beforeEach(() => {
  useWorkflowStore.setState({
    tools: [createTestTool()],
    wires: [],
  });
});
```

## Test Utilities

Create helpers for common patterns:

```typescript
// test-utils.ts

export function createTestTool(
  id = 'test-tool',
  type = 'Input',
  config = {},
): Tool {
  return {
    id,
    type,
    x: 0,
    y: 0,
    config,
    sockets: getDefaultSockets(type),
  };
}

export function createTestWire(
  fromTool: string,
  fromSocket: string,
  toTool: string,
  toSocket: string,
): Wire {
  return {
    from: { tool: fromTool, socket: fromSocket },
    to: { tool: toTool, socket: toSocket },
  };
}

export function createTestMeta(): WorkflowMeta {
  return {
    name: 'Test Workflow',
    description: '',
    author: 'Test',
    workflowId: 'test-id',
    created: new Date().toISOString(),
  };
}
```

## What Not to Test

```typescript
// Don't test implementation details
it('sets internal state to X')  // Bad

// Don't test CSS classes
expect(element).toHaveClass('bg-blue-500')  // Bad - brittle

// Don't snapshot test frequently-changing UI
expect(component).toMatchSnapshot()  // Bad - constant updates

// Don't test third-party libraries
it('React Flow renders nodes')  // Their problem, not ours
```

## Integration Tests

For testing frontend + backend together:

```typescript
// test:integration script starts backend first

describe('API Integration', () => {
  it('fetches schema from backend', async () => {
    const workflow = createTestWorkflow();
    
    const response = await fetch('/api/schema/', {
      method: 'POST',
      body: JSON.stringify({ tool_id: 'filter', workflow }),
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.columns).toBeDefined();
  });
});
```

Run with:

```bash
npm run test:integration
```

This starts the backend, runs integration tests, then stops the backend.

---

Next: [Integration Testing](./integration) for end-to-end testing approach.
