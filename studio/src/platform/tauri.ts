/**
 * Tauri Platform Adapter
 *
 * Implements the PlatformAdapter interface on top of Tauri's invoke system.
 * Mirrors electron.ts; the commands live in studio/tauri/src/commands.
 *
 * Note on argument names: Tauri converts command parameter names from
 * snake_case in Rust to camelCase in JavaScript, so `db_type` is `dbType`.
 */

import type {
  PlatformAdapter,
  PlatformCapabilities,
  FileOperations,
  SettingsOperations,
  CredentialOperations,
} from './types';
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS, mergeWithDefaults } from '../types/settings';
import type {
  ConnectionInfo,
  ConnectionTestResult,
  ResolvedConnection,
} from '../types/connections';
import {
  createAuthOps,
  responseFromProxy,
  toProxyRequest,
  type ProxyResponsePayload,
} from './shared';

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

// The Tauri API is loaded lazily so non-Tauri builds never touch it.
let invoke: InvokeFn | null = null;

async function initTauriApi(): Promise<void> {
  if (invoke) return;

  try {
    const core = await import('@tauri-apps/api/core');
    invoke = core.invoke;
  } catch (e) {
    console.warn('[Platform/Tauri] Failed to load Tauri API:', e);
  }
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await initTauriApi();
  if (!invoke) {
    throw new Error('Tauri API not available');
  }
  return invoke(cmd, args) as Promise<T>;
}

// =============================================================================
// File Operations Implementation
// =============================================================================

const tauriFileOps: FileOperations = {
  async readFile(filePath) {
    return tauriInvoke<string>('read_file', { path: filePath });
  },

  async writeFile(filePath, content) {
    await tauriInvoke('write_file', { path: filePath, content });
  },

  async showOpenDialog(options) {
    return tauriInvoke<string | null>('show_open_dialog', {
      options: options
        ? {
            title: options.title,
            defaultPath: options.defaultPath,
            filters: options.filters,
          }
        : null,
    });
  },

  async showSaveDialog(options) {
    return tauriInvoke<string | null>('show_save_dialog', {
      options: options
        ? {
            title: options.title,
            defaultPath: options.defaultPath,
            filters: options.filters,
          }
        : null,
    });
  },
};

// =============================================================================
// Settings Operations Implementation
// =============================================================================

const tauriSettingsOps: SettingsOperations = {
  async getSettings(): Promise<AppSettings> {
    try {
      // The shell stores the settings object verbatim (null before first
      // save); defaults for any missing fields are filled in here.
      const stored = await tauriInvoke<Record<string, unknown> | null>('get_settings');
      return stored ? mergeWithDefaults(stored) : DEFAULT_SETTINGS;
    } catch (e) {
      console.error('[Platform/Tauri] Failed to get settings:', e);
      return DEFAULT_SETTINGS;
    }
  },

  async setSettings(settings) {
    await tauriInvoke('set_settings', { settings });
  },
};

// =============================================================================
// Auth Operations Implementation
// =============================================================================

// Tauri manages the token in Rust; setSessionToken only updates the cache.
const tauriAuthOps = createAuthOps({
  fromShell: () => tauriInvoke<string | null>('get_session_token'),
  persist: false,
});

// =============================================================================
// Credential Operations Implementation
// =============================================================================

const tauriCredentialOps: CredentialOperations = {
  async isAvailable() {
    try {
      return await tauriInvoke<boolean>('is_encryption_available');
    } catch {
      return false;
    }
  },

  async list() {
    return tauriInvoke<ConnectionInfo[]>('list_connections');
  },

  async get(id) {
    return tauriInvoke<ConnectionInfo | null>('get_connection', { id });
  },

  async create(input) {
    return tauriInvoke<ConnectionInfo>('create_connection', { input });
  },

  async update(id, input) {
    return tauriInvoke<ConnectionInfo>('update_connection', { id, input });
  },

  async delete(id) {
    await tauriInvoke('delete_connection', { id });
  },

  async resolve(id) {
    return tauriInvoke<ResolvedConnection | null>('resolve_connection', { id });
  },

  async fetch(url, init) {
    const payload = await tauriInvoke<ProxyResponsePayload>('backend_request', {
      request: toProxyRequest(url, init),
    });
    return responseFromProxy(payload);
  },

  async test(id) {
    return tauriInvoke<ConnectionTestResult>('test_connection', { id });
  },
};

// =============================================================================
// Platform Adapter
// =============================================================================

const tauriCapabilities: PlatformCapabilities = {
  secureStorage: true,
  nativeDialogs: true,
  credentialProxy: false,
};

export const tauriPlatform: PlatformAdapter = {
  name: 'tauri',
  capabilities: tauriCapabilities,
  files: tauriFileOps,
  settings: tauriSettingsOps,
  auth: tauriAuthOps,
  credentials: tauriCredentialOps,

  async initialize(): Promise<void> {
    await initTauriApi();

    if (!invoke) {
      console.warn('[Platform/Tauri] Tauri API not available, some features will be limited');
      tauriCapabilities.secureStorage = false;
      tauriCapabilities.nativeDialogs = false;
      tauriCapabilities.credentialProxy = false;
      return;
    }

    // Pre-fetch session token
    await tauriAuthOps.getSessionToken();

    tauriCapabilities.secureStorage = await tauriCredentialOps.isAvailable();
    try {
      tauriCapabilities.credentialProxy = await tauriInvoke<boolean>('connection_proxy_available');
    } catch {
      tauriCapabilities.credentialProxy = false;
    }

    console.info('[Platform/Tauri] Initialized successfully');
  },
};
