/**
 * Web Platform Adapter
 * 
 * Fallback platform for browser-only mode with limited functionality.
 * Uses localStorage for settings, and provides file operations via browser APIs.
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
import { DEFAULT_SETTINGS } from '../types/settings';

// =============================================================================
// File Operations Implementation (Browser)
// =============================================================================

const webFileOps: FileOperations = {
  async readFile(_filePath: string): Promise<string> {
    // Browser cannot read arbitrary files by path
    throw new Error('Direct file reading not available in browser mode. Use file input instead.');
  },

  async writeFile(_filePath: string, _content: string): Promise<void> {
    // Browser cannot write to arbitrary paths
    throw new Error('Direct file writing not available in browser mode. Use download instead.');
  },

  async showOpenDialog(_options?: OpenDialogOptions): Promise<string | null> {
    // Browser uses file input, not dialogs
    // This method returns null; consumers should use the browser file input fallback
    return null;
  },

  async showSaveDialog(_options?: SaveDialogOptions): Promise<string | null> {
    // Browser uses download links, not dialogs
    // This method returns null; consumers should use the browser download fallback
    return null;
  },
};

// =============================================================================
// Settings Operations Implementation (Browser)
// =============================================================================

const SETTINGS_KEY = 'sigilweaver-settings';

const webSettingsOps: SettingsOperations = {
  async getSettings(): Promise<AppSettings> {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        console.error('Failed to parse settings from localStorage');
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  },

  async setSettings(settings: AppSettings): Promise<void> {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
};

// =============================================================================
// Auth Operations Implementation (Browser)
// =============================================================================

const TOKEN_KEY = 'sigilweaver-api-token';
let cachedSessionToken: string | null = null;

const webAuthOps: AuthOperations = {
  async getSessionToken(): Promise<string | null> {
    if (cachedSessionToken) {
      return cachedSessionToken;
    }
    cachedSessionToken = localStorage.getItem(TOKEN_KEY);
    return cachedSessionToken;
  },

  setSessionToken(token: string | null): void {
    cachedSessionToken = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },
};

// =============================================================================
// Credential Operations Implementation (Browser - Limited)
// =============================================================================

/**
 * Browser mode does NOT support secure credential storage.
 * Users should use server-managed connections instead.
 */
const webCredentialOps: CredentialOperations = {
  async isAvailable(): Promise<boolean> {
    // Secure storage not available in browser
    return false;
  },

  async list(): Promise<ConnectionInfo[]> {
    // No client connections in browser mode
    return [];
  },

  async listByType(_type: DatabaseType): Promise<ConnectionInfo[]> {
    return [];
  },

  async get(_id: string): Promise<ConnectionInfo | null> {
    return null;
  },

  async create(_input: CreateConnectionInput): Promise<ConnectionInfo> {
    throw new Error(
      'Client credential storage not available in browser mode. ' +
      'Please use server-managed connections or run the desktop application.'
    );
  },

  async update(_id: string, _input: UpdateConnectionInput): Promise<ConnectionInfo> {
    throw new Error('Client credential storage not available in browser mode.');
  },

  async delete(_id: string): Promise<void> {
    throw new Error('Client credential storage not available in browser mode.');
  },

  async resolve(_id: string): Promise<ResolvedConnection | null> {
    // Cannot resolve client connections in browser mode
    return null;
  },

  async test(_id: string): Promise<ConnectionTestResult> {
    return {
      success: false,
      message: 'Client connection testing not available in browser mode.',
    };
  },
};

// =============================================================================
// Menu Operations Implementation (Browser - No-op)
// =============================================================================

const webMenuOps: MenuOperations = {
  onMenuAction(_callback: (action: MenuAction, data?: unknown) => void): (() => void) | undefined {
    // No native menus in browser mode
    // The app should provide UI-based alternatives
    return undefined;
  },
};

// =============================================================================
// Platform Adapter
// =============================================================================

const webCapabilities: PlatformCapabilities = {
  secureStorage: false,
  nativeDialogs: false,
  backendManagement: false,
  nativeMenus: false,
};

export const webPlatform: PlatformAdapter = {
  name: 'web',
  capabilities: webCapabilities,
  files: webFileOps,
  settings: webSettingsOps,
  auth: webAuthOps,
  credentials: webCredentialOps,
  menu: webMenuOps,

  async initialize(): Promise<void> {
    // Pre-fetch session token
    await webAuthOps.getSessionToken();
    console.info('[Platform] Running in browser mode - some features will be limited');
  },
};
