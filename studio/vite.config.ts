import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, PluginOption } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
// @ts-ignore - CJS module in ESM context
import monacoEditorPlugin from "vite-plugin-monaco-editor";

// Check if we're running in Tauri mode (tauri dev sets this)
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

// Check if we should skip Electron launch (no display or explicitly disabled)
// In Tauri mode, always skip Electron
const noElectron = isTauri || process.env.NO_ELECTRON === '1' || process.env.NO_ELECTRON === 'true';
const hasDisplay = !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
const shouldLaunchElectron = !noElectron && hasDisplay;

if (isTauri) {
  console.log('[vite] Running in Tauri mode');
} else if (!shouldLaunchElectron) {
  console.log('[vite] Running in web-only mode (no display available or NO_ELECTRON set)');
  console.log('[vite] Access Studio at http://localhost:25810');
}

// Electron plugins - only loaded when NOT in Tauri mode
function getElectronPlugins(): PluginOption[] {
  if (isTauri) {
    // Tauri mode - no Electron plugins needed
    return [];
  }

  return [
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
            // The package is "type": "module", so the plugin would emit the
            // preload as an ES module, which Electron cannot run as a
            // (sandboxed) preload script. Force CommonJS with a .cjs name;
            // main.ts loads "preload.cjs".
            lib: {
              entry: "electron/preload.ts",
              formats: ["cjs"],
              fileName: () => "preload.cjs",
            },
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
    ]),
    renderer(),
  ];
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
    ...getElectronPlugins(),
  ],
  server: {
    port: 25810,
    // Tauri needs the host to be available
    strictPort: true,
  },
  // Clear screen disabled for Tauri dev output visibility
  clearScreen: false,
  build: {
    outDir: "dist",
    // Tauri targets ES2021
    target: isTauri ? ['es2021', 'chrome100', 'safari13'] : undefined,
  },
  // Env prefix for Tauri
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
