/**
 * Logic shared by the platform adapters.
 *
 * The Electron, Tauri and web adapters used to carry near-identical copies of
 * the localStorage settings fallback, the session-token cache and the
 * proxy-response decoding. They live here so each adapter only contains what
 * is genuinely specific to its bridge.
 */

import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS, mergeWithDefaults } from '../types/settings';
import type { AuthOperations, MenuOperations, SettingsOperations } from './types';

export const SETTINGS_KEY = 'application-settings';
export const TOKEN_KEY = 'api-token';

/** localStorage access that never throws (private windows, blocked storage). */
export const safeLocalStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable; the value simply is not persisted.
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage unavailable.
    }
  },
};

/** Settings persisted in localStorage (web mode, and desktop fallback). */
export function loadSettingsFromLocalStorage(): AppSettings {
  const stored = safeLocalStorage.get(SETTINGS_KEY);
  if (!stored) return DEFAULT_SETTINGS;
  try {
    return mergeWithDefaults(JSON.parse(stored));
  } catch {
    console.error('[Platform] Failed to parse settings from localStorage');
    return DEFAULT_SETTINGS;
  }
}

export function saveSettingsToLocalStorage(settings: AppSettings): void {
  safeLocalStorage.set(SETTINGS_KEY, JSON.stringify(settings));
}

/** SettingsOperations backed purely by localStorage. */
export function createLocalSettingsOps(): SettingsOperations {
  return {
    async getSettings() {
      return loadSettingsFromLocalStorage();
    },
    async setSettings(settings) {
      saveSettingsToLocalStorage(settings);
    },
  };
}

export interface AuthOptions {
  /** Ask the desktop shell for its ephemeral token. */
  fromShell?: () => Promise<string | null>;
  /** Also read and write the token in localStorage (browser mode). */
  persist: boolean;
}

/**
 * Session token cache. The shell token (desktop) wins; localStorage is the
 * fallback where `persist` is set. An unavailable or failing shell yields null
 * rather than an exception so startup never blocks on it.
 */
export function createAuthOps(options: AuthOptions): AuthOperations {
  let cached: string | null = null;

  return {
    async getSessionToken() {
      if (cached) return cached;

      if (options.fromShell) {
        try {
          cached = await options.fromShell();
        } catch (e) {
          console.error('[Platform] Failed to get session token:', e);
          cached = null;
        }
        if (cached) return cached;
      }

      if (options.persist) {
        cached = safeLocalStorage.get(TOKEN_KEY);
      }
      return cached;
    },

    setSessionToken(token) {
      cached = token;
      if (!options.persist) return;
      if (token) {
        safeLocalStorage.set(TOKEN_KEY, token);
      } else {
        safeLocalStorage.remove(TOKEN_KEY);
      }
    },
  };
}

/**
 * No shell currently emits native menu events (the Electron menu bar is
 * removed and Tauri has no native menu), so every adapter shares this no-op.
 */
export const noopMenuOps: MenuOperations = {
  onMenuAction(): (() => void) | undefined {
    return undefined;
  },
};

/** Wire format returned by a shell's credential proxy. */
export interface ProxyResponsePayload {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
}

/** Statuses for which the Response constructor forbids a body. */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/** Rebuild a fetch Response from a shell proxy payload. */
export function responseFromProxy(payload: ProxyResponsePayload): Response {
  const body = NULL_BODY_STATUSES.has(payload.status) ? null : payload.body;
  return new Response(body, {
    status: payload.status,
    statusText: payload.statusText,
    headers: payload.headers,
  });
}

/** The serialisable subset of a fetch request that shells forward. */
export interface ProxyRequestPayload {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Reduce a fetch call to what can cross the shell boundary. Only string
 * bodies are supported; the credential proxy exists for JSON API requests.
 */
export function toProxyRequest(url: string, init: RequestInit = {}): ProxyRequestPayload {
  if (init.body !== undefined && init.body !== null && typeof init.body !== 'string') {
    throw new Error('Credential proxy only supports string request bodies');
  }
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((value, name) => {
    headers[name] = value;
  });
  return {
    url,
    method: init.method ?? 'GET',
    headers,
    ...(typeof init.body === 'string' ? { body: init.body } : {}),
  };
}
