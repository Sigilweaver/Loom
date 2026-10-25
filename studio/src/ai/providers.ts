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
import { useSettingsStore } from '@state/settingsStore';

/**
 * Build the proxy base URL for a given provider.
 * Routes through the Sigilweaver Loom Server at /api/ai/proxy/{provider}
 * so that browser-mode calls avoid CORS blocks.
 */
function getProxyBaseURL(provider: string, userBaseUrl?: string): string {
  const serverUrl = useSettingsStore.getState().backend.url;
  if (provider === 'openai-compatible' && userBaseUrl) {
    // Strip trailing slashes and any trailing /v1 from user-supplied URL
    // (the SDK appends /v1 itself, so duplicates would break the path)
    const normalizedUrl = userBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
    return `${serverUrl}/api/ai/proxy/${provider}?base_url=${encodeURIComponent(normalizedUrl)}`;
  }
  return `${serverUrl}/api/ai/proxy/${provider}`;
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
      const openaiCompatible = createOpenAI({
        apiKey: apiKey || 'ollama',
        baseURL: `${getProxyBaseURL('openai-compatible', baseUrl || 'http://localhost:11434')}/v1`,
      });
      return openaiCompatible(model);
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
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Fetch available models from a provider via the server proxy.
 * Returns model IDs or falls back to the static list on error.
 */
export async function fetchProviderModels(
  provider: AIProvider,
  apiKey: string,
  baseUrl?: string,
): Promise<Array<{ id: string; name?: string }>> {
  const serverUrl = useSettingsStore.getState().backend.url;

  try {
    const resp = await fetch(`${serverUrl}/api/ai/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        api_key: apiKey || null,
        base_url: baseUrl || null,
      }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => null);
      throw new Error(errorData?.detail ?? `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    return data.models ?? [];
  } catch {
    // Fall back to static list
    return (PROVIDER_MODELS[provider] ?? []).map((id) => ({ id }));
  }
}

/**
 * Suggested models per provider for the UI (static fallback).
 */
export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
  google: ['gemini-2.0-flash', 'gemini-2.5-pro'],
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
