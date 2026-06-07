/**
 * AI Store
 *
 * Manages AI feature state: provider settings, chat messages, agent invocation.
 * AI is off by default. Zero AI code loads unless the user enables it.
 *
 * **Tab-scoped sessions**: Chat messages, pending questions, generation state,
 * and token usage are isolated per tab. When the user switches tabs, the current
 * AI session is saved and the target tab's session is restored. Settings
 * (provider, model, API key) remain global - they apply to all tabs.
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

  // -- Optional audit model --
  /** When true, agent output is audited after each turn */
  useAudit: boolean;
  /** When true, audit uses a separate model instead of the main one */
  useAuditModel: boolean;
  /** Provider for audit (falls back to main provider) */
  auditProvider: AIProvider;
  /** Model for audit (falls back to main model) */
  auditModel: string;
  /** API key for audit (falls back to main key) */
  auditApiKey: string;
  /** Base URL for audit (falls back to main baseUrl) */
  auditBaseUrl: string;
}

export type ChatRole = 'user' | 'assistant' | 'tool';

export interface ToolCallInfo {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

/**
 * A single segment of an assistant message, enabling interleaved
 * tool-call blocks and text blocks in the order they actually occurred.
 */
export type MessageSegment =
  | { type: 'tool-calls'; toolCalls: ToolCallInfo[] }
  | { type: 'text'; content: string };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
  /** Interleaved segments (tool calls + text) in execution order */
  segments?: MessageSegment[];
  /** Token usage for this message (assistant messages only) */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Serializable snapshot of a tab's AI session state.
 * Stored in tabStore's TabData when switching tabs.
 * Does NOT include non-serializable fields (abortController, pendingQuestion resolve).
 */
export interface TabAISession {
  messages: ChatMessage[];
  sessionUsage: TokenUsage;
  stoppedAtLimit: boolean;
  /** Error message from last generation, if any */
  error: string | null;
}

/**
 * A pending follow-up question from the agent.
 * The agent loop blocks until the user answers, then resumes.
 */
export interface PendingQuestionOption {
  /** Short label shown on the button */
  label: string;
  /** Optional description shown below the label */
  description?: string | undefined;
  /** When true, visually highlight this as the recommended choice */
  recommended?: boolean | undefined;
}

export interface PendingQuestion {
  /** The question text displayed to the user */
  question: string;
  /** Optional predefined options (user can always type custom input) */
  options: PendingQuestionOption[];
  /** When true, user can select multiple options */
  multiSelect: boolean;
  /** Callback to resolve the agent's tool promise with the user's answer */
  resolve: (answer: string | string[]) => void;
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
  useAudit: false,
  useAuditModel: false,
  auditProvider: 'openai',
  auditModel: '',
  auditApiKey: '',
  auditBaseUrl: '',
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
  /** Text currently being streamed (partial, before message is finalized) */
  streamingText: string;
  /** Segments collected during current stream - interleaved tool calls and text from completed steps */
  streamingSegments: MessageSegment[];
  /** Whether the agent stopped because it hit the max iteration limit */
  stoppedAtLimit: boolean;
  /** A pending follow-up question from the agent (null when none) */
  pendingQuestion: PendingQuestion | null;

  // -- Multi-agent / per-tab concurrency --
  /** Tab ID that owns the currently running agent (null when idle) */
  agentTabId: string | null;
  /** Per-tab queues of pending prompts, keyed by tab ID */
  runQueues: Record<string, string[]>;

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
  updateUseAudit: (use: boolean) => Promise<void>;
  updateUseAuditModel: (use: boolean) => Promise<void>;
  updateAuditProvider: (provider: AIProvider) => Promise<void>;
  updateAuditModel: (model: string) => Promise<void>;
  updateAuditApiKey: (apiKey: string) => Promise<void>;
  updateAuditBaseUrl: (baseUrl: string) => Promise<void>;

  /** Resolve the effective provider/model/key/url for expression assist */
  getExpressionModelConfig: () => { provider: AIProvider; model: string; apiKey: string; baseUrl: string };

