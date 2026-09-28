/**
 * Electron Platform Adapter
 *
 * Wraps window.electronAPI (exposed by electron/preload.ts) to implement the
 * PlatformAdapter interface. File access is restricted by the main process to
 * paths the user chose in a native dialog; see electron/fileAccess.ts.
 */

import type {
  PlatformAdapter,
  PlatformCapabilities,
  FileOperations,
  SettingsOperations,
  CredentialOperations,
} from './types';
import type { AppSettings } from '../types/settings';
import { mergeWithDefaults } from '../types/settings';
import {
  createAuthOps,
  loadSettingsFromLocalStorage,
  noopMenuOps,
  responseFromProxy,
  saveSettingsToLocalStorage,
  toProxyRequest,
} from './shared';

// =============================================================================
// File Operations Implementation
// =============================================================================

const electronFileOps: FileOperations = {
  async readFile(filePath) {
    if (!window.electronAPI?.readFile) {
      throw new Error('File reading not available in this environment');
    }
    return window.electronAPI.readFile(filePath);
  },

  async writeFile(filePath, content) {
    if (!window.electronAPI?.saveFile) {
      throw new Error('File writing not available in this environment');
    }
    await window.electronAPI.saveFile(content, filePath);
  },

  async showOpenDialog(options) {
    if (!window.electronAPI?.showOpenDialog) {
      return null;
    }
    return window.electronAPI.showOpenDialog(options);
  },

  async showSaveDialog(options) {
    if (!window.electronAPI?.showSaveDialog) {
      return null;
    }
    return window.electronAPI.showSaveDialog(options);
  },
};

// =============================================================================
// Settings Operations Implementation
// =============================================================================

const electronSettingsOps: SettingsOperations = {
  async getSettings(): Promise<AppSettings> {
    if (!window.electronAPI?.getSettings) {
      return loadSettingsFromLocalStorage();
    }
    // The main process stores whatever the renderer last saved, which may
    // predate newly added fields. Fill them in so nested objects are complete.
    const stored = await window.electronAPI.getSettings();
    return mergeWithDefaults(stored as unknown as Record<string, unknown>);
  },

  async setSettings(settings) {
    if (!window.electronAPI?.setSettings) {
      saveSettingsToLocalStorage(settings);
      return;
    }
    await window.electronAPI.setSettings(settings);
  },
};

// =============================================================================
// Auth Operations Implementation
// =============================================================================

const electronAuthOps = createAuthOps({
  fromShell: async () =>
    window.electronAPI?.getSessionToken ? window.electronAPI.getSessionToken() : null,
  persist: true,
});

// =============================================================================
// Credential Operations Implementation
// =============================================================================

const electronCredentialOps: CredentialOperations = {
  async isAvailable() {
    if (!window.electronAPI?.isEncryptionAvailable) {
      return false;
    }
    return window.electronAPI.isEncryptionAvailable();
  },

  async list() {
    if (!window.electronAPI?.listConnections) {
      return [];
    }
    return window.electronAPI.listConnections();
  },

  async get(id) {
    if (!window.electronAPI?.getConnection) {
      return null;
    }
    return window.electronAPI.getConnection(id);
  },

  async create(input) {
    if (!window.electronAPI?.createConnection) {
      throw new Error('Credential storage not available in this environment');
    }
    return window.electronAPI.createConnection(input);
  },

  async update(id, input) {
    if (!window.electronAPI?.updateConnection) {
      throw new Error('Credential storage not available in this environment');
    }
    return window.electronAPI.updateConnection(id, input);
  },

  async delete(id) {
    if (!window.electronAPI?.deleteConnection) {
      throw new Error('Credential storage not available in this environment');
    }
    await window.electronAPI.deleteConnection(id);
  },

  async resolve(id) {
    if (!window.electronAPI?.resolveConnection) {
      return null;
    }
    return window.electronAPI.resolveConnection(id);
  },

  async fetch(url, init) {
    if (!window.electronAPI?.backendRequest) {
      throw new Error('Credential proxy not available in this environment');
    }
    return responseFromProxy(await window.electronAPI.backendRequest(toProxyRequest(url, init)));
  },

  async test(id) {
    if (!window.electronAPI?.testConnection) {
      return { success: false, message: 'Connection testing not available in this environment' };
    }
    return window.electronAPI.testConnection(id);
  },
};

// =============================================================================
// Platform Adapter
// =============================================================================

const electronCapabilities: PlatformCapabilities = {
  secureStorage: true,
  nativeDialogs: true,
  credentialProxy: false,
};

export const electronPlatform: PlatformAdapter = {
  name: 'electron',
  capabilities: electronCapabilities,
  files: electronFileOps,
  settings: electronSettingsOps,
  auth: electronAuthOps,
  credentials: electronCredentialOps,
  menu: noopMenuOps,

  async initialize(): Promise<void> {
    // Pre-fetch session token during initialization
    await electronAuthOps.getSessionToken();

    if (!window.electronAPI) {
      console.warn('[Platform] Electron API not available, some features will be limited');
      electronCapabilities.secureStorage = false;
      electronCapabilities.nativeDialogs = false;
      electronCapabilities.credentialProxy = false;
      return;
    }

    electronCapabilities.secureStorage = await electronCredentialOps.isAvailable();
    electronCapabilities.credentialProxy = window.electronAPI.connectionProxyAvailable
      ? await window.electronAPI.connectionProxyAvailable()
      : false;
  },
};
