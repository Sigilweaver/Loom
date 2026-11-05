import { describe, expect, it } from "vitest";
import { PROVIDER_LABELS, PROVIDER_MODELS } from "../providers";
import type { AIProvider } from "@state/aiStore";

describe("provider configuration", () => {
  const ALL_PROVIDERS: AIProvider[] = [
    "openai",
    "anthropic",
    "google",
    "mistral",
    "openai-compatible",
  ];

  it("should have labels for all providers", () => {
    for (const provider of ALL_PROVIDERS) {
      expect(PROVIDER_LABELS[provider]).toBeTruthy();
    }
  });

  it("should have model suggestions for cloud providers", () => {
    expect(PROVIDER_MODELS.openai.length).toBeGreaterThan(0);
    expect(PROVIDER_MODELS.anthropic.length).toBeGreaterThan(0);
    expect(PROVIDER_MODELS.google.length).toBeGreaterThan(0);
    expect(PROVIDER_MODELS.mistral.length).toBeGreaterThan(0);
  });

  it("should have empty model list for openai-compatible", () => {
    expect(PROVIDER_MODELS["openai-compatible"]).toEqual([]);
  });

  it("should have descriptive labels", () => {
    expect(PROVIDER_LABELS.openai).toBe("OpenAI");
    expect(PROVIDER_LABELS.anthropic).toBe("Anthropic");
    expect(PROVIDER_LABELS["openai-compatible"]).toContain("Ollama");
  });

  it("lists the current Anthropic models first-class", () => {
    expect(PROVIDER_MODELS.anthropic).toEqual([
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
    ]);
  });

  it("has no retired model ids in the static lists", () => {
    const all = Object.values(PROVIDER_MODELS).flat();
    for (const id of all) {
      expect(id).not.toMatch(/gpt-4|claude-.*-4-|gemini-2/);
    }
  });
});
