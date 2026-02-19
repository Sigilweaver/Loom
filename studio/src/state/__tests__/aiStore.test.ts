import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAIStore, DEFAULT_AI_SETTINGS, type AIProvider } from "../aiStore";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe("aiStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset store
    useAIStore.setState({
      ...DEFAULT_AI_SETTINGS,
      messages: [],
      isGenerating: false,
      error: null,
      abortController: null,
      sessionUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });
  });

  describe("defaults", () => {
    it("should have AI disabled by default", () => {
      const state = useAIStore.getState();
      expect(state.enabled).toBe(false);
    });

    it("should default to openai provider", () => {
      const state = useAIStore.getState();
      expect(state.provider).toBe("openai");
    });

    it("should have empty model by default", () => {
      const state = useAIStore.getState();
      expect(state.model).toBe("");
    });

    it("should have maxIterations of 25", () => {
      const state = useAIStore.getState();
      expect(state.maxIterations).toBe(25);
    });

    it("should start with empty messages", () => {
      const state = useAIStore.getState();
      expect(state.messages).toEqual([]);
    });

    it("should not be generating", () => {
      const state = useAIStore.getState();
      expect(state.isGenerating).toBe(false);
    });
  });

  describe("settings updates", () => {
    it("should update enabled state", async () => {
      await useAIStore.getState().updateEnabled(true);
      expect(useAIStore.getState().enabled).toBe(true);
    });

    it("should persist settings to localStorage", async () => {
      await useAIStore.getState().updateEnabled(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "sigilweaver-ai-settings",
        expect.any(String),
      );
    });

    it("should update provider", async () => {
      await useAIStore.getState().updateProvider("anthropic");
      expect(useAIStore.getState().provider).toBe("anthropic");
    });

    it("should auto-set default model when switching providers", async () => {
      await useAIStore.getState().updateProvider("anthropic");
      expect(useAIStore.getState().model).toBe("claude-sonnet-4-20250514");
    });

    it("should update model", async () => {
      await useAIStore.getState().updateModel("gpt-4o-mini");
      expect(useAIStore.getState().model).toBe("gpt-4o-mini");
    });

    it("should update API key", async () => {
      await useAIStore.getState().updateApiKey("sk-test123");
      expect(useAIStore.getState().apiKey).toBe("sk-test123");
    });

    it("should update base URL", async () => {
      await useAIStore.getState().updateBaseUrl("http://localhost:11434/v1");
      expect(useAIStore.getState().baseUrl).toBe("http://localhost:11434/v1");
    });

    it("should clamp maxIterations between 1 and 100", async () => {
      await useAIStore.getState().updateMaxIterations(0);
      expect(useAIStore.getState().maxIterations).toBe(1);

      await useAIStore.getState().updateMaxIterations(200);
      expect(useAIStore.getState().maxIterations).toBe(100);

      await useAIStore.getState().updateMaxIterations(50);
      expect(useAIStore.getState().maxIterations).toBe(50);
    });
  });

  describe("chat actions", () => {
    it("should add a message", () => {
      useAIStore.getState().addMessage({
        id: "msg-1",
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });
      expect(useAIStore.getState().messages).toHaveLength(1);
      expect(useAIStore.getState().messages[0]?.content).toBe("Hello");
    });

    it("should persist chat to localStorage", () => {
      useAIStore.getState().addMessage({
        id: "msg-1",
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "sigilweaver-ai-chat-history",
        expect.any(String),
      );
    });

    it("should clear chat and reset session usage", () => {
      useAIStore.getState().addMessage({
        id: "msg-1",
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });
      useAIStore.getState().addTokenUsage({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });

      useAIStore.getState().clearChat();
      expect(useAIStore.getState().messages).toEqual([]);
      expect(useAIStore.getState().sessionUsage.totalTokens).toBe(0);
    });

    it("should set messages", () => {
      const msgs = [
        { id: "1", role: "user" as const, content: "Hi", timestamp: 1 },
        { id: "2", role: "assistant" as const, content: "Hello", timestamp: 2 },
      ];
      useAIStore.getState().setMessages(msgs);
      expect(useAIStore.getState().messages).toHaveLength(2);
    });
  });

  describe("generation state", () => {
    it("should track generating state", () => {
      useAIStore.getState().setIsGenerating(true);
      expect(useAIStore.getState().isGenerating).toBe(true);

      useAIStore.getState().setIsGenerating(false);
      expect(useAIStore.getState().isGenerating).toBe(false);
    });

    it("should set and clear errors", () => {
      useAIStore.getState().setError("Something went wrong");
      expect(useAIStore.getState().error).toBe("Something went wrong");

      useAIStore.getState().setError(null);
      expect(useAIStore.getState().error).toBeNull();
    });

    it("should cancel generation by aborting controller", () => {
      const controller = new AbortController();
      const abortSpy = vi.spyOn(controller, "abort");

      useAIStore.getState().setAbortController(controller);
      useAIStore.getState().setIsGenerating(true);

      useAIStore.getState().cancelGeneration();

      expect(abortSpy).toHaveBeenCalled();
      expect(useAIStore.getState().isGenerating).toBe(false);
      expect(useAIStore.getState().abortController).toBeNull();
    });

    it("should do nothing if no controller when cancelling", () => {
      useAIStore.getState().cancelGeneration();
      expect(useAIStore.getState().isGenerating).toBe(false);
    });
  });

  describe("token usage", () => {
    it("should accumulate token usage", () => {
      useAIStore.getState().addTokenUsage({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      useAIStore.getState().addTokenUsage({
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
      });

      const usage = useAIStore.getState().sessionUsage;
      expect(usage.promptTokens).toBe(300);
      expect(usage.completionTokens).toBe(150);
      expect(usage.totalTokens).toBe(450);
    });

    it("should reset session usage", () => {
      useAIStore.getState().addTokenUsage({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      useAIStore.getState().resetSessionUsage();
      expect(useAIStore.getState().sessionUsage.totalTokens).toBe(0);
    });
  });

  describe("loadAISettings", () => {
    it("should load persisted settings from localStorage", async () => {
      const saved = { ...DEFAULT_AI_SETTINGS, enabled: true, provider: "anthropic" as AIProvider };
      localStorageMock.setItem("sigilweaver-ai-settings", JSON.stringify(saved));

      await useAIStore.getState().loadAISettings();
      expect(useAIStore.getState().enabled).toBe(true);
      expect(useAIStore.getState().provider).toBe("anthropic");
    });

    it("should load persisted chat from localStorage", async () => {
      const msgs = [
        { id: "1", role: "user", content: "Hi", timestamp: 1 },
      ];
      localStorageMock.setItem("sigilweaver-ai-chat-history", JSON.stringify(msgs));

      await useAIStore.getState().loadAISettings();
      expect(useAIStore.getState().messages).toHaveLength(1);
    });

    it("should use defaults when localStorage is empty", async () => {
      await useAIStore.getState().loadAISettings();
      expect(useAIStore.getState().enabled).toBe(false);
      expect(useAIStore.getState().provider).toBe("openai");
    });
  });
});
