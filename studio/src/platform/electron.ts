/**
 * Electron Platform Adapter
 * 
 * Wraps the existing window.electronAPI to implement PlatformAdapter interface.
 * This is a thin wrapper that preserves all existing functionality.
 */

import type {
  PlatformAdapter,
  PlatformCapabilities,
  FileOperations,
  SettingsOperations,
  AuthOperations,
  CredentialOperations,
  MenuOperations,
  OpenDialogOptions,
  SaveDialogOptions,
  MenuAction,
} from './types';
import type { AppSettings } from '../types/settings';
import type {
  ConnectionInfo,
  CreateConnectionInput,
  UpdateConnectionInput,
  ResolvedConnection,
  ConnectionTestResult,
  DatabaseType,
} from '../types/connections';
import { DEFAULT_SETTINGS, mergeWithDefaults } from '../types/settings';

// =============================================================================
// File Operations Implementation
// =============================================================================

const electronFileOps: FileOperations = {
  async readFile(filePath: string): Promise<string> {
    if (!window.electronAPI?.readFile) {
      throw new Error('File reading not available in this environment');
    }
    return window.electronAPI.readFile(filePath);
  },

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!window.electronAPI?.saveFile) {
      throw new Error('File writing not available in this environment');
    }
    await window.electronAPI.saveFile(content, filePath);
  },

  async showOpenDialog(options?: OpenDialogOptions): Promise<string | null> {
    if (!window.electronAPI?.showOpenDialog) {
      return null;
    }
    return window.electronAPI.showOpenDialog(options);
  },

  async showSaveDialog(options?: SaveDialogOptions): Promise<string | null> {
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
      // Fallback to localStorage
      const stored = localStorage.getItem('application-settings');
      if (stored) {
        try {
          return mergeWithDefaults(JSON.parse(stored));
        } catch {
          return DEFAULT_SETTINGS;
        }
      }
      return DEFAULT_SETTINGS;
    }
    return window.electronAPI.getSettings();
  },

  async setSettings(settings: AppSettings): Promise<void> {
    if (!window.electronAPI?.setSettings) {
      // Fallback to localStorage
      localStorage.setItem('application-settings', JSON.stringify(settings));
      return;
    }
    await window.electronAPI.setSettings(settings);
  },
};

// =============================================================================
// Auth Operations Implementation
// =============================================================================

let cachedSessionToken: string | null = null;

const electronAuthOps: AuthOperations = {
  async getSessionToken(): Promise<string | null> {
    // Return cached token if available
    if (cachedSessionToken) {
      return cachedSessionToken;
    }

    // Try Electron IPC first
    if (window.electronAPI?.getSessionToken) {
      cachedSessionToken = await window.electronAPI.getSessionToken();
      if (cachedSessionToken) {
        return cachedSessionToken;
      }
    }

    // Fallback to localStorage
    cachedSessionToken = localStorage.getItem('api-token');
    return cachedSessionToken;
  },

  setSessionToken(token: string | null): void {
    cachedSessionToken = token;
    if (token) {
      localStorage.setItem('api-token', token);
    } else {
      localStorage.removeItem('api-token');
    }
  },
};

// =============================================================================
// Credential Operations Implementation
// =============================================================================

const electronCredentialOps: CredentialOperations = {
  async isAvailable(): Promise<boolean> {
    if (!window.electronAPI?.isEncryptionAvailable) {
      return false;
    }
    return window.electronAPI.isEncryptionAvailable();
  },

  async list(): Promise<ConnectionInfo[]> {
    if (!window.electronAPI?.listConnections) {
      return [];
    }
    return window.electronAPI.listConnections();
  },

  async listByType(type: DatabaseType): Promise<ConnectionInfo[]> {
    if (!window.electronAPI?.listConnectionsByType) {
      return [];
    }
    return window.electronAPI.listConnectionsByType(type);
  },

  async get(id: string): Promise<ConnectionInfo | null> {
    if (!window.electronAPI?.getConnection) {
      return null;
    }
    return window.electronAPI.getConnection(id);
  },

  async create(input: CreateConnectionInput): Promise<ConnectionInfo> {
    if (!window.electronAPI?.createConnection) {
      throw new Error('Credential storage not available in this environment');
    }
    return window.electronAPI.createConnection(input);
  },

  async update(id: string, input: UpdateConnectionInput): Promise<ConnectionInfo> {
    if (!window.electronAPI?.updateConnection) {
      throw new Error('Credential storage not available in this environment');
    }
    return window.electronAPI.updateConnection(id, input);
  },

  async delete(id: string): Promise<void> {
    if (!window.electronAPI?.deleteConnection) {
      throw new Error('Credential storage not available in this environment');
    }
    await window.electronAPI.deleteConnection(id);
  },

  async resolve(id: string): Promise<ResolvedConnection | null> {
    if (!window.electronAPI?.resolveConnection) {
      return null;
    }
    return window.electronAPI.resolveConnection(id);
  },

  async test(id: string): Promise<ConnectionTestResult> {
    if (!window.electronAPI?.testConnection) {
      return { success: false, message: 'Connection testing not available in this environment' };
    }
    return window.electronAPI.testConnection(id);
  },
};

// =============================================================================
// Menu Operations Implementation
// =============================================================================

const electronMenuOps: MenuOperations = {
  onMenuAction(callback: (action: MenuAction, data?: unknown) => void): (() => void) | undefined {
    if (!window.electronAPI?.onMenuAction) {
      return undefined;
    }
    const result = window.electronAPI.onMenuAction(callback as (action: string, data?: unknown) => void);
    // Electron API may return void or a cleanup function
    return typeof result === 'function' ? result : undefined;
  },
};

// =============================================================================
// Platform Adapter
// =============================================================================

const electronCapabilities: PlatformCapabilities = {
  secureStorage: true,
  nativeDialogs: true,
  backendManagement: true,
  nativeMenus: true,
};

export const electronPlatform: PlatformAdapter = {
  name: 'electron',
  capabilities: electronCapabilities,
  files: electronFileOps,
  settings: electronSettingsOps,
  auth: electronAuthOps,
  credentials: electronCredentialOps,
  menu: electronMenuOps,

  async initialize(): Promise<void> {
    // Pre-fetch session token during initialization
    await electronAuthOps.getSessionToken();
    
    // Check if we're actually running in Electron
    if (!window.electronAPI) {
      console.warn('[Platform] Electron API not available, some features will be limited');
      // Update capabilities to reflect actual state
      electronCapabilities.secureStorage = false;
      electronCapabilities.nativeDialogs = false;
      electronCapabilities.backendManagement = false;
      electronCapabilities.nativeMenus = false;
    } else {
      // Check encryption availability
      const encryptionAvailable = await electronCredentialOps.isAvailable();
      electronCapabilities.secureStorage = encryptionAvailable;
    }
  },
};
