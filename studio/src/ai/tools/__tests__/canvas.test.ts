import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@api', () => ({
  previewTool: vi.fn(async () => ({ data: [{ a: 1 }], data_schema: { columns: [{ name: 'a', dtype: 'Int64' }] }, row_count: 1 })),
}));

import { useWorkflowStore } from '@state/workflowStore';
import { addTool, batchCanvasOps, enrichToolConfig } from '../canvas';
import { resolveToolType } from '../toolTypes';

type Exec = (args: unknown, opts: unknown) => Promise<unknown>;
const run = (t: { execute?: unknown }, args: unknown) =>
  (t.execute as Exec)(args, { toolCallId: 't', messages: [] }) as Promise<Record<string, unknown>>;

beforeEach(() => {
  useWorkflowStore.getState().newWorkflow();
});

describe('resolveToolType', () => {
  it('maps display names and casing to internal types', () => {
    expect(resolveToolType('Aggregate')).toBe('Summarize');
    expect(resolveToolType('read')).toBe('Input');
    expect(resolveToolType('Concatenate')).toBe('Union');
    expect(resolveToolType('filter')).toBe('Filter');
    expect(resolveToolType('Nope')).toBeUndefined();
  });
});

describe('add_tool', () => {
  it('adds nothing when the upstream tool does not exist', async () => {
    const result = await run(addTool, { type: 'Filter', after: 'missing', comment: 'x' });
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('nothing was added');
    expect(useWorkflowStore.getState().tools).toHaveLength(0);
  });

  it('accepts a display name for the type', async () => {
    const result = await run(addTool, { type: 'Read', comment: 'load' });
    expect(String(result.data)).toContain('Added Input');
    expect(useWorkflowStore.getState().tools[0]!.type).toBe('Input');
  });

  it('reports a rejected socket instead of claiming success', async () => {
    await run(addTool, { type: 'Input', comment: 'load' });
    const inputId = useWorkflowStore.getState().tools[0]!.id;
    const result = await run(addTool, { type: 'Filter', after: inputId, fromSocket: 'nope', comment: 'f' });
    expect(String(result.data)).toContain('not connected');
    expect(useWorkflowStore.getState().wires).toHaveLength(0);
  });
});

describe('batch_canvas_ops', () => {
  it('reports wire failures per op', async () => {
    const result = await run(batchCanvasOps, {
      operations: [
        { op: 'add', refId: 'in', type: 'Input', comment: 'load' },
        { op: 'add', refId: 'f', type: 'Filter', after: 'in', fromSocket: 'bogus', comment: 'f' },
        { op: 'add', type: 'Sort', after: 'missing', comment: 's' },
      ],
    });
    const results = result.results as Array<{ success: boolean; error?: string }>;
    expect(results.map((r) => r.success)).toEqual([true, false, false]);
    expect(results[1]!.error).toContain('not connected');
    expect(results[2]!.error).toContain('not found');
    // The Sort with a missing upstream was not added
    expect(useWorkflowStore.getState().tools.map((t) => t.type)).toEqual(['Input', 'Filter']);
  });
});

describe('filter expression generation', () => {
  it('escapes quotes and backslashes in values and column names', () => {
    const result = enrichToolConfig('Filter', {
      conditions: [
        { column: 'name', operator: 'eq', value: 'O"Brien' },
        { column: 'path', operator: 'contains', value: 'C:\\tmp' },
        { column: 'we"ird', operator: 'is_null' },
      ],
      combinator: 'and',
    });
    expect(result.expression).toBe(
      '(pl.col("name") == "O\\"Brien") & (pl.col("path").str.contains("C:\\\\tmp")) & (pl.col("we\\"ird").is_null())',
    );
  });
});

describe('default output socket', () => {
  it('connects after a Join from the matched rows, not the unmatched left rows', async () => {
    const ops = await run(batchCanvasOps, {
      operations: [
        { op: 'add', refId: 'l', type: 'Input', comment: 'left' },
        { op: 'add', refId: 'r', type: 'Input', comment: 'right' },
        { op: 'add', refId: 'j', type: 'Join', after: 'l', toSocket: 'input-left', comment: 'join', config: { leftKeys: ['id'], rightKeys: ['id'] } },
        { op: 'connect', from: 'r', to: 'j', toSocket: 'input-right' },
      ],
    });
    const joinId = (ops.idMap as Record<string, string>).j!;
    await run(addTool, { type: 'Sort', after: joinId, comment: 'sort' });
    const wire = useWorkflowStore.getState().wires.find((w) => w.from.tool === joinId);
    expect(wire?.from.socket).toBe('output-match');
  });
});