  /** Resolve the effective provider/model/key/url for audit */
  getAuditModelConfig: () => { provider: AIProvider; model: string; apiKey: string; baseUrl: string };

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
  setStreamingText: (text: string) => void;
  appendStreamingText: (delta: string) => void;
  setStreamingSegments: (segments: MessageSegment[]) => void;
  addStreamingStepSegments: (text: string, toolCalls: ToolCallInfo[]) => void;
  setStoppedAtLimit: (stopped: boolean) => void;
  setPendingQuestion: (question: PendingQuestion | null) => void;

  // -- Multi-agent / per-tab concurrency --
  /** Set which tab owns the currently running agent. */
  setAgentTabId: (tabId: string | null) => void;
  /** Enqueue a prompt for the given tab when an agent is already running. */
  enqueuePrompt: (tabId: string, prompt: string) => void;
  /** Dequeue the next prompt for the given tab. Returns undefined if empty. */
  dequeuePrompt: (tabId: string) => string | undefined;
  /** Clear the run queue for a tab (e.g. on tab close). */
  clearRunQueue: (tabId: string) => void;
  /** Get the queue length for a tab. */
  getQueueLength: (tabId?: string) => number;

  // -- Tab session management --
  /** Snapshot the current AI session for saving to a tab. */
  snapshotSession: () => TabAISession;
  /** Restore an AI session from a tab snapshot. Cancels any in-progress generation. */
  restoreSession: (session: TabAISession | undefined) => void;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const AI_SETTINGS_KEY = 'ai-settings';
const AI_CHAT_HISTORY_KEY = 'ai-chat-history';
const AI_STOPPED_AT_LIMIT_KEY = 'ai-stopped-at-limit';

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

function loadPersistedStoppedAtLimit(): boolean {
  try {
    return localStorage.getItem(AI_STOPPED_AT_LIMIT_KEY) === 'true';
  } catch {
    return false;
  }
}

function savePersistedStoppedAtLimit(stopped: boolean): void {
  try {
    if (stopped) {
      localStorage.setItem(AI_STOPPED_AT_LIMIT_KEY, 'true');
    } else {
      localStorage.removeItem(AI_STOPPED_AT_LIMIT_KEY);
    }
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
    useAudit: state.useAudit,
    useAuditModel: state.useAuditModel,
    auditProvider: state.auditProvider,
    auditModel: state.auditModel,
    auditApiKey: state.auditApiKey,
    auditBaseUrl: state.auditBaseUrl,
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
  streamingText: '',
  streamingSegments: [],
  stoppedAtLimit: false,
  pendingQuestion: null,
  agentTabId: null,
  runQueues: {},

  loadAISettings: async () => {
    const settings = loadPersistedSettings();
    const messages = loadPersistedChat();
    const stoppedAtLimit = loadPersistedStoppedAtLimit();
    set({ ...settings, messages, stoppedAtLimit });
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

  updateUseAudit: async (useAudit) => {
    set({ useAudit });
    savePersistedSettings(buildAISettings({ ...get(), useAudit }));
  },

  updateUseAuditModel: async (useAuditModel) => {
    set({ useAuditModel });
    savePersistedSettings(buildAISettings({ ...get(), useAuditModel }));
  },

  updateAuditProvider: async (auditProvider) => {
    set({ auditProvider });
    savePersistedSettings(buildAISettings({ ...get(), auditProvider }));
  },

  updateAuditModel: async (auditModel) => {
    set({ auditModel });
    savePersistedSettings(buildAISettings({ ...get(), auditModel }));
  },

  updateAuditApiKey: async (auditApiKey) => {
    set({ auditApiKey });
    savePersistedSettings(buildAISettings({ ...get(), auditApiKey }));
  },

  updateAuditBaseUrl: async (auditBaseUrl) => {
    set({ auditBaseUrl });
    savePersistedSettings(buildAISettings({ ...get(), auditBaseUrl }));
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

  getAuditModelConfig: () => {
    const s = get();
    if (s.useAuditModel && s.auditModel) {
      return {
        provider: s.auditProvider,
        model: s.auditModel,
        apiKey: s.auditApiKey || s.apiKey,
        baseUrl: s.auditBaseUrl || s.baseUrl,
      };
    }
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
    const { pendingQuestion } = get();
    // Dismiss any pending follow-up question
    if (pendingQuestion) {
      set({ pendingQuestion: null });
    }
    set({
      messages: [],
      error: null,
      sessionUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      stoppedAtLimit: false,
      streamingText: '',
      streamingSegments: [],
    });
    savePersistedChat([]);
    savePersistedStoppedAtLimit(false);
  },

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  setError: (error) => set({ error }),

  setAbortController: (abortController) => set({ abortController }),

  cancelGeneration: () => {
    const { abortController, pendingQuestion, agentTabId } = get();
    // If a follow-up question is pending, dismiss it
    if (pendingQuestion) {
      set({ pendingQuestion: null });
    }
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isGenerating: false, agentTabId: null });
    }
    // Clear the run queue for the tab that was running
    if (agentTabId) {
      get().clearRunQueue(agentTabId);
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

  setStreamingText: (streamingText) => set({ streamingText }),

  appendStreamingText: (delta) => {
    set((s) => ({ streamingText: s.streamingText + delta }));
  },

  setStreamingSegments: (streamingSegments) => set({ streamingSegments }),

  addStreamingStepSegments: (text, toolCalls) => {
    set((s) => {
      const newSegments = [...s.streamingSegments];
      // Text first (model "says" something), then tool calls (model "does" something)
      if (text) {
        newSegments.push({ type: 'text', content: text });
      }
      if (toolCalls.length > 0) {
        newSegments.push({ type: 'tool-calls', toolCalls });
      }
      return { streamingSegments: newSegments };
    });
  },

  setStoppedAtLimit: (stoppedAtLimit) => {
    set({ stoppedAtLimit });
    savePersistedStoppedAtLimit(stoppedAtLimit);
  },

  setPendingQuestion: (pendingQuestion) => set({ pendingQuestion }),

  // -- Multi-agent / per-tab concurrency --

  setAgentTabId: (agentTabId) => set({ agentTabId }),

  enqueuePrompt: (tabId, prompt) => {
    set((s) => ({
      runQueues: {
        ...s.runQueues,
        [tabId]: [...(s.runQueues[tabId] ?? []), prompt],
      },
    }));
  },

  dequeuePrompt: (tabId) => {
    const queue = get().runQueues[tabId];
    if (!queue || queue.length === 0) return undefined;
    const [next, ...rest] = queue;
    set((s) => ({
      runQueues: { ...s.runQueues, [tabId]: rest },
    }));
    return next;
  },

  clearRunQueue: (tabId) => {
    set((s) => {
      const { [tabId]: _, ...rest } = s.runQueues;
      return { runQueues: rest };
    });
  },

  getQueueLength: (tabId) => {
    const id = tabId ?? get().agentTabId;
    if (!id) return 0;
    return get().runQueues[id]?.length ?? 0;
  },

  // -- Tab session management --

  snapshotSession: () => {
    const s = get();
    return {
      messages: s.messages,
      sessionUsage: { ...s.sessionUsage },
      stoppedAtLimit: s.stoppedAtLimit,
      error: s.error,
    };
  },

  restoreSession: (session) => {
    // Cancel any in-progress generation before switching contexts
    const { abortController, pendingQuestion } = get();
    if (pendingQuestion) {
      set({ pendingQuestion: null });
    }
    if (abortController) {
      abortController.abort();
    }

    if (session) {
      set({
        messages: session.messages,
        sessionUsage: session.sessionUsage,
        stoppedAtLimit: session.stoppedAtLimit,
        error: session.error,
        isGenerating: false,
        abortController: null,
        agentTabId: null,
        streamingText: '',
        streamingSegments: [],
        pendingQuestion: null,
      });
    } else {
      // No session for this tab - start fresh
      set({
        messages: [],
        sessionUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        stoppedAtLimit: false,
        error: null,
        isGenerating: false,
        abortController: null,
        agentTabId: null,
        streamingText: '',
        streamingSegments: [],
        pendingQuestion: null,
      });
    }
    // Persist the new active session's chat
    savePersistedChat(get().messages);
    savePersistedStoppedAtLimit(get().stoppedAtLimit);
  },
}));
