import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
// @ts-ignore - CJS module in ESM context
import monacoEditorPlugin from "vite-plugin-monaco-editor";

// Check if we should skip Electron launch (no display or explicitly disabled)
const noElectron = process.env.NO_ELECTRON === '1' || process.env.NO_ELECTRON === 'true';
const hasDisplay = !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
const shouldLaunchElectron = !noElectron && hasDisplay;

if (!shouldLaunchElectron) {
  console.log('[vite] Running in web-only mode (no display available)');
  console.log('[vite] Access Studio at http://localhost:25810');
}

export default defineConfig({
  resolve: {
    alias: {
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
  plugins: [
    react(),
    // @ts-ignore - CJS module interop issue
    (monacoEditorPlugin.default || monacoEditorPlugin)({
      languageWorkers: ['editorWorkerService', 'typescript', 'json'],
    }),
    electron([
      {
        entry: "electron/main.ts",
        onstart(options) {
          if (!shouldLaunchElectron) {
            return;  // Skip - already logged at startup
          }

          if (options.startup) {
            // Pass Ozone platform flags for proper Wayland support
            // This enables DevTools and other Chromium features on Wayland
            options.startup([
              '.',
              '--',
              '--enable-features=UseOzonePlatform,WaylandWindowDecorations',
              '--ozone-platform-hint=auto',
            ]);
          }
        },
        vite: {
          build: {
            minify: false,
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
      {
        entry: "electron/preload.ts",
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            minify: false,
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
              output: {
                format: "cjs",
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  server: {
    port: 25810,
  },
  build: {
    outDir: "dist",
  },
});
