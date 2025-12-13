import { useMemo } from "react";

/**
 * Hook that detects browser capabilities and quirks.
 * Currently detects Firefox for paste event handling compatibility.
 */
export function useBrowserDetection() {
  const isFirefox = useMemo(
    () =>
      typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent),
    []
  );

  return { isFirefox };
}
