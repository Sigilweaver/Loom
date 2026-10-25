---
sidebar_position: 4
---

# Integration Testing

Testing the Studio and Server working together.

## What Integration Tests Cover

Unit tests verify individual pieces work. Integration tests verify the pieces work together:

- Studio correctly sends requests to Server
- Server returns expected response format
- Workflow execution produces correct results
- Error conditions are handled gracefully

## Running Integration Tests

```bash
# From studio/
bun run test:integration

# Or from repo root
./scripts/test.py --integration
```

This script:
1. Starts the Server
2. Waits for health check
3. Runs integration tests
4. Shuts down the Server

## Test Structure

```typescript
// src/api/__tests__/backend.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Backend Integration', () => {
  beforeAll(async () => {
    // Wait for backend to be ready
    await waitForBackend();
  });
  
  describe('Health Check', () => {
    it('returns healthy status', async () => {
      const response = await fetch('http://localhost:25811/api/health/');
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(data.status).toBe('healthy');
    });
  });
  
  describe('Schema Endpoint', () => {
    it('returns schema for connected tool', async () => {
      const workflow = createTestWorkflow();
      
      const response = await fetch('http://localhost:25811/api/workflow/tool/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: 'filter-1',
          workflow,
        }),
      });
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data['input']).toBeDefined();
      expect(data['input'].columns).toBeInstanceOf(Array);
    });
  });
  
  describe('Preview Endpoint', () => {
    it('executes and returns preview data', async () => {
      const workflow = createWorkflowWithData();
      
      const response = await fetch('http://localhost:25811/api/workflow/tool/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: 'filter-1',
          workflow,
          preview_limit: 10,
        }),
      });
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data.length).toBeLessThanOrEqual(10);
    });
  });
  
  describe('Error Handling', () => {
    it('returns error for invalid workflow', async () => {
      const response = await fetch('http://localhost:25811/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: { invalid: true },
        }),
      });
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(422); // Validation error
    });
  });
});
```

## Test Helpers

```typescript
// test-utils/integration.ts

const BACKEND_URL = 'http://localhost:25811';

export async function waitForBackend(
  timeout = 30000,
  interval = 500
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health/`);
      if (response.ok) return;
    } catch {
      // Not ready yet
    }
    await sleep(interval);
  }
  
  throw new Error('Backend failed to start');
}

export function createTestWorkflow(): object {
  return {
    version: '2.0',
    meta: {
      name: 'Test',
      author: 'Test',
      workflowId: 'test-id',
      created: new Date().toISOString(),
    },
    tools: [
      {
        id: 'input-1',
        type: 'Input',
        x: 0,
        y: 0,
        config: { path: '/path/to/test.csv' },
        sockets: [{ id: 'output', direction: 'output' }],
      },
      {
        id: 'filter-1',
        type: 'Filter',
        x: 200,
        y: 0,
        config: { expression: 'age > 30' },
        sockets: [
          { id: 'input', direction: 'input' },
          { id: 'output-true', direction: 'output' },
          { id: 'output-false', direction: 'output' },
        ],
      },
    ],
    wires: [
      {
        from: { tool: 'input-1', socket: 'output' },
        to: { tool: 'filter-1', socket: 'input' },
      },
    ],
  };
}
```

## Manual Integration Testing

Some things are hard to automate. Manual testing checklist:

### Basic Flow
- [ ] Load a CSV file via Input tool
- [ ] Connect to Filter tool
- [ ] Configure filter expression
- [ ] Preview shows filtered results
- [ ] Connect to Output tool
- [ ] Execute writes correct file

### Error Conditions
- [ ] Invalid file path shows error
- [ ] Invalid expression shows error
- [ ] Disconnected tool shows warning
- [ ] Cycle detection prevents connection

### UI Behavior
- [ ] Tool palette drag-drop works
- [ ] Canvas pan/zoom works
- [ ] Undo/redo works
- [ ] Save/load workflow works
- [ ] Tab switching preserves state

## Electron Integration

Testing the Electron shell requires manual verification:

- [ ] Backend starts automatically in production build
- [ ] File dialogs work (open, save)
- [ ] Menu items trigger correct actions
- [ ] Window state persists (size, position)
- [ ] App quits cleanly

## CI Integration

Integration tests run in GitHub Actions:

```yaml
# .github/workflows/test.yml
jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Setup bun
        uses: oven-sh/setup-bun@v2
      
      - name: Install backend
        run: |
            cd server
            uv sync --all-extras
        
        - name: Install frontend
          run: |
            cd studio
      - name: Run integration tests
        run: ./scripts/test_integration.sh
```

## When to Write Integration Tests

- New API endpoint
- Changed request/response format
- New tool type
- Error handling changes

When not to bother:

- Pure frontend changes
- Pure backend changes with unit tests
- Styling/UI changes

---

Next: [Development Workflow](../building/development) for daily development patterns.
