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
import { tauriPlatform } from './tauri';
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
  FileFilter,
  OpenDialogOptions,
  SaveDialogOptions,
} from './types';

/**
 * Detect which platform we're running on.
 */
export function detectPlatform(): PlatformName {
  if (typeof window === 'undefined') {
    return 'web';
  }

  // Tauri always defines __TAURI_INTERNALS__ (the bridge behind invoke).
  // __TAURI__ only exists with withGlobalTauri, which is off in tauri.conf,
  // so checking it alone would misdetect Tauri as the web build.
  if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) {
    return 'tauri';
  }

  return 'web';
}

/**
 * Get the platform adapter for the detected platform.
 */
export function getPlatformAdapter(name: PlatformName): PlatformAdapter {
  switch (name) {
    case 'tauri':
      return tauriPlatform;
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
