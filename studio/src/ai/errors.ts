/**
 * AI error classification.
 *
 * Turns provider/network failures into short, actionable messages. Prefers the
 * structured HTTP status carried by AI SDK API errors (`statusCode`) and only
 * falls back to scanning the message text when no status is available.
 */

export type AIErrorCategory =
  | 'auth'
  | 'rate-limit'
  | 'overloaded'
  | 'network'
  | 'model-not-found'
  | 'context-length'
  | 'unknown';

export interface ClassifiedError {
  category: AIErrorCategory;
  displayMessage: string;
  retryable: boolean;
}

/** Pull an HTTP status off an AI SDK APICallError (or anything shaped like one). */
function statusOf(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const e = err as { statusCode?: unknown; status?: unknown; cause?: unknown };
    if (typeof e.statusCode === 'number') return e.statusCode;
    if (typeof e.status === 'number') return e.status;
    if (e.cause) return statusOf(e.cause);
  }
  return undefined;
}

function byStatus(status: number, message: string): ClassifiedError | null {
  const lower = message.toLowerCase();
  if (status === 401 || status === 403) {
    return {
      category: 'auth',
      displayMessage: 'Authentication failed - check your API key in Settings -> AI.',
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      category: 'model-not-found',
      displayMessage: `Model or endpoint not found (${message}). Pick a model from the list in Settings -> AI.`,
      retryable: false,
    };
  }
  if (status === 413 || (status === 400 && /context|too long|too many tokens|maximum.*tokens/.test(lower))) {
    return {
      category: 'context-length',
      displayMessage: 'The conversation or workflow is too large for this model. Start a new chat or pick a model with a larger context window.',
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      category: 'rate-limit',
      displayMessage: 'Rate limited by provider - wait a moment and try again.',
      retryable: true,
    };
  }
  if (status === 529 || status === 503) {
    return {
      category: 'overloaded',
      displayMessage: 'Provider temporarily overloaded - try again in a few seconds.',
      retryable: true,
    };
  }
  if (status === 502 || status === 504) {
    return {
      category: 'network',
      displayMessage: `Connection error: ${message}. Is the Sigilweaver Loom Server running?`,
      retryable: true,
    };
  }
  return null;
}

/**
 * Classify an error (or error message) into a user-facing category.
 * Helps users understand whether to fix config, wait, or retry.
 */
export function classifyError(input: unknown): ClassifiedError {
  const message = input instanceof Error ? input.message : String(input);

  const status = statusOf(input);
  if (status !== undefined) {
    const hit = byStatus(status, message);
    if (hit) return hit;
    // A real status we do not map: do not guess from digits in the text.
    return { category: 'unknown', displayMessage: message, retryable: status >= 500 };
  }

  const lower = message.toLowerCase();

  if (lower.includes('401') || lower.includes('403') || lower.includes('invalid api key')
    || lower.includes('unauthorized') || lower.includes('authentication')
    || lower.includes('permission denied')) {
    return byStatus(401, message)!;
  }
  if (lower.includes('model_not_found') || /model .*(not found|does not exist)/.test(lower)) {
    return byStatus(404, message)!;
  }
  if (lower.includes('context_length') || lower.includes('context length') || lower.includes('prompt is too long')) {
    return byStatus(413, message)!;
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')
    || lower.includes('quota exceeded')) {
    return byStatus(429, message)!;
  }
  if (lower.includes('503') || lower.includes('overloaded') || lower.includes('capacity')
    || lower.includes('temporarily unavailable')) {
    return byStatus(503, message)!;
  }
  if (lower.includes('502') || lower.includes('504') || lower.includes('could not connect')
    || lower.includes('econnrefused') || lower.includes('enotfound')
    || lower.includes('network') || lower.includes('timeout')
    || lower.includes('fetch failed') || lower.includes('econnreset')) {
    return byStatus(502, message)!;
  }

  return { category: 'unknown', displayMessage: message, retryable: false };
}
