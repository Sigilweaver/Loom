import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "../settingsStore";
import { DEFAULT_SETTINGS } from "../../types/settings";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
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

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock electronAPI - not present by default (browser mode)
const originalElectronAPI = window.electronAPI;

describe("SettingsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Remove electronAPI for browser mode tests
    // @ts-expect-error - intentionally setting to undefined for browser mode testing
    window.electronAPI = undefined;

    // Reset the store state before each test
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      loaded: false,
    });
  });

  afterAll(() => {
    // Restore original electronAPI
    // @ts-expect-error - restoring potentially undefined value
    window.electronAPI = originalElectronAPI;
  });

  describe("Initial State", () => {
    it("has correct default state", () => {
      const state = useSettingsStore.getState();

      expect(state.author).toBe(DEFAULT_SETTINGS.author);
      expect(state.backend).toEqual(DEFAULT_SETTINGS.backend);
      expect(state.theme).toEqual(DEFAULT_SETTINGS.theme);
      expect(state.ui).toEqual(DEFAULT_SETTINGS.ui);
      expect(state.loaded).toBe(false);
    });

    it("default settings have expected structure", () => {
      expect(DEFAULT_SETTINGS.author).toBe("User");
      expect(DEFAULT_SETTINGS.backend.url).toBe("http://localhost:8000");
      expect(DEFAULT_SETTINGS.backend.autoStart).toBe(true);
      expect(DEFAULT_SETTINGS.theme.id).toBe("sigilweaver");
      expect(DEFAULT_SETTINGS.ui.snapToGrid).toBe(true);
      expect(DEFAULT_SETTINGS.ui.minimapVisible).toBe(true);
      expect(DEFAULT_SETTINGS.ui.minimapPosition).toBe("bottom-right");
    });
  });

  describe("loadSettings (browser mode)", () => {
    it("loads default settings when localStorage is empty", async () => {
      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.author).toBe(DEFAULT_SETTINGS.author);
      expect(state.backend).toEqual(DEFAULT_SETTINGS.backend);
    });

    it("loads settings from localStorage when available", async () => {
      const storedSettings = {
        ...DEFAULT_SETTINGS,
        author: "John Doe",
        theme: { id: "dark" },
      };
      localStorageMock.setItem(
        "sigilweaver-settings",
        JSON.stringify(storedSettings)
      );

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.author).toBe("John Doe");
      expect(state.theme.id).toBe("dark");
    });

    it("handles corrupted localStorage gracefully", async () => {
      localStorageMock.setItem("sigilweaver-settings", "not valid json{{{");

      // Should not throw
      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.loaded).toBe(true);
      // Should fall back to defaults
      expect(state.author).toBe(DEFAULT_SETTINGS.author);
    });

    it("merges partial settings with defaults", async () => {
      // Only store some settings
      localStorageMock.setItem(
        "sigilweaver-settings",
        JSON.stringify({ author: "Partial User" })
      );

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.author).toBe("Partial User");
      // Other settings should be defaults
      expect(state.backend).toEqual(DEFAULT_SETTINGS.backend);
      expect(state.ui).toEqual(DEFAULT_SETTINGS.ui);
    });
  });

  describe("updateAuthor", () => {
    it("updates author and persists to localStorage", async () => {
      await useSettingsStore.getState().updateAuthor("Jane Smith");

      const state = useSettingsStore.getState();
      expect(state.author).toBe("Jane Smith");

      // Check localStorage was called
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "sigilweaver-settings",
        expect.stringContaining("Jane Smith")
      );
    });

    it("preserves other settings when updating author", async () => {
      // First set some non-default values
      useSettingsStore.setState({
        theme: { id: "dark" },
        backend: { url: "http://custom:9000", autoStart: false, previewRows: 200 },
      });

      await useSettingsStore.getState().updateAuthor("New Author");

      const state = useSettingsStore.getState();
      expect(state.author).toBe("New Author");
      expect(state.theme.id).toBe("dark");
      expect(state.backend.url).toBe("http://custom:9000");
    });
  });

  describe("updateBackendUrl", () => {
    it("updates backend URL and persists", async () => {
      await useSettingsStore.getState().updateBackendUrl("http://api.example.com:8080");

      const state = useSettingsStore.getState();
      expect(state.backend.url).toBe("http://api.example.com:8080");
      // autoStart should remain unchanged
      expect(state.backend.autoStart).toBe(DEFAULT_SETTINGS.backend.autoStart);
    });

    it("handles empty URL", async () => {
      await useSettingsStore.getState().updateBackendUrl("");

      const state = useSettingsStore.getState();
      expect(state.backend.url).toBe("");
    });
  });

  describe("updateBackendAutoStart", () => {
    it("updates autoStart setting", async () => {
      expect(useSettingsStore.getState().backend.autoStart).toBe(true);

      await useSettingsStore.getState().updateBackendAutoStart(false);

      expect(useSettingsStore.getState().backend.autoStart).toBe(false);
    });

    it("preserves URL when updating autoStart", async () => {
      await useSettingsStore.getState().updateBackendUrl("http://custom:8000");
      await useSettingsStore.getState().updateBackendAutoStart(false);

      const state = useSettingsStore.getState();
      expect(state.backend.url).toBe("http://custom:8000");
      expect(state.backend.autoStart).toBe(false);
    });
  });

  describe("updateBackendPreviewRows", () => {
    it("updates previewRows setting", async () => {
      expect(useSettingsStore.getState().backend.previewRows).toBe(100);

      await useSettingsStore.getState().updateBackendPreviewRows(500);

      expect(useSettingsStore.getState().backend.previewRows).toBe(500);
    });

    it("preserves other backend settings when updating previewRows", async () => {
      await useSettingsStore.getState().updateBackendUrl("http://custom:8000");
      await useSettingsStore.getState().updateBackendAutoStart(false);
      await useSettingsStore.getState().updateBackendPreviewRows(200);

      const state = useSettingsStore.getState();
      expect(state.backend.url).toBe("http://custom:8000");
      expect(state.backend.autoStart).toBe(false);
      expect(state.backend.previewRows).toBe(200);
    });
  });

  describe("updateTheme", () => {
    it("updates theme ID", async () => {
      await useSettingsStore.getState().updateTheme("dark");

      expect(useSettingsStore.getState().theme.id).toBe("dark");
    });

    it("persists theme to storage", async () => {
      await useSettingsStore.getState().updateTheme("light");

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "sigilweaver-settings",
        expect.stringContaining('"id":"light"')
      );
    });
  });

  describe("updateSnapToGrid", () => {
    it("updates snapToGrid setting", async () => {
      expect(useSettingsStore.getState().ui.snapToGrid).toBe(true);

      await useSettingsStore.getState().updateSnapToGrid(false);

      expect(useSettingsStore.getState().ui.snapToGrid).toBe(false);
    });

    it("preserves other UI settings when updating snapToGrid", async () => {
      await useSettingsStore.getState().updateMinimapPosition("top-left");
      await useSettingsStore.getState().updateSnapToGrid(false);

      const state = useSettingsStore.getState();
      expect(state.ui.snapToGrid).toBe(false);
      expect(state.ui.minimapPosition).toBe("top-left");
    });
  });

  describe("updateMinimapVisible", () => {
    it("updates minimapVisible setting", async () => {
      expect(useSettingsStore.getState().ui.minimapVisible).toBe(true);

      await useSettingsStore.getState().updateMinimapVisible(false);

      expect(useSettingsStore.getState().ui.minimapVisible).toBe(false);
    });
  });

  describe("updateMinimapPosition", () => {
    it("updates minimap position", async () => {
      await useSettingsStore.getState().updateMinimapPosition("top-left");

      expect(useSettingsStore.getState().ui.minimapPosition).toBe("top-left");
    });

    it("accepts all valid positions", async () => {
      const positions: Array<"top-left" | "top-right" | "bottom-left" | "bottom-right"> = [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ];

      for (const position of positions) {
        await useSettingsStore.getState().updateMinimapPosition(position);
        expect(useSettingsStore.getState().ui.minimapPosition).toBe(position);
      }
    });
  });

  describe("resetToDefaults", () => {
    it("resets all settings to defaults", async () => {
      // First change various settings
      await useSettingsStore.getState().updateAuthor("Custom Author");
      await useSettingsStore.getState().updateTheme("dark");
      await useSettingsStore.getState().updateBackendUrl("http://custom:9000");
      await useSettingsStore.getState().updateSnapToGrid(false);

      await useSettingsStore.getState().resetToDefaults();

      const state = useSettingsStore.getState();
      expect(state.author).toBe(DEFAULT_SETTINGS.author);
      expect(state.theme).toEqual(DEFAULT_SETTINGS.theme);
      expect(state.backend).toEqual(DEFAULT_SETTINGS.backend);
      expect(state.ui).toEqual(DEFAULT_SETTINGS.ui);
    });

    it("sets loaded to true after reset", async () => {
      useSettingsStore.setState({ loaded: false });

      await useSettingsStore.getState().resetToDefaults();

      expect(useSettingsStore.getState().loaded).toBe(true);
    });

    it("persists defaults to storage", async () => {
      await useSettingsStore.getState().resetToDefaults();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "sigilweaver-settings",
        JSON.stringify(DEFAULT_SETTINGS)
      );
    });
  });

  describe("Persistence", () => {
    it("saves complete settings object to localStorage", async () => {
      await useSettingsStore.getState().updateAuthor("Test User");

      const lastCall = localStorageMock.setItem.mock.calls[
        localStorageMock.setItem.mock.calls.length - 1
      ];
      expect(lastCall).toBeDefined();
      const savedData = JSON.parse(lastCall![1]);

      // Verify all required fields are present
      expect(savedData).toHaveProperty("author");
      expect(savedData).toHaveProperty("backend");
      expect(savedData).toHaveProperty("theme");
      expect(savedData).toHaveProperty("ui");

      // Verify nested structure
      expect(savedData.backend).toHaveProperty("url");
      expect(savedData.backend).toHaveProperty("autoStart");
      expect(savedData.ui).toHaveProperty("snapToGrid");
      expect(savedData.ui).toHaveProperty("minimapVisible");
      expect(savedData.ui).toHaveProperty("minimapPosition");
    });
  });

  describe("Electron Mode", () => {
    it("uses electronAPI when available for loading", async () => {
      const mockGetSettings = vi.fn().mockResolvedValue({
        ...DEFAULT_SETTINGS,
        author: "Electron User",
      });
      // @ts-expect-error - partial mock for testing
      window.electronAPI = {
        getSettings: mockGetSettings,
      };

      await useSettingsStore.getState().loadSettings();

      expect(mockGetSettings).toHaveBeenCalled();
      expect(useSettingsStore.getState().author).toBe("Electron User");
    });

    it("uses electronAPI when available for saving", async () => {
      const mockSetSettings = vi.fn().mockResolvedValue(undefined);
      // @ts-expect-error - partial mock for testing
      window.electronAPI = {
        setSettings: mockSetSettings,
      };

      await useSettingsStore.getState().updateAuthor("Electron Author");

      expect(mockSetSettings).toHaveBeenCalled();
      // localStorage should NOT be called when electronAPI is available
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });
});
