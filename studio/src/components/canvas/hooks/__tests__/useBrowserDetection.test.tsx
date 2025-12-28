import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBrowserDetection } from "../useBrowserDetection";

describe("useBrowserDetection", () => {
  it("should detect browser capabilities", () => {
    const { result } = renderHook(() => useBrowserDetection());

    expect(result.current).toHaveProperty("isFirefox");
    expect(typeof result.current.isFirefox).toBe("boolean");
  });

  it("should detect Firefox correctly", () => {
    const originalUserAgent = navigator.userAgent;
    
    // Mock Firefox user agent
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
      configurable: true,
    });

    const { result } = renderHook(() => useBrowserDetection());
    expect(result.current.isFirefox).toBe(true);

    // Restore original
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it("should not detect Firefox for Chrome", () => {
    const originalUserAgent = navigator.userAgent;
    
    // Mock Chrome user agent
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      configurable: true,
    });

    const { result } = renderHook(() => useBrowserDetection());
    expect(result.current.isFirefox).toBe(false);

    // Restore original
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
  });
});
