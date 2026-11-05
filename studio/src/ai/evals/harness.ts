/**
 * Offline eval harness for the workflow agent.
 *
 * A scripted model (the AI SDK's MockLanguageModelV4) replays tool calls and
 * text step by step. Each step may be a function of what the model was sent,
 * so a script can react to tool results exactly as a real model would, and
 * tests can assert on what reached the model (for example that sample values
 * were withheld). The real agent loop, tools, stores and compiler run; only
 * the model and the Server are faked.
 */

import { MockLanguageModelV4 } from 'ai/test';
import type { ColumnSchema } from '@api/backend';

export interface ScriptedToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface ScriptedStep {
  text?: string;
  toolCalls?: ScriptedToolCall[];
  /** Throw instead of answering (e.g. a provider error). */
  error?: Error;
}

export interface StepContext {
  /** 0-based model call index within the test. */
  call: number;
  /** The prompt the agent sent for this step (system, history, tool results). */
  prompt: unknown;
  /** JSON of `prompt`, for substring assertions. */
  promptText: string;
  /** Latest tool results in this prompt, by tool name (JSON-stringified). */
  lastToolResults: Record<string, string>;
}

export type ScriptEntry = ScriptedStep | ((ctx: StepContext) => ScriptedStep);

interface PromptMessage {
  role: string;
  content: unknown;
  providerOptions?: Record<string, unknown>;
}

function latestToolResults(prompt: PromptMessage[]): Record<string, string> {
  const out: Record<string, string> = {};
  const last = [...prompt].reverse().find((m) => m.role === 'tool');
  if (!last || !Array.isArray(last.content)) return out;
  for (const part of last.content as Array<{ type: string; toolName?: string; output?: unknown }>) {
    if (part.type === 'tool-result' && part.toolName) out[part.toolName] = JSON.stringify(part.output);
  }
  return out;
}

export interface ScriptedModel {
  model: MockLanguageModelV4;
  /** Every prompt the agent sent, in order. */
  prompts: PromptMessage[][];
}

/** Build a model that answers each step from `script`, in order. */
export function scriptedModel(script: ScriptEntry[]): ScriptedModel {
  const prompts: PromptMessage[][] = [];
  let call = 0;
  const model = new MockLanguageModelV4({
    doStream: async (options) => {
      const prompt = options.prompt as unknown as PromptMessage[];
      prompts.push(prompt);
      const entry = script[call];
      const ctx: StepContext = {
        call,
        prompt,
        promptText: JSON.stringify(prompt),
        lastToolResults: latestToolResults(prompt),
      };
      call++;
      const step: ScriptedStep = typeof entry === 'function'
        ? entry(ctx)
        : entry ?? { text: '(script ended)' };
      if (step.error) throw step.error;

      const chunks: unknown[] = [{ type: 'stream-start', warnings: [] }];
      if (step.text) {
        chunks.push({ type: 'text-start', id: `t${call}` });
        chunks.push({ type: 'text-delta', id: `t${call}`, delta: step.text });
        chunks.push({ type: 'text-end', id: `t${call}` });
      }
      (step.toolCalls ?? []).forEach((tc, i) => {
        chunks.push({ type: 'tool-call', toolCallId: `call-${call}-${i}`, toolName: tc.name, input: JSON.stringify(tc.input) });
      });
      const hasTools = (step.toolCalls ?? []).length > 0;
      chunks.push({
        type: 'finish',
        finishReason: { unified: hasTools ? 'tool-calls' : 'stop', raw: undefined },
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 },
        },
      });
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const c of chunks) controller.enqueue(c);
            controller.close();
          },
        }),
      } as never;
    },
  });
  return { model, prompts };
}

// ---------------------------------------------------------------------------
// Fake Server
// ---------------------------------------------------------------------------

export const PASSENGERS_PATH = '/data/passengers.csv';

export const PASSENGER_SCHEMA: ColumnSchema[] = [
  { name: 'name', dtype: 'String', nullable: false },
  { name: 'age', dtype: 'Float64', nullable: true },
  { name: 'sex', dtype: 'String', nullable: false },
  { name: 'survived', dtype: 'Int64', nullable: false },
];

export const PASSENGER_ROWS = [
  { name: 'Allen, Miss. Elisabeth', age: 29, sex: 'female', survived: 1 },
  { name: 'Braund, Mr. Owen', age: 22, sex: 'male', survived: 0 },
  { name: 'Cumings, Mrs. John', age: 38, sex: 'female', survived: 1 },
];

/** Total rows the fake Server reports for the passengers file. */
export const PASSENGER_ROW_COUNT = 891;

interface WorkflowLike {
  tools: Array<{ id: string; type: string; config: Record<string, unknown>; sockets: Array<{ id: string; direction: string }> }>;
}

function sourceIsKnown(workflow: WorkflowLike): void {
  for (const t of workflow.tools) {
    if (t.type === 'Input' && t.config.source && t.config.source !== PASSENGERS_PATH) {
      throw new Error(`File not found: ${String(t.config.source)}`);
    }
  }
}

export const fakeServer = {
  previewTool: async (_toolId: string, workflow: WorkflowLike, _socket: string, limit = 10) => {
    sourceIsKnown(workflow);
    return {
      data: PASSENGER_ROWS.slice(0, limit),
      data_schema: { columns: PASSENGER_SCHEMA },
      row_count: PASSENGER_ROW_COUNT,
    };
  },
  previewAllTools: async (workflow: WorkflowLike) => {
    sourceIsKnown(workflow);
    const tools: Record<string, { outputs: Record<string, unknown> }> = {};
    for (const t of workflow.tools) {
      if (t.type === 'Output') continue;
      const outputs: Record<string, unknown> = {};
      for (const s of t.sockets.filter((x) => x.direction === 'output')) {
        outputs[s.id] = { row_count: PASSENGER_ROW_COUNT, data_schema: { columns: PASSENGER_SCHEMA }, data: [] };
      }
      tools[t.id] = { outputs };
    }
    return { tools };
  },
  profileColumns: async (_toolId: string, workflow: WorkflowLike) => {
    sourceIsKnown(workflow);
    return {
      row_count: PASSENGER_ROW_COUNT,
      column_count: PASSENGER_SCHEMA.length,
      columns: {
        name: { dtype: 'String', count: 891, null_count: 0, unique_count: 891, top_values: [{ value: 'Allen, Miss. Elisabeth', count: 1 }] },
        age: { dtype: 'Float64', count: 714, null_count: 177, null_percent: 19.87, unique_count: 88, min: 0.42, max: 80, mean: 29.7 },
        sex: { dtype: 'String', count: 891, null_count: 0, unique_count: 2, top_values: [{ value: 'male', count: 577 }, { value: 'female', count: 314 }] },
        survived: { dtype: 'Int64', count: 891, null_count: 0, unique_count: 2, min: 0, max: 1, mean: 0.38 },
      },
    };
  },
  getToolSchema: async () => ({ data_schema: { columns: PASSENGER_SCHEMA } }),
  searchFiles: async (_url: string, _token: string, query: string) => ({
    results: query.toLowerCase().includes('passeng')
      ? [{ name: 'passengers.csv', path: PASSENGERS_PATH, extension: 'csv', size: 61194, score: 1 }]
      : [],
  }),
};
