/**
 * Offline agent evals: scripted model responses through the real agent loop.
 *
 * Each scenario checks an end-to-end behaviour that a unit test of one tool
 * would miss: what the model is shown, how the loop reacts to tool results,
 * and what the user ends up with (canvas, chat, history).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APICallError } from 'ai';
import { fakeServer, scriptedModel, PASSENGERS_PATH, type ScriptEntry } from '../../evals/harness';

const current: { model: unknown } = { model: null };

vi.mock('../../providers', async (orig) => ({
  ...(await orig<typeof import('../../providers')>()),
  createLanguageModel: async () => current.model,
}));

vi.mock('@api', async (orig) => ({
  ...(await orig<typeof import('@api')>()),
  previewTool: (...a: Parameters<typeof fakeServer.previewTool>) => fakeServer.previewTool(...a),
  previewAllTools: (w: never) => fakeServer.previewAllTools(w),
  profileColumns: (...a: Parameters<typeof fakeServer.profileColumns>) => fakeServer.profileColumns(...a),
  getToolSchema: () => fakeServer.getToolSchema(),
}));

vi.mock('@api/backend', async (orig) => ({
  ...(await orig<typeof import('@api/backend')>()),
  searchFiles: (...a: Parameters<typeof fakeServer.searchFiles>) => fakeServer.searchFiles(...a),
  getSessionToken: () => 'test-token',
}));

import { sendAgentMessage } from '../../agent';
import { useAIStore } from '@state/aiStore';
import { useWorkflowStore } from '@state/workflowStore';
import { useHistoryStore } from '@state/historyStore';
import { clearTurnUndoRecords, undoTurn } from '../../turnChanges';

function withScript(script: ScriptEntry[], provider: 'openai' | 'anthropic' = 'openai') {
  const scripted = scriptedModel(script);
  current.model = scripted.model;
  useAIStore.setState({ provider });
  return scripted;
}

function lastAssistant() {
  return [...useAIStore.getState().messages].reverse().find((m) => m.role === 'assistant')!;
}

/** Find the canvas id of the only tool of a type. */
function idOf(type: string): string {
  const t = useWorkflowStore.getState().tools.find((x) => x.type === type);
  if (!t) throw new Error(`no ${type} on canvas`);
  return t.id;
}

beforeEach(() => {
  useWorkflowStore.getState().newWorkflow();
  useHistoryStore.getState().clear();
  clearTurnUndoRecords();
  useAIStore.getState().clearChat();
  useAIStore.setState({
    enabled: true,
    apiKey: 'test-key',
    model: 'test-model',
    maxIterations: 25,
    useAudit: false,
    shareSampleData: false,
    confirmDestructiveEdits: true,
    isGenerating: false,
    pendingApproval: null,
    pendingQuestion: null,
    error: null,
  });
});

