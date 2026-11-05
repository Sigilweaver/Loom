import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelMessage, Tool } from 'ai';

const previewAllTools = vi.fn();
vi.mock('@api', () => ({
  previewAllTools: (...args: unknown[]) => previewAllTools(...args),
  previewTool: vi.fn(),
}));

import { capToolResult, guardTools, truncateText, withAnthropicStepCache, MAX_TOOL_RESULT_CHARS } from '../loop';
import { getToolConfig, validateWorkflowTool } from '../tools/inspect';
import { askUser } from '../tools/interaction';
import { formatCanvasState, CANVAS_DETAIL_CHAR_BUDGET } from '../prompts/system';
import { useWorkflowStore } from '@state/workflowStore';
import { useAIStore } from '@state/aiStore';
import { getToolDefinition } from '@data/tools';
import type { Tool as CanvasTool } from '@domain/workflow/entities/workflow';

type Exec = (args: unknown, opts: unknown) => Promise<unknown>;
const run = (t: { execute?: unknown }, args: unknown, opts: Record<string, unknown> = {}) =>
  (t.execute as Exec)(args, { toolCallId: 't', messages: [], ...opts }) as Promise<Record<string, unknown>>;

function canvasTool(id: string, type: string, config: Record<string, unknown> = {}, comment?: string): CanvasTool {
  const def = getToolDefinition(type)!;
  return { id, type, x: 0, y: 0, config: { ...def.defaultConfig, ...config } as CanvasTool["config"], sockets: [...def.sockets], ...(comment ? { comment } : {}) };
}

beforeEach(() => {
  previewAllTools.mockReset();
  useWorkflowStore.getState().newWorkflow();
});

describe('tool result capping', () => {
  it('keeps small results untouched', () => {
    const r = { data: 'ok', idMap: { a: 'b' } };
    expect(capToolResult(r)).toBe(r);
  });

  it('truncates long compact text and keeps the other fields', () => {
    const data = Array.from({ length: 5000 }, (_, i) => `row ${i}`).join('\n');
    const capped = capToolResult({ data, idMap: { a: 'b' } }) as { data: string; idMap: unknown };
    expect(capped.idMap).toEqual({ a: 'b' });
    expect(JSON.stringify(capped).length).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS + 400);
    expect(capped.data).toContain('[truncated: showed');
  });

  it('truncates structured results to text', () => {
    const big = { files: Array.from({ length: 3000 }, (_, i) => ({ path: `/data/file_${i}.csv` })) };
    const capped = capToolResult(big) as { data: string; truncated: boolean };
    expect(capped.truncated).toBe(true);
    expect(capped.data.length).toBeLessThan(MAX_TOOL_RESULT_CHARS + 200);
  });

  it('cuts at a line boundary', () => {
    expect(truncateText('aaaa\nbbbb\ncccc', 11).startsWith('aaaa\nbbbb\n...')).toBe(true);
  });
});

describe('guardTools', () => {
  it('turns a thrown error into a readable tool error', async () => {
    const tools = guardTools({
      boom: { description: 'x', inputSchema: {} as never, execute: async () => { throw new Error('disk full'); } } as unknown as Tool,
    });
    expect(await run(tools.boom!, {})).toEqual({ error: 'boom failed: disk full' });
  });

  it('rethrows aborts so cancellation stops the loop', async () => {
    const controller = new AbortController();
    controller.abort();
    const tools = guardTools({
      slow: { description: 'x', inputSchema: {} as never, execute: async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); } } as unknown as Tool,
    });
    await expect(run(tools.slow!, {}, { abortSignal: controller.signal })).rejects.toThrow('aborted');
  });
});

describe('withAnthropicStepCache', () => {
  it('keeps one breakpoint, on the newest message, and leaves system alone', () => {
    const cc = { anthropic: { cacheControl: { type: 'ephemeral' } } };
    const messages: ModelMessage[] = [
      { role: 'system', content: 'stable', providerOptions: cc },
      { role: 'user', content: 'hi', providerOptions: cc },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'next' },
    ];
    const out = withAnthropicStepCache({ messages }).messages;
    const marked = out.map((m) => Boolean((m.providerOptions?.anthropic as { cacheControl?: unknown } | undefined)?.cacheControl));
    expect(marked).toEqual([true, false, false, true]);
  });
});

