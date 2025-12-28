/**
 * Platform Abstraction Layer
 * 
 * Provides a unified interface for platform-specific functionality.
 * Automatically detects and loads the appropriate platform adapter.
 * 
 * Usage:
 *   import { platform } from '@platform';
 *   
 *   // Access platform capabilities
 *   if (platform.capabilities.secureStorage) {
 *     const connections = await platform.credentials.list();
 *   }
 *   
 *   // File operations
 *   const filePath = await platform.files.showOpenDialog({ ... });
 *   
 *   // Settings
 *   const settings = await platform.settings.getSettings();
 */

import type { PlatformAdapter, PlatformName } from './types';
import { electronPlatform } from './electron';
import { webPlatform } from './web';

// Re-export types for convenience
export type {
  PlatformAdapter,
  PlatformName,
  PlatformCapabilities,
  FileOperations,
  SettingsOperations,
  AuthOperations,
  CredentialOperations,
  MenuOperations,
  FileFilter,
  OpenDialogOptions,
  SaveDialogOptions,
  MenuAction,
} from './types';

/**
 * Detect which platform we're running on.
 */
function detectPlatform(): PlatformName {
  // Check for Electron
  if (typeof window !== 'undefined' && window.electronAPI) {
    return 'electron';
  }
  
  // Future: Check for Tauri
  // if (typeof window !== 'undefined' && window.__TAURI__) {
  //   return 'tauri';
  // }
  
  // Default to web
  return 'web';
}

/**
 * Get the platform adapter for the detected platform.
 */
function getPlatformAdapter(name: PlatformName): PlatformAdapter {
  switch (name) {
    case 'electron':
      return electronPlatform;
    // case 'tauri':
    //   return tauriPlatform;
    case 'web':
    default:
      return webPlatform;
  }
}

// Detect platform and create adapter
const detectedPlatform = detectPlatform();

/**
 * The active platform adapter.
 * Use this to access platform-specific functionality.
 */
export const platform: PlatformAdapter = getPlatformAdapter(detectedPlatform);

/**
 * Initialize the platform.
 * Should be called once at app startup before using any platform features.
 */
export async function initializePlatform(): Promise<void> {
  await platform.initialize();
  console.info(`[Platform] Initialized: ${platform.name}`);
  console.info(`[Platform] Capabilities:`, platform.capabilities);
}

/**
 * Check if running in desktop mode (Electron or Tauri).
 */
export function isDesktop(): boolean {
  return platform.name === 'electron' || platform.name === 'tauri';
}

/**
 * Check if running in browser mode.
 */
export function isBrowser(): boolean {
  return platform.name === 'web';
}

/**
 * Check if secure credential storage is available.
 */
export function hasSecureStorage(): boolean {
  return platform.capabilities.secureStorage;
}

/**
 * Check if native file dialogs are available.
 */
export function hasNativeDialogs(): boolean {
  return platform.capabilities.nativeDialogs;
}
