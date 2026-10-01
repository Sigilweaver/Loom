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
  CredentialOperations,
} from './types';
import { createAuthOps, createLocalSettingsOps } from './shared';

// =============================================================================
// File Operations Implementation (Browser)
// =============================================================================

const webFileOps: FileOperations = {
  async readFile(): Promise<string> {
    // Browser cannot read arbitrary files by path
    throw new Error('Direct file reading not available in browser mode. Use file input instead.');
  },

  async writeFile(): Promise<void> {
    // Browser cannot write to arbitrary paths
    throw new Error('Direct file writing not available in browser mode. Use download instead.');
  },

  async showOpenDialog(): Promise<string | null> {
    // Browser uses file input, not dialogs; consumers fall back to <input type="file">.
    return null;
  },

  async showSaveDialog(): Promise<string | null> {
    // Browser uses download links, not dialogs; consumers fall back to a download.
    return null;
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
  async isAvailable() {
    return false;
  },

  async list() {
    return [];
  },

  async get() {
    return null;
  },

  async create() {
    throw new Error(
      'Client credential storage not available in browser mode. ' +
      'Please use server-managed connections or run the desktop application.'
    );
  },

  async update() {
    throw new Error('Client credential storage not available in browser mode.');
  },

  async delete() {
    throw new Error('Client credential storage not available in browser mode.');
  },

  async resolve() {
    // Cannot resolve client connections in browser mode
    return null;
  },

  async fetch() {
    throw new Error('Client connections are not available in browser mode.');
  },

  async test() {
    return {
      success: false,
      message: 'Client connection testing not available in browser mode.',
    };
  },
};

// =============================================================================
// Platform Adapter
// =============================================================================

const webCapabilities: PlatformCapabilities = {
  secureStorage: false,
  nativeDialogs: false,
  credentialProxy: false,
};

const webAuthOps = createAuthOps({ persist: true });

export const webPlatform: PlatformAdapter = {
  name: 'web',
  capabilities: webCapabilities,
  files: webFileOps,
  settings: createLocalSettingsOps(),
  auth: webAuthOps,
  credentials: webCredentialOps,

  async initialize(): Promise<void> {
    // Pre-fetch session token
    await webAuthOps.getSessionToken();
    console.info('[Platform] Running in browser mode - some features will be limited');
  },
};
