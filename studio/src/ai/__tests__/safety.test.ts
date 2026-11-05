import { beforeEach, describe, expect, it, vi } from 'vitest';

const previewTool = vi.fn();
vi.mock('@api', () => ({
  previewTool: (...a: unknown[]) => previewTool(...a),
  getToolSchema: vi.fn(),
  profileColumns: vi.fn(),
  previewAllTools: vi.fn(),
}));

import { useWorkflowStore } from '@state/workflowStore';
import { useHistoryStore } from '@state/historyStore';
import { useAIStore } from '@state/aiStore';
import { getToolDefinition } from '@data/tools';
import type { Tool } from '@domain/workflow/entities/workflow';
import { requestApproval } from '../approval';
import { removeTool, batchCanvasOps } from '../tools/canvas';
import { buildWorkflowTool } from '../compilerTool';
import { previewToolOutput } from '../tools/data';
import { beginAgentTurn, commitAgentTurn } from '../agent';
import { clearTurnUndoRecords, diffWorkflows, turnUndoBlocker, undoTurn } from '../turnChanges';
import { buildWorkflowSystemPrompt } from '../prompts/system';

type Exec = (args: unknown, opts: unknown) => Promise<unknown>;
const run = (t: { execute?: unknown }, args: unknown, opts: Record<string, unknown> = {}) =>
  (t.execute as Exec)(args, { toolCallId: 't', messages: [], ...opts }) as Promise<Record<string, unknown>>;

function canvasTool(id: string, type: string, comment?: string): Tool {
  const def = getToolDefinition(type)!;
  return { id, type, x: 0, y: 0, config: { ...def.defaultConfig }, sockets: [...def.sockets], ...(comment ? { comment } : {}) };
}

function loadCanvas(): void {
  const meta = useWorkflowStore.getState().workflowMeta;
  useWorkflowStore.getState().loadWorkflow(
    [canvasTool('in1', 'Input', 'load'), canvasTool('f1', 'Filter', 'keep adults')],
    [{ from: { tool: 'in1', socket: 'output' }, to: { tool: 'f1', socket: 'input' } }],
    meta,
  );
}

/** Answer the next approval prompt once it appears. */
async function answerApproval(approved: boolean): Promise<string> {
  await vi.waitFor(() => expect(useAIStore.getState().pendingApproval).not.toBeNull());
  const pending = useAIStore.getState().pendingApproval!;
  pending.resolve(approved);
  return pending.title;
}

beforeEach(() => {
  previewTool.mockReset();
  useWorkflowStore.getState().newWorkflow();
  useHistoryStore.getState().clear();
  useAIStore.setState({ confirmDestructiveEdits: true, shareSampleData: false, pendingApproval: null });
  clearTurnUndoRecords();
});

describe('requestApproval', () => {
  it('passes straight through when confirmations are off', async () => {
    useAIStore.setState({ confirmDestructiveEdits: false });
    await expect(requestApproval({ title: 'x', details: [] })).resolves.toBe(true);
    expect(useAIStore.getState().pendingApproval).toBeNull();
  });

  it('rejects and clears the prompt on cancel', async () => {
    const controller = new AbortController();
    const p = requestApproval({ title: 'x', details: [] }, controller.signal);
    controller.abort();
    await expect(p).rejects.toThrow('Approval cancelled');
    expect(useAIStore.getState().pendingApproval).toBeNull();
  });
});

describe('destructive tools ask first', () => {
  it('remove_tool: declining changes nothing and tells the model not to retry', async () => {
    loadCanvas();
    const pending = run(removeTool, { toolId: 'in1' });
    const title = await answerApproval(false);
    expect(title).toContain('Remove Input [in1] "load"');
    const result = await pending;
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('Do not retry');
    expect(useWorkflowStore.getState().tools).toHaveLength(2);
  });

  it('remove_tool: the prompt lists the downstream tool that loses its input', async () => {
    loadCanvas();
    const pending = run(removeTool, { toolId: 'in1' });
    await vi.waitFor(() => expect(useAIStore.getState().pendingApproval).not.toBeNull());
    expect(useAIStore.getState().pendingApproval!.details).toContain('Filter [f1] "keep adults" loses its input');
    useAIStore.getState().pendingApproval!.resolve(true);
    expect((await pending).success).toBe(true);
    expect(useWorkflowStore.getState().tools.map((t) => t.id)).toEqual(['f1']);
  });

  it('batch_canvas_ops asks once for its removals', async () => {
    loadCanvas();
    const pending = run(batchCanvasOps, { operations: [{ op: 'remove', toolId: 'f1' }, { op: 'add', type: 'Sort', after: 'in1', comment: 's' }] });
    await answerApproval(false);
    await pending;
    expect(useWorkflowStore.getState().tools.map((t) => t.type)).toEqual(['Input', 'Filter']);
  });

  it('build_workflow asks before replacing a non-empty canvas, but not on an empty one', async () => {
    const spec = { steps: [{ id: 'a', type: 'Input', comment: 'x' }], connections: [] };
    await run(buildWorkflowTool, spec);
    expect(useAIStore.getState().pendingApproval).toBeNull();
    expect(useWorkflowStore.getState().tools).toHaveLength(1);

    loadCanvas();
    const pending = run(buildWorkflowTool, spec);
    const title = await answerApproval(false);
    expect(title).toContain('Replace the canvas (2 tools)');
    expect(String((await pending).error)).toContain('edit it with add_tool');
    expect(useWorkflowStore.getState().tools).toHaveLength(2);
  });
});

