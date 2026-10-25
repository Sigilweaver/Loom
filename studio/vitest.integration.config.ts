import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for integration tests
 * 
 * These tests require a running backend server on http://localhost:8001
 * Run with: npm run test:integration
 */
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:8001/api'),
  },
  resolve: {
    alias: {
      "@api": path.resolve(import.meta.dirname, "src/api"),
      "@components": path.resolve(import.meta.dirname, "src/components"),
      "@contexts": path.resolve(import.meta.dirname, "src/contexts"),
      "@data": path.resolve(import.meta.dirname, "src/data"),
      "@domain": path.resolve(import.meta.dirname, "src/domain"),
      "@hooks": path.resolve(import.meta.dirname, "src/hooks"),
      "@platform": path.resolve(import.meta.dirname, "src/platform"),
      "@state": path.resolve(import.meta.dirname, "src/state"),
      "@utils": path.resolve(import.meta.dirname, "src/utils"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // Only run integration tests
    include: [
      "**/*.integration.test.{ts,tsx}",
      "**/__tests__/**/*.integration.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "**/*.d.ts",
        "**/vite-env.d.ts",
        "dist/**",
      ],
    },
  },
});
