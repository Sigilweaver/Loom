import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MockLanguageModelV4 } from 'ai/test';
import { createLanguageModel, fetchProviderModels, normalizeCompatibleBaseUrl, PROVIDER_MODELS, UPSTREAM_BASE_URL_HEADER } from '../providers';
import { generateStructured, parseStructuredText, stripCodeFence } from '../structured';
import { useSettingsStore } from '@state/settingsStore';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAI-compatible requests', () => {
  it('normalizes the base URL', () => {
    expect(normalizeCompatibleBaseUrl(' http://h:11434/v1/ ')).toBe('http://h:11434');
    expect(normalizeCompatibleBaseUrl('http://h:11434')).toBe('http://h:11434');
  });

  it('sends the upstream in a header and keeps the proxy path clean', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'm',
      choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const server = useSettingsStore.getState().backend.url;

    const model = await createLanguageModel('openai-compatible', 'llama', '', 'http://my-llm:8000/v1');
    const { generateText } = await import('ai');
    await generateText({ model, prompt: 'hi' }).catch(() => undefined);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${server}/api/ai/proxy/openai-compatible/v1/chat/completions`);
    expect(new Headers(init.headers).get(UPSTREAM_BASE_URL_HEADER)).toBe('http://my-llm:8000');
  });
});

describe('fetchProviderModels', () => {
  it('returns the live list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ models: [{ id: 'a' }] }), { status: 200 })));
    expect(await fetchProviderModels('openai', 'k')).toEqual({ models: [{ id: 'a' }] });
  });

  it('falls back to suggestions and says why', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Provider returned 401: bad key' }), { status: 401 })));
    const result = await fetchProviderModels('anthropic', 'bad');
    expect(result.models.map((m) => m.id)).toEqual(PROVIDER_MODELS.anthropic);
    expect(result.error).toContain('Authentication failed');
  });
});

describe('structured output', () => {
  const schema = z.object({ combinator: z.string(), conditions: z.array(z.object({ column: z.string() })) });

  it('parses fenced JSON and validates it', () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(parseStructuredText('```json\n{"combinator":"and","conditions":[{"column":"x"}]}\n```', schema, 'filter').value)
      .toEqual({ combinator: 'and', conditions: [{ column: 'x' }] });
  });

  it('explains invalid JSON and schema mismatches', () => {
    expect(parseStructuredText('not json', schema, 'filter').error).toContain('did not return valid JSON for the filter');
    expect(parseStructuredText('{"combinator":1}', schema, 'filter').error).toContain('Invalid filter from AI');
  });

  it('asks cloud providers for a JSON schema response', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text', text: '{"combinator":"or","conditions":[]}' }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
        warnings: [],
      }) as never,
    });
    const result = await generateStructured({ model, provider: 'openai', prompt: 'p', schema, what: 'filter', maxOutputTokens: 10 });
    expect(result.value).toEqual({ combinator: 'or', conditions: [] });
    const call = model.doGenerateCalls[0]!;
    expect(call.responseFormat?.type).toBe('json');
    expect(call.providerOptions?.openai).toEqual({ strictJsonSchema: false });
  });
});
