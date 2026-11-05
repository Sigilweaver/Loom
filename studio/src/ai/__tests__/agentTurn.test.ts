/**
 * One real agent turn through sendAgentMessage with a mock model.
 *
 * Guards the request shape the AI SDK accepts (system prompt in
 * `instructions`, not in `messages`) and that the stable part carries the
 * Anthropic cache breakpoint.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';

const current: { model: unknown } = { model: null };
vi.mock('../providers', async (orig) => ({
  ...(await orig<typeof import('../providers')>()),
  createLanguageModel: async () => current.model,
}));

import { sendAgentMessage } from '../agent';
import { useAIStore } from '@state/aiStore';
import { useWorkflowStore } from '@state/workflowStore';

function textModel(text: string) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          for (const chunk of [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: text },
            { type: 'text-end', id: 't' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: undefined },
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 2, text: 2, reasoning: 0 },
              },
            },
          ]) controller.enqueue(chunk);
          controller.close();
        },
      }),
    }) as never,
  });
}

beforeEach(() => {
  useWorkflowStore.getState().newWorkflow();
  useAIStore.getState().clearChat();
  useAIStore.setState({ enabled: true, provider: 'anthropic', apiKey: 'k', model: 'm', useAudit: false, error: null, isGenerating: false });
});

describe('agent turn', () => {
  it('completes a turn and sends the system prompt as instructions', async () => {
    const model = textModel('Hello.');
    current.model = model;

    await sendAgentMessage('hi');

    const messages = useAIStore.getState().messages;
    expect(useAIStore.getState().error).toBeNull();
    expect(messages[messages.length - 1]!.content).toBe('Hello.');

    const prompt = model.doStreamCalls[0]!.prompt as Array<{ role: string; providerOptions?: { anthropic?: { cacheControl?: unknown } } }>;
    expect(prompt[0]!.role).toBe('system');
    expect(prompt[0]!.providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' });
    expect(prompt[1]!.role).toBe('system');
    expect(prompt[1]!.providerOptions?.anthropic?.cacheControl).toBeUndefined();
    expect(prompt[prompt.length - 1]!.role).toBe('user');
  });
});
