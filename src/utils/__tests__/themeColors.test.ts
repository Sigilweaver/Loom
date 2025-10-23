import { describe, expect, it } from "vitest";
import { getThemeColor } from "../themeColors";

describe("themeColors utilities", () => {
  describe("getThemeColor", () => {
    // Note: jsdom doesn't fully support CSS custom properties via getComputedStyle
    // So these tests verify the fallback behavior

    it("should return fallback for edge-default-stroke", () => {
      const color = getThemeColor("--color-edge-default-stroke");
      // In jsdom, CSS variables won't be set, so fallback is returned
      expect(color).toBe("#6b7280");
    });

    it("should return fallback for edge-invalid-stroke", () => {
      const color = getThemeColor("--color-edge-invalid-stroke");
      expect(color).toBe("#dc2626");
    });

    it("should return fallback for edge-selected-stroke", () => {
      const color = getThemeColor("--color-edge-selected-stroke");
      expect(color).toBe("#3b82f6");
    });

    it("should return default fallback for unknown CSS variable", () => {
      const color = getThemeColor("--unknown-variable");
      expect(color).toBe("#6b7280"); // Default fallback
    });

    it("should return default fallback for empty string", () => {
      const color = getThemeColor("");
      expect(color).toBe("#6b7280");
    });

    it("should handle any CSS variable name format", () => {
      // All unknown variables get the default fallback
      expect(getThemeColor("--my-custom-color")).toBe("#6b7280");
      expect(getThemeColor("--color-1")).toBe("#6b7280");
      expect(getThemeColor("--with-multiple-hyphens")).toBe("#6b7280");
    });

    it("should be callable multiple times", () => {
      const color1 = getThemeColor("--color-edge-default-stroke");
      const color2 = getThemeColor("--color-edge-invalid-stroke");
      const color3 = getThemeColor("--color-edge-selected-stroke");

      expect(color1).toBe("#6b7280");
      expect(color2).toBe("#dc2626");
      expect(color3).toBe("#3b82f6");
    });

    it("should have proper fallback map for known colors", () => {
      // Test that the fallback map contains expected values
      const knownFallbacks = [
        "--color-edge-default-stroke",
        "--color-edge-invalid-stroke",
        "--color-edge-selected-stroke",
      ];

      knownFallbacks.forEach((varName) => {
        const color = getThemeColor(varName);
        expect(color).toMatch(/^#[0-9a-f]{6}$/i); // Valid hex color
      });
    });
  });
});
