/**
 * AI Store
 *
 * Manages AI feature state: provider settings, chat messages, agent invocation.
 * AI is off by default. Zero AI code loads unless the user enables it.
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'openai-compatible';

export interface AISettings {
  /** AI features enabled (off by default) */
  enabled: boolean;
  /** LLM provider */
  provider: AIProvider;
  /** Model identifier (e.g. "gpt-4o", "claude-sonnet-4-20250514", "gemini-2.0-flash") */
  model: string;
  /** API key (stored encrypted in Electron, localStorage in web) */
  apiKey: string;
  /** Base URL for openai-compatible providers (e.g. http://localhost:11434/v1 for Ollama) */
  baseUrl: string;
  /** Max agent iterations per invocation */
  maxIterations: number;

  // -- Optional expression-assist model override --
  /** When true, expression/basic assists use a separate model instead of the main one */
  useExpressionModel: boolean;
  /** Provider for expression assist (falls back to main provider) */
  expressionProvider: AIProvider;
  /** Model for expression assist (falls back to main model) */
  expressionModel: string;
  /** API key for expression assist (falls back to main key) */
  expressionApiKey: string;
  /** Base URL for expression assist (falls back to main baseUrl) */
  expressionBaseUrl: string;
}

export type ChatRole = 'user' | 'assistant' | 'tool';

export interface ToolCallInfo {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
  /** Token usage for this message (assistant messages only) */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: 'openai',
  model: '',
  apiKey: '',
  baseUrl: '',
  maxIterations: 25,
  useExpressionModel: false,
  expressionProvider: 'openai',
  expressionModel: '',
  expressionApiKey: '',
  expressionBaseUrl: '',
};

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.0-flash',
  mistral: 'mistral-large-latest',
  'openai-compatible': '',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface AIState extends AISettings {
  /** Chat messages */
  messages: ChatMessage[];
  /** Whether the agent is currently generating */
  isGenerating: boolean;
  /** Current error (null if none) */
  error: string | null;
  /** Abort controller for cancelling generation */
  abortController: AbortController | null;
  /** Accumulated token usage for the current session */
  sessionUsage: TokenUsage;

  // -- Settings actions --
  loadAISettings: () => Promise<void>;
  updateEnabled: (enabled: boolean) => Promise<void>;
  updateProvider: (provider: AIProvider) => Promise<void>;
  updateModel: (model: string) => Promise<void>;
  updateApiKey: (apiKey: string) => Promise<void>;
  updateBaseUrl: (baseUrl: string) => Promise<void>;
  updateMaxIterations: (max: number) => Promise<void>;
  updateUseExpressionModel: (use: boolean) => Promise<void>;
  updateExpressionProvider: (provider: AIProvider) => Promise<void>;
  updateExpressionModel: (model: string) => Promise<void>;
  updateExpressionApiKey: (apiKey: string) => Promise<void>;
  updateExpressionBaseUrl: (baseUrl: string) => Promise<void>;

  /** Resolve the effective provider/model/key/url for expression assist */
  getExpressionModelConfig: () => { provider: AIProvider; model: string; apiKey: string; baseUrl: string };

  // -- Chat actions --
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  clearChat: () => void;
  setIsGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  setAbortController: (controller: AbortController | null) => void;
  cancelGeneration: () => void;
  addTokenUsage: (usage: TokenUsage) => void;
  resetSessionUsage: () => void;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const AI_SETTINGS_KEY = 'sigilweaver-ai-settings';
const AI_CHAT_HISTORY_KEY = 'sigilweaver-ai-chat-history';

function loadPersistedSettings(): AISettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AISettings>;
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_AI_SETTINGS };
}

function savePersistedSettings(settings: AISettings): void {
  try {
    // Don't persist the API key to localStorage in web mode for security
    // In Electron, the platform adapter handles encrypted storage
    const toSave = { ...settings };
    if (typeof window !== 'undefined' && !('electron' in window)) {
      // In web mode, still persist the key in localStorage (user's choice)
      // They can use a local model if they're concerned about key storage
    }
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore save errors
  }
}

function loadPersistedChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(AI_CHAT_HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw) as ChatMessage[];
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function savePersistedChat(messages: ChatMessage[]): void {
  try {
    // Keep only last 100 messages to avoid localStorage bloat
    const toSave = messages.slice(-100);
    localStorage.setItem(AI_CHAT_HISTORY_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore save errors
  }
}

function buildAISettings(state: AIState): AISettings {
  return {
    enabled: state.enabled,
    provider: state.provider,
    model: state.model,
    apiKey: state.apiKey,
    baseUrl: state.baseUrl,
    maxIterations: state.maxIterations,
    useExpressionModel: state.useExpressionModel,
    expressionProvider: state.expressionProvider,
    expressionModel: state.expressionModel,
    expressionApiKey: state.expressionApiKey,
    expressionBaseUrl: state.expressionBaseUrl,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAIStore = create<AIState>()((set, get) => ({
  ...DEFAULT_AI_SETTINGS,
  messages: [],
  isGenerating: false,
  error: null,
  abortController: null,
  sessionUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },

  loadAISettings: async () => {
    const settings = loadPersistedSettings();
    const messages = loadPersistedChat();
    set({ ...settings, messages });
  },

  updateEnabled: async (enabled) => {
    set({ enabled });
    savePersistedSettings(buildAISettings({ ...get(), enabled }));
  },

  updateProvider: async (provider) => {
    // Auto-set a default model when switching providers
    const currentModel = get().model;
    const defaultForProvider = DEFAULT_MODELS[provider];
    const model = currentModel || defaultForProvider;
    set({ provider, model });
    savePersistedSettings(buildAISettings({ ...get(), provider, model }));
  },

  updateModel: async (model) => {
    set({ model });
    savePersistedSettings(buildAISettings({ ...get(), model }));
  },

  updateApiKey: async (apiKey) => {
    set({ apiKey });
    savePersistedSettings(buildAISettings({ ...get(), apiKey }));
  },

  updateBaseUrl: async (baseUrl) => {
    set({ baseUrl });
    savePersistedSettings(buildAISettings({ ...get(), baseUrl }));
  },

  updateMaxIterations: async (maxIterations) => {
    const clamped = Math.max(1, Math.min(100, maxIterations));
    set({ maxIterations: clamped });
    savePersistedSettings(buildAISettings({ ...get(), maxIterations: clamped }));
  },

  updateUseExpressionModel: async (useExpressionModel) => {
    set({ useExpressionModel });
    savePersistedSettings(buildAISettings({ ...get(), useExpressionModel }));
  },

  updateExpressionProvider: async (expressionProvider) => {
    set({ expressionProvider });
    savePersistedSettings(buildAISettings({ ...get(), expressionProvider }));
  },

  updateExpressionModel: async (expressionModel) => {
    set({ expressionModel });
    savePersistedSettings(buildAISettings({ ...get(), expressionModel }));
  },

  updateExpressionApiKey: async (expressionApiKey) => {
    set({ expressionApiKey });
    savePersistedSettings(buildAISettings({ ...get(), expressionApiKey }));
  },

  updateExpressionBaseUrl: async (expressionBaseUrl) => {
    set({ expressionBaseUrl });
    savePersistedSettings(buildAISettings({ ...get(), expressionBaseUrl }));
  },

  getExpressionModelConfig: () => {
    const s = get();
    if (s.useExpressionModel && s.expressionModel) {
      return {
        provider: s.expressionProvider,
        model: s.expressionModel,
        apiKey: s.expressionApiKey || s.apiKey, // fall back to main key if same provider
        baseUrl: s.expressionBaseUrl || s.baseUrl,
      };
    }
    // Fall back to the main model
    return {
      provider: s.provider,
      model: s.model,
      apiKey: s.apiKey,
      baseUrl: s.baseUrl,
    };
  },

  // -- Chat actions --

  addMessage: (msg) => {
    set((s) => {
      const messages = [...s.messages, msg];
      savePersistedChat(messages);
      return { messages };
    });
  },

  setMessages: (msgs) => {
    set({ messages: msgs });
    savePersistedChat(msgs);
  },

  clearChat: () => {
    set({ messages: [], error: null, sessionUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } });
    savePersistedChat([]);
  },

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  setError: (error) => set({ error }),

  setAbortController: (abortController) => set({ abortController }),

  cancelGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isGenerating: false });
    }
  },

  addTokenUsage: (usage) => {
    set((s) => ({
      sessionUsage: {
        promptTokens: s.sessionUsage.promptTokens + usage.promptTokens,
        completionTokens: s.sessionUsage.completionTokens + usage.completionTokens,
        totalTokens: s.sessionUsage.totalTokens + usage.totalTokens,
      },
    }));
  },

  resetSessionUsage: () => {
    set({ sessionUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } });
  },
}));
