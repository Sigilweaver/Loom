import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Force zod's compiled CommonJS entry. Zod 4's ESM entry re-exports its
      // `z` namespace via `import * as z` / `export { z }` chains that the
      // vitest module runner mishandles (yielding an undefined `z`). The CJS
      // build exposes a flat `z` export that resolves correctly.
      zod: path.resolve(__dirname, "node_modules/zod/index.cjs"),
      "@api": path.resolve(__dirname, "src/api"),
      "@components": path.resolve(__dirname, "src/components"),
      "@contexts": path.resolve(__dirname, "src/contexts"),
      "@data": path.resolve(__dirname, "src/data"),
      "@domain": path.resolve(__dirname, "src/domain"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@platform": path.resolve(__dirname, "src/platform"),
      "@state": path.resolve(__dirname, "src/state"),
      "@utils": path.resolve(__dirname, "src/utils"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
      "electron/**/*.test.ts",
    ],
    exclude: [
      "**/*.integration.test.{ts,tsx}", // Exclude integration tests by default
      "**/__tests__/**/*.integration.test.{ts,tsx}",
    ],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "**/*.d.ts",
        "**/vite-env.d.ts",
        "electron/**",
        "dist/**",
        "dist-electron/**",
      ],
    },
  },
});