describe('get_tool_config', () => {
  it('returns the full config and connections', async () => {
    const longExpr = `pl.col("a") + ${'1 + '.repeat(100)}1`;
    useWorkflowStore.getState().loadWorkflow(
      [canvasTool('in1', 'Input', { source: '/d.csv' }), canvasTool('f1', 'Formula', { operations: [{ column_name: 'x', expression: longExpr }] }, 'calc')],
      [{ from: { tool: 'in1', socket: 'output' }, to: { tool: 'f1', socket: 'input' } }],
      useWorkflowStore.getState().workflowMeta,
    );
    const result = await run(getToolConfig, { toolId: 'f1' });
    expect(result.data).toContain(JSON.stringify(longExpr).slice(1, -1));
    expect(result.data).toContain('Inputs: Input [in1].output -> input');
  });

  it('lists the tools when the id is wrong', async () => {
    const result = await run(getToolConfig, { toolId: 'nope' });
    expect(String(result.error)).toContain('Tool not found');
  });
});

describe('validate_workflow', () => {
  it('reports structural errors without running the Server', async () => {
    useWorkflowStore.getState().loadWorkflow([canvasTool('f1', 'Filter')], [], useWorkflowStore.getState().workflowMeta);
    const result = await run(validateWorkflowTool, {});
    expect(String(result.data)).toContain('Filter [f1]: The input is not connected.');
    expect(String(result.data)).toContain('Run: skipped');
    expect(previewAllTools).not.toHaveBeenCalled();
  });

  it('reports row counts and columns per output when the run succeeds', async () => {
    useWorkflowStore.getState().loadWorkflow([canvasTool('in1', 'Input', { category: 'file', type: 'csv', source: '/d.csv' })], [], useWorkflowStore.getState().workflowMeta);
    previewAllTools.mockResolvedValue({
      tools: { in1: { outputs: { output: { row_count: 891, data_schema: { columns: [{ name: 'Age', dtype: 'Float64', nullable: true }] } } } } },
    });
    const result = await run(validateWorkflowTool, {});
    expect(String(result.data)).toContain('Run: OK');
    expect(String(result.data)).toContain('Input [in1].output: 891 rows, Age:f64?');
  });

  it('reports a Server failure', async () => {
    useWorkflowStore.getState().loadWorkflow([canvasTool('in1', 'Input', { category: 'file', type: 'csv', source: '/d.csv' })], [], useWorkflowStore.getState().workflowMeta);
    previewAllTools.mockRejectedValue(new Error('File not found: /d.csv'));
    const result = await run(validateWorkflowTool, {});
    expect(String(result.data)).toContain('Run: FAILED - File not found: /d.csv');
  });
});

describe('ask_user cancellation', () => {
  it('rejects and clears the question when the turn is cancelled', async () => {
    const controller = new AbortController();
    const pending = run(askUser, { question: 'Which?' }, { abortSignal: controller.signal });
    expect(useAIStore.getState().pendingQuestion?.question).toBe('Which?');
    controller.abort();
    await expect(pending).rejects.toThrow('Question cancelled');
    expect(useAIStore.getState().pendingQuestion).toBeNull();
  });

  it('resolves with the answer', async () => {
    const pending = run(askUser, { question: 'Which?' });
    useAIStore.getState().pendingQuestion!.resolve('B');
    expect(await pending).toEqual({ answer: 'B' });
  });
});

describe('canvas state for large workflows', () => {
  it('drops configs and points at get_tool_config past the budget', () => {
    const tools = Array.from({ length: 120 }, (_, i) =>
      canvasTool(`t${i}`, 'Formula', { operations: [{ column_name: `c${i}`, expression: 'pl.col("a") * 2 + pl.col("b") * 3 + pl.col("c")' }] }, `step ${i}`));
    const text = formatCanvasState(tools, []);
    expect(text).toContain('configs omitted, use get_tool_config');
    expect(text).toContain('[t119] Formula // step 119');
    expect(text).not.toContain('operations=');
    expect(text.length).toBeLessThan(CANVAS_DETAIL_CHAR_BUDGET);
  });

  it('shows configs for small workflows, including mode for Sample', () => {
    const text = formatCanvasState([canvasTool('s1', 'Sample', { mode: 'LastN', n: 5 })], []);
    expect(text).toContain('mode="LastN"');
  });
});

describe('agent request options', () => {
  it('runs tool calls one at a time', async () => {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../agent.ts'), 'utf-8');
    expect(source).toMatch(/toolCallConcurrency:\s*1\b/);
  });
});
