import { describe, expect, it } from "vitest";
import { mergeWithDefaults, DEFAULT_SETTINGS } from "../settings";

describe("mergeWithDefaults", () => {
  it("returns DEFAULT_SETTINGS when stored object is empty", () => {
    const result = mergeWithDefaults({});
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("preserves top-level scalar overrides", () => {
    const result = mergeWithDefaults({ author: "Alice" });
    expect(result.author).toBe("Alice");
    expect(result.executionMode).toBe(DEFAULT_SETTINGS.executionMode);
  });

  it("deep-merges nested objects instead of replacing them", () => {
    // Simulate stored settings from before showBlockingIndicators existed
    const oldUi = {
      snapToGrid: false,
      minimapVisible: false,
      minimapPosition: "top-left",
      edgeStyle: "straight",
      // showBlockingIndicators is missing - should default to true
    };

    const result = mergeWithDefaults({ ui: oldUi });

    // Stored values preserved
    expect(result.ui.snapToGrid).toBe(false);
    expect(result.ui.minimapVisible).toBe(false);
    expect(result.ui.minimapPosition).toBe("top-left");
    expect(result.ui.edgeStyle).toBe("straight");

    // New field gets its default
    expect(result.ui.showBlockingIndicators).toBe(true);
  });

  it("deep-merges multiple nested objects independently", () => {
    const result = mergeWithDefaults({
      backend: { url: "http://custom:9999" },
      comments: { visible: false },
    });

    // Stored overrides applied
    expect(result.backend.url).toBe("http://custom:9999");
    expect(result.comments.visible).toBe(false);

    // Other fields in those objects get defaults
    expect(result.backend.autoStart).toBe(true);
    expect(result.backend.previewRows).toBe(100);
    expect(result.comments.alignment).toBe("center");
    expect(result.comments.maxWidth).toBe(150);
  });

  it("does not merge arrays or null values as objects", () => {
    const result = mergeWithDefaults({
      hub: { sessionToken: null, url: "https://hub.example.com" },
    });
    expect(result.hub.sessionToken).toBeNull();
    expect(result.hub.url).toBe("https://hub.example.com");
    expect(result.hub.rememberLogin).toBe(false);
  });

  it("handles a complete stored settings object without data loss", () => {
    const stored = { ...DEFAULT_SETTINGS, author: "Bob" };
    const result = mergeWithDefaults(stored as Record<string, unknown>);
    expect(result.author).toBe("Bob");
    expect(result.ui).toEqual(DEFAULT_SETTINGS.ui);
  });
});