describe('sample data sharing', () => {
  beforeEach(() => {
    loadCanvas();
    previewTool.mockResolvedValue({
      data: [{ name: 'Alice', age: 31 }],
      data_schema: { columns: [{ name: 'name', dtype: 'String' }, { name: 'age', dtype: 'Int64' }] },
      row_count: 891,
    });
  });

  it('withholds values by default', async () => {
    const result = await run(previewToolOutput, { toolId: 'in1' });
    expect(String(result.data)).toContain('891 rows. Schema: name:str,age:i64');
    expect(String(result.data)).toContain('Sample values withheld');
    expect(String(result.data)).not.toContain('Alice');
  });

  it('sends rows when the user opted in', async () => {
    useAIStore.setState({ shareSampleData: true });
    const result = await run(previewToolOutput, { toolId: 'in1' });
    expect(String(result.data)).toContain('Alice');
  });

  it('tells the model which mode is on', () => {
    const meta = useWorkflowStore.getState().workflowMeta;
    expect(buildWorkflowSystemPrompt([], [], meta, { shareSampleData: false })).toContain('has not enabled sample data sharing');
    expect(buildWorkflowSystemPrompt([], [], meta, { shareSampleData: true })).toContain('sample rows and value statistics are available');
  });
});

describe('turn changes and undo', () => {
  it('diffs tools and wires, ignoring layout', () => {
    const a = canvasTool('a', 'Input');
    const b = canvasTool('b', 'Filter');
    const moved = { ...a, x: 500 };
    const edited = { ...b, comment: 'new' };
    const c = canvasTool('c', 'Sort');
    const meta = useWorkflowStore.getState().workflowMeta;
    const diff = diffWorkflows(
      { tools: [a, b], wires: [{ from: { tool: 'a', socket: 'output' }, to: { tool: 'b', socket: 'input' } }], meta },
      { tools: [moved, edited, c], wires: [], meta },
    );
    expect(diff.added).toEqual(['Sort [c]']);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual(['Filter [b] (new)']);
    expect(diff.wiresRemoved).toBe(1);
  });

  it('undoes exactly the turn, and only while nothing else changed', () => {
    loadCanvas();
    beginAgentTurn();
    useWorkflowStore.getState().removeTool('f1');
    const changes = commitAgentTurn('msg-1');
    expect(changes?.removed).toEqual(['Filter [f1] (keep adults)']);

    expect(turnUndoBlocker('msg-1')).toBeNull();
    expect(undoTurn('msg-1')).toBe(true);
    expect(useWorkflowStore.getState().tools.map((t) => t.id)).toEqual(['in1', 'f1']);
    // Redo is still possible through history
    expect(useHistoryStore.getState().canRedo()).toBe(true);
  });

  it('refuses when the user edited the canvas after the turn', () => {
    loadCanvas();
    beginAgentTurn();
    useWorkflowStore.getState().removeTool('f1');
    commitAgentTurn('msg-2');
    useWorkflowStore.getState().updateToolComment('in1', 'user edit');
    expect(turnUndoBlocker('msg-2')).toContain('changed after this turn');
    expect(undoTurn('msg-2')).toBe(false);
    expect(useWorkflowStore.getState().tools).toHaveLength(1);
  });

  it('a turn that changed nothing reports nothing', () => {
    loadCanvas();
    beginAgentTurn();
    expect(commitAgentTurn('msg-3')).toBeNull();
    expect(turnUndoBlocker('msg-3')).not.toBeNull();
  });
});

describe('error text when sample sharing is off', () => {
  it('withholds quoted values but keeps column names and dtypes', async () => {
    const { redactErrorValues } = await import('../dataSharing');
    expect(redactErrorValues("conversion from `str` to `i64` failed in column 'age' for 2 out of 891 values: [\"abc\", \"x\"]"))
      .toBe("conversion from `str` to `i64` failed in column 'age' for 2 out of 891 values: [values withheld]");
    expect(redactErrorValues('could not parse `O"Brien` as dtype `i64`')).toBe('could not parse <value withheld> as dtype `i64`');
    expect(redactErrorValues('unexpected value "secret-42" in column "id"')).toBe('unexpected value <value withheld> in column "id"');
  });

  it('applies to every guarded tool result unless the user opted in', async () => {
    const { guardTools } = await import('../loop');
    const tools = guardTools({
      bad: { description: 'x', inputSchema: {} as never, execute: async () => ({ error: 'cast failed for values: ["alice@example.com"]' }) } as never,
    }) as Record<string, { execute?: unknown }>;
    expect(String((await run(tools.bad!, {})).error)).not.toContain('alice@example.com');
    useAIStore.setState({ shareSampleData: true });
    expect(String((await run(tools.bad!, {})).error)).toContain('alice@example.com');
  });
});

describe('turn undo guards', () => {
  it('is blocked while a turn is running', () => {
    loadCanvas();
    beginAgentTurn();
    useWorkflowStore.getState().removeTool('f1');
    commitAgentTurn('msg-run');
    useAIStore.setState({ isGenerating: true });
    expect(turnUndoBlocker('msg-run')).toContain('Wait for the assistant');
    expect(undoTurn('msg-run')).toBe(false);
    useAIStore.setState({ isGenerating: false });
  });

  it('can be undone again after Redo', () => {
    loadCanvas();
    beginAgentTurn();
    useWorkflowStore.getState().removeTool('f1');
    commitAgentTurn('msg-redo');
    expect(undoTurn('msg-redo')).toBe(true);
    expect(turnUndoBlocker('msg-redo')).toContain('Undone');
    const snapshot = useHistoryStore.getState().redo()!;
    useWorkflowStore.getState().loadWorkflow(snapshot.tools, snapshot.wires, snapshot.meta);
    expect(turnUndoBlocker('msg-redo')).toBeNull();
  });
});