describe('agent evals', () => {
  it('builds a workflow from an empty canvas, validates it, and reports the changes', async () => {
    const { prompts } = withScript([
      { toolCalls: [{ name: 'search_files', input: { query: 'passengers' } }] },
      (ctx) => {
        expect(ctx.lastToolResults.search_files).toContain(PASSENGERS_PATH);
        return {
          toolCalls: [{
            name: 'build_workflow',
            input: { steps: [{ id: 'load', type: 'Input', config: { category: 'file', type: 'csv', source: PASSENGERS_PATH }, comment: 'Load passengers' }], connections: [] },
          }],
        };
      },
      (ctx) => {
        // The profile came back with column names and types
        expect(ctx.lastToolResults.build_workflow).toContain('age:f64');
        return {
          text: 'Adding the filter.',
          toolCalls: [{ name: 'add_tool', input: { type: 'Filter', after: idOf('Input'), comment: 'Adults only', config: { conditions: [{ column: 'age', operator: 'gte', value: '18' }], combinator: 'and' } } }],
        };
      },
      { toolCalls: [{ name: 'validate_workflow', input: {} }] },
      (ctx) => {
        expect(ctx.lastToolResults.validate_workflow).toContain('Run: OK');
        return { text: 'Done: the workflow loads passengers and keeps adults.' };
      },
    ]);

    await sendAgentMessage('Load the passengers file and keep adults');

    const { tools, wires } = useWorkflowStore.getState();
    expect(tools.map((t) => t.type)).toEqual(['Input', 'Filter']);
    expect(wires).toHaveLength(1);
    expect(tools[1]!.config.expression).toBe('pl.col("age") >= 18');
    expect(tools.every((t) => t.comment)).toBe(true);

    const reply = lastAssistant();
    expect(reply.content).toContain('Done: the workflow loads passengers');
    expect(reply.changes?.added).toHaveLength(2);
    // One undo step for the whole turn
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(prompts).toHaveLength(5);
  });

  it('recovers from a tool error the model can read', async () => {
    withScript([
      { toolCalls: [{ name: 'add_tool', input: { type: 'Read', comment: 'load', config: { category: 'file', type: 'csv', source: PASSENGERS_PATH } } }] },
      // Wrong upstream id: nothing is added, the model is told why
      { toolCalls: [{ name: 'add_tool', input: { type: 'Aggregate', after: 'not-an-id', comment: 'count' } }] },
      (ctx) => {
        expect(ctx.lastToolResults.add_tool).toContain('nothing was added');
        return { toolCalls: [{ name: 'add_tool', input: { type: 'Aggregate', after: idOf('Input'), comment: 'count by sex', config: { groupByColumns: ['sex'], aggregations: [{ column: 'name', operation: 'Count', outputName: 'n' }] } } }] };
      },
      { text: 'Added the count.' },
    ]);

    await sendAgentMessage('Count passengers by sex');

    const { tools, wires } = useWorkflowStore.getState();
    expect(tools.map((t) => t.type)).toEqual(['Input', 'Summarize']);
    expect(wires).toHaveLength(1);
  });

  it('withholds sample values from the model unless the user opted in', async () => {
    const run = async () => {
      const scripted = withScript([
        { toolCalls: [{ name: 'add_tool', input: { type: 'Input', comment: 'load', config: { category: 'file', type: 'csv', source: PASSENGERS_PATH } } }] },
        () => ({ toolCalls: [{ name: 'preview_tool_output', input: { toolId: idOf('Input') } }] }),
        () => ({ toolCalls: [{ name: 'profile_tool_data', input: { toolId: idOf('Input') } }] }),
        { text: 'ok' },
      ]);
      await sendAgentMessage('Look at the data');
      return JSON.stringify(scripted.prompts[scripted.prompts.length - 1]);
    };

    const withheld = await run();
    expect(withheld).toContain('Sample values withheld');
    expect(withheld).not.toContain('Braund');
    expect(withheld).not.toContain('female');
    expect(withheld).toContain('has not enabled sample data sharing');

    useWorkflowStore.getState().newWorkflow();
    useAIStore.setState({ shareSampleData: true });
    const shared = await run();
    expect(shared).toContain('Braund');
    expect(shared).toContain('female');
  });

  it('asks before removing a tool and respects a decline', async () => {
    useWorkflowStore.getState().loadWorkflow(
      [{ id: 'in1', type: 'Input', x: 0, y: 0, config: { source: PASSENGERS_PATH }, sockets: [{ id: 'output', direction: 'output' }], comment: 'load' }],
      [],
      useWorkflowStore.getState().workflowMeta,
    );
    withScript([
      { toolCalls: [{ name: 'remove_tool', input: { toolId: 'in1' } }] },
      (ctx) => {
        expect(ctx.lastToolResults.remove_tool).toContain('The user declined');
        return { text: 'Understood, I left it in place.' };
      },
    ]);

    const turn = sendAgentMessage('Start over');
    await vi.waitFor(() => expect(useAIStore.getState().pendingApproval).not.toBeNull());
    useAIStore.getState().pendingApproval!.resolve(false);
    await turn;

    expect(useWorkflowStore.getState().tools).toHaveLength(1);
    expect(lastAssistant().changes).toBeUndefined();
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it('handles two approvals requested in one step, one at a time', async () => {
    const meta = useWorkflowStore.getState().workflowMeta;
    useWorkflowStore.getState().loadWorkflow(
      ['a', 'b'].map((id) => ({ id, type: 'Input', x: 0, y: 0, config: { source: PASSENGERS_PATH }, sockets: [{ id: 'output', direction: 'output' as const }], comment: id })),
      [],
      meta,
    );
    withScript([
      { toolCalls: [{ name: 'remove_tool', input: { toolId: 'a' } }, { name: 'remove_tool', input: { toolId: 'b' } }] },
      { text: 'Removed what you approved.' },
    ]);

    const turn = sendAgentMessage('Remove both inputs');
    await vi.waitFor(() => expect(useAIStore.getState().pendingApproval?.title).toContain('[a]'));
    useAIStore.getState().pendingApproval!.resolve(true);
    await vi.waitFor(() => expect(useAIStore.getState().pendingApproval?.title).toContain('[b]'));
    useAIStore.getState().pendingApproval!.resolve(false);
    await turn;

    expect(useWorkflowStore.getState().tools.map((t) => t.id)).toEqual(['b']);
    expect(lastAssistant().changes?.removed).toHaveLength(1);
  });

  it('reports a provider error that happens after the first step', async () => {
    withScript([
      { toolCalls: [{ name: 'search_files', input: { query: 'passengers' } }] },
      { error: new APICallError({ message: 'rate limited', url: 'u', requestBodyValues: {}, statusCode: 429, isRetryable: false }) },
    ]);

    await sendAgentMessage('Find files');

    expect(lastAssistant().content).toContain('Rate limited by provider');
    expect(useAIStore.getState().error).toContain('Rate limited');
  });

  it('ends the turn cleanly when the user cancels during a question', async () => {
    withScript([
      { toolCalls: [{ name: 'add_tool', input: { type: 'Input', comment: 'load', config: { category: 'file', type: 'csv', source: PASSENGERS_PATH } } }] },
      { toolCalls: [{ name: 'ask_user', input: { question: 'Which columns?' } }] },
      { text: 'never reached' },
    ]);

    const turn = sendAgentMessage('Build something');
    await vi.waitFor(() => expect(useAIStore.getState().pendingQuestion).not.toBeNull());
    useAIStore.getState().cancelGeneration();
    await turn;

    expect(useAIStore.getState().isGenerating).toBe(false);
    expect(useAIStore.getState().pendingQuestion).toBeNull();
    // The tool added before cancelling is reported and undoable
    const msg = lastAssistant();
    expect(msg.content).toContain('Stopped before finishing');
    expect(msg.changes?.added).toHaveLength(1);
    expect(undoTurn(msg.id)).toBe(true);
    expect(useWorkflowStore.getState().tools).toHaveLength(0);
  });

  it('stops at the step limit and offers to continue', async () => {
    useAIStore.setState({ maxIterations: 2 });
    withScript([
      { toolCalls: [{ name: 'list_available_files', input: {} }] },
      { toolCalls: [{ name: 'search_files', input: { query: 'passengers' } }] },
      { text: 'never reached' },
    ]);

    await sendAgentMessage('Find my data');
    expect(useAIStore.getState().stoppedAtLimit).toBe(true);
  });

  it('on Anthropic, caches the stable prompt and moves one breakpoint to the newest message', async () => {
    const { prompts } = withScript([
      { toolCalls: [{ name: 'search_files', input: { query: 'passengers' } }] },
      { toolCalls: [{ name: 'search_files', input: { query: 'other' } }] },
      { text: 'done' },
    ], 'anthropic');

    await sendAgentMessage('Find files');

    for (const prompt of prompts) {
      const marked = prompt.map((m) => Boolean((m.providerOptions?.anthropic as { cacheControl?: unknown } | undefined)?.cacheControl));
      // stable system prompt + the newest message
      expect(marked[0]).toBe(true);
      expect(marked.filter(Boolean)).toHaveLength(2);
      expect(marked[marked.length - 1]).toBe(true);
    }
  });

  it('turns a provider 401 into an actionable message', async () => {
    withScript([{ error: new APICallError({ message: 'invalid x-api-key', url: 'u', requestBodyValues: {}, statusCode: 401, isRetryable: false }) }]);

    await sendAgentMessage('hi');

    expect(lastAssistant().content).toContain('Authentication failed - check your API key');
    expect(useAIStore.getState().isGenerating).toBe(false);
  });
});
