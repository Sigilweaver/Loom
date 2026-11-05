/**
 * Agent loop helpers: tool-result guarding and per-step prompt caching.
 */

import type { ModelMessage, Tool } from 'ai';

/**
 * Longest tool result (as JSON) sent back to the model. A preview of a wide
 * table or a big schema can otherwise fill the context window in one call.
 */
export const MAX_TOOL_RESULT_CHARS = 12_000;

/** Cut text at a line boundary and say what was dropped. */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf('\n', maxChars);
  const kept = text.slice(0, cut > maxChars / 2 ? cut : maxChars);
  return `${kept}\n... [truncated: showed ${kept.length} of ${text.length} characters. Ask for fewer rows or columns to see the rest.]`;
}

/**
 * Bound a tool result's size. Compact-text results (`{ data: string }`) keep
 * their other fields and lose the tail of `data`; anything else is replaced
 * by a truncated JSON rendering.
 */
export function capToolResult(result: unknown, maxChars = MAX_TOOL_RESULT_CHARS): unknown {
  if (result == null || typeof result !== 'object') return result;
  const json = JSON.stringify(result);
  if (json.length <= maxChars) return result;

  const r = result as Record<string, unknown>;
  if (typeof r.data === 'string') {
    const { data, ...rest } = r;
    const restLen = JSON.stringify(rest).length;
    if (restLen < maxChars / 2) {
      // Budget in raw characters, scaled for JSON escaping (newlines, quotes).
      const text = data as string;
      const escapeRatio = text.length / JSON.stringify(text).length;
      return { ...rest, data: truncateText(text, Math.floor((maxChars - restLen - 200) * escapeRatio)) };
    }
  }
  return { data: truncateText(json, maxChars), truncated: true };
}

type AnyExecute = (input: unknown, options: { abortSignal?: AbortSignal }) => unknown;

/**
 * Wrap every tool so that (1) results are size-capped and (2) a tool that
 * throws returns `{ error }` the model can read and recover from, instead of
 * an opaque failure. Aborts still propagate so cancellation stops the loop.
 */
export function guardTools<T extends Record<string, Tool>>(tools: T): T {
  const guarded: Record<string, Tool> = {};
  for (const [name, t] of Object.entries(tools)) {
    const execute = t.execute as AnyExecute | undefined;
    if (!execute) {
      guarded[name] = t;
      continue;
    }
    guarded[name] = {
      ...t,
      execute: (async (input: unknown, options: { abortSignal?: AbortSignal }) => {
        try {
          return capToolResult(await execute(input, options));
        } catch (err) {
          if (options?.abortSignal?.aborted || (err as Error)?.name === 'AbortError') throw err;
          return { error: `${name} failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }) as unknown as Tool['execute'],
    } as Tool;
  }
  return guarded as T;
}

type AnthropicOptions = Record<string, unknown> & { cacheControl?: unknown };

/**
 * `prepareStep` hook for Anthropic: keep exactly one message-level cache
 * breakpoint, on the newest message. Prepared messages carry forward between
 * steps, so earlier breakpoints are removed to stay within the provider's
 * limit (the stable system prompt keeps its own breakpoint).
 */
export function withAnthropicStepCache({ messages }: { messages: ModelMessage[] }): { messages: ModelMessage[] } {
  const last = messages.length - 1;
  return {
    messages: messages.map((m, i) => {
      if (m.role === 'system') return m;
      const { cacheControl: _drop, ...anthropic } = (m.providerOptions?.anthropic ?? {}) as AnthropicOptions;
      const nextAnthropic = i === last ? { ...anthropic, cacheControl: { type: 'ephemeral' } } : anthropic;
      return { ...m, providerOptions: { ...m.providerOptions, anthropic: nextAnthropic } } as ModelMessage;
    }),
  };
}
