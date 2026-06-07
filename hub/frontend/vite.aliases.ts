import path from "path";

/**
 * Single source of truth for module path aliases.
 *
 * Both vite.config.ts (dev/build) and vitest.config.ts (tests) import this so
 * the alias maps cannot drift out of sync. A missing alias here previously
 * caused tests to fail resolving "@state/authStore".
 */
export const aliases = {
  "@": path.resolve(__dirname, "src"),
  "@components": path.resolve(__dirname, "src/components"),
  "@pages": path.resolve(__dirname, "src/pages"),
  "@api": path.resolve(__dirname, "src/api"),
  "@state": path.resolve(__dirname, "src/state"),
  "@hooks": path.resolve(__dirname, "src/hooks"),
  "@utils": path.resolve(__dirname, "src/utils"),
};
