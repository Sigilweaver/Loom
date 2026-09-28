/**
 * Pure URL policy helpers for the Electron main process.
 * Kept free of Electron imports so they can be unit tested.
 */

import { pathToFileURL } from "node:url";

/** Origin of the Vite dev server used in development. */
export const DEV_SERVER_ORIGIN = "http://localhost:25810";

/** Only these schemes may be handed to the operating system's URL handler. */
const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Whether a URL is safe to pass to `shell.openExternal`. Anything else
 * (file:, smb:, ms-msdt:, custom protocol handlers) can run local code or
 * leak credentials, so it is refused.
 */
export function isSafeExternalUrl(raw: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(raw).protocol);
  } catch {
    return false;
  }
}

export interface AppUrlPolicy {
  isDev: boolean;
  /** Absolute path of the built renderer directory (`dist`). */
  distDir: string;
}

/**
 * Whether a URL belongs to the app itself: the dev server in development, or
 * a file inside the packaged renderer directory in production. Used for
 * navigation checks and to verify the sender of privileged IPC calls.
 */
export function isAppUrl(raw: string, policy: AppUrlPolicy): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (policy.isDev) {
    return parsed.origin === DEV_SERVER_ORIGIN;
  }
  if (parsed.protocol !== "file:") return false;
  const base = pathToFileURL(policy.distDir).href.replace(/\/?$/, "/");
  return parsed.href.startsWith(base);
}

/**
 * Content Security Policy applied to the packaged renderer. Mirrors the
 * policy the Tauri shell ships in `tauri.conf.json`, adapted for file://.
 */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* https: ws://localhost:* ws://127.0.0.1:* wss:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
