/**
 * AI Provider Abstraction
 *
 * Wraps the Vercel AI SDK to provide a unified interface for multiple LLM providers.
 * Optional dependency - only imported when AI is enabled in settings.
 *
 * All calls are routed through the Sigilweaver Loom Server's reverse proxy
 * (/api/ai/proxy/) to avoid CORS restrictions. This applies to both
 * desktop and web mode since both run in a browser renderer context.
 */

import type { AIProvider } from '@state/aiStore';
import type { LanguageModel } from 'ai';
import { classifyError } from './errors';
import { useSettingsStore } from '@state/settingsStore';

/** Header that tells the Server proxy where an OpenAI-compatible server lives. */
export const UPSTREAM_BASE_URL_HEADER = 'x-loom-upstream-base-url';

/**
 * Build the proxy base URL for a given provider.
 * Routes through the Sigilweaver Loom Server at /api/ai/proxy/{provider}
 * so that browser-mode calls avoid CORS blocks.
 */
function getProxyBaseURL(provider: string): string {
  const serverUrl = useSettingsStore.getState().backend.url;
  return `${serverUrl}/api/ai/proxy/${provider}`;
}

/**
 * Normalize a user-supplied OpenAI-compatible base URL: strip trailing
 * slashes and a trailing /v1 (the SDK appends /v1 itself).
 */
export function normalizeCompatibleBaseUrl(userBaseUrl: string): string {
  return userBaseUrl.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
}

/**
 * Dynamically create a language model instance for the given provider config.
 *
 * All provider SDKs are loaded lazily so that users who never enable AI
 * never pay the import cost.
 *
 * All calls are routed through the server proxy to avoid CORS restrictions
 * (applies to both the desktop webview and web browser modes).
 */
export async function createLanguageModel(
  provider: AIProvider,
  model: string,
  apiKey: string,
  baseUrl?: string,
): Promise<LanguageModel> {

  switch (provider) {
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      const openai = createOpenAI({
        apiKey,
        baseURL: `${getProxyBaseURL('openai')}/v1`,
      });
      return openai(model);
    }
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      const anthropic = createAnthropic({
        apiKey,
        baseURL: `${getProxyBaseURL('anthropic')}/v1`,
      });
      return anthropic(model);
    }
    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL: `${getProxyBaseURL('google')}/v1beta`,
      });
      return google(model);
    }
    case 'mistral': {
      const { createMistral } = await import('@ai-sdk/mistral');
      const mistral = createMistral({
        apiKey,
        baseURL: `${getProxyBaseURL('mistral')}/v1`,
      });
      return mistral(model);
    }
    case 'openai-compatible': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      // The upstream goes in a header, not the URL: the SDK appends paths
      // such as /chat/completions to baseURL, which would otherwise land
      // inside a query string.
      const openaiCompatible = createOpenAI({
        apiKey: apiKey || 'ollama',
        baseURL: `${getProxyBaseURL('openai-compatible')}/v1`,
        headers: { [UPSTREAM_BASE_URL_HEADER]: normalizeCompatibleBaseUrl(baseUrl || 'http://localhost:11434') },
      });
      // Chat Completions, not the Responses API (the SDK default), which
      // most OpenAI-compatible servers do not implement.
      return openaiCompatible.chat(model);
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Test the connection to the configured provider by making a minimal API call.
 * Returns { success: true } or { success: false, error: string }.
 */
export async function testProviderConnection(
  provider: AIProvider,
  model: string,
  apiKey: string,
  baseUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { generateText } = await import('ai');
    const languageModel = await createLanguageModel(provider, model, apiKey, baseUrl);

    await generateText({
      model: languageModel,
      prompt: 'Reply with OK',
      maxOutputTokens: 5,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: classifyError(err).displayMessage };
  }
}

/**
 * Fetch available models from a provider via the server proxy.
 *
 * On failure the static suggestions are returned together with the reason,
 * so the settings panel can say the live list could not be loaded instead of
 * silently showing a possibly stale list.
 */
export async function fetchProviderModels(
  provider: AIProvider,
  apiKey: string,
  baseUrl?: string,
): Promise<{ models: Array<{ id: string; name?: string }>; error?: string }> {
  const serverUrl = useSettingsStore.getState().backend.url;
  const fallback = (PROVIDER_MODELS[provider] ?? []).map((id) => ({ id }));

  try {
    const resp = await fetch(`${serverUrl}/api/ai/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        api_key: apiKey || null,
        base_url: baseUrl ? normalizeCompatibleBaseUrl(baseUrl) : null,
      }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => null);
      const detail = typeof errorData?.detail === 'string' ? errorData.detail : `HTTP ${resp.status}`;
      throw Object.assign(new Error(detail), { statusCode: resp.status });
    }

    const data = await resp.json();
    return { models: data.models ?? [] };
  } catch (err) {
    return { models: fallback, error: classifyError(err).displayMessage };
  }
}

/**
 * Suggested models per provider for the UI (static fallback, used when the
 * live model listing fails). The first entry of each list is the default.
 */
export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-luna'],
  anthropic: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
  google: ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash-lite'],
  mistral: ['mistral-large-latest', 'mistral-small-latest'],
  'openai-compatible': [], // User specifies manually
};

/**
 * Provider display names for the UI.
 */
export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
  'openai-compatible': 'OpenAI-Compatible (Ollama, vLLM, etc.)',
};
