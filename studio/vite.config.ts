import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
// @ts-ignore - CJS module in ESM context
import monacoEditorPlugin from "vite-plugin-monaco-editor";

// `tauri dev` and `tauri build` set TAURI_ENV_PLATFORM for the frontend build.
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
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
  plugins: [
    react(),
    // @ts-ignore - CJS module interop issue
    (monacoEditorPlugin.default || monacoEditorPlugin)({
      languageWorkers: ['editorWorkerService', 'typescript', 'json'],
    }),
  ],
  server: {
    port: 25810,
    // The Tauri devUrl points at this port, so it must not move
    strictPort: true,
  },
  // Keep Tauri CLI output visible
  clearScreen: false,
  build: {
    outDir: "dist",
    // Tauri targets ES2021
    target: isTauri ? ['es2021', 'chrome100', 'safari13'] : undefined,
  },
  // Env prefix for Tauri
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
