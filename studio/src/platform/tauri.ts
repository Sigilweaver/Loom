/**
 * Tauri Platform Adapter
 * 
 * Implements PlatformAdapter interface using Tauri's invoke system.
 * Mirrors functionality of electron.ts but uses Rust commands via @tauri-apps/api.
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

// Tauri API imports - these are only available when running in Tauri
// We use dynamic imports to avoid errors in non-Tauri environments
let invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

// Initialize Tauri API
async function initTauriApi(): Promise<void> {
    if (invoke) return;

    try {
        const core = await import('@tauri-apps/api/core');
        invoke = core.invoke;
    } catch (e) {
        console.warn('[Platform/Tauri] Failed to load Tauri API:', e);
    }
}

// Helper to safely invoke Tauri commands
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
    async readFile(filePath: string): Promise<string> {
        return tauriInvoke<string>('read_file', { path: filePath });
    },

    async writeFile(filePath: string, content: string): Promise<void> {
        await tauriInvoke('write_file', { path: filePath, content });
    },

    async showOpenDialog(options?: OpenDialogOptions): Promise<string | null> {
        const result = await tauriInvoke<string | null>('show_open_dialog', {
            options: options ? {
                title: options.title,
                defaultPath: options.defaultPath,
                filters: options.filters,
                directory: options.properties?.includes('openDirectory'),
                multiple: options.properties?.includes('multiSelections'),
            } : null
        });
        return result;
    },

    async showSaveDialog(options?: SaveDialogOptions): Promise<string | null> {
        const result = await tauriInvoke<string | null>('show_save_dialog', {
            options: options ? {
                title: options.title,
                defaultPath: options.defaultPath,
                filters: options.filters,
            } : null
        });
        return result;
    },
};

// =============================================================================
// Settings Operations Implementation
// =============================================================================

const tauriSettingsOps: SettingsOperations = {
    async getSettings(): Promise<AppSettings> {
        try {
            const settings = await tauriInvoke<AppSettings>('get_settings');
            return mergeWithDefaults(settings as Record<string, unknown>);
        } catch (e) {
            console.error('[Platform/Tauri] Failed to get settings:', e);
            return DEFAULT_SETTINGS;
        }
    },

    async setSettings(settings: AppSettings): Promise<void> {
        await tauriInvoke('set_settings', { settings });
    },
};

// =============================================================================
// Auth Operations Implementation
// =============================================================================

let cachedSessionToken: string | null = null;

const tauriAuthOps: AuthOperations = {
    async getSessionToken(): Promise<string | null> {
        if (cachedSessionToken) {
            return cachedSessionToken;
        }
        try {
            cachedSessionToken = await tauriInvoke<string | null>('get_session_token');
            return cachedSessionToken;
        } catch (e) {
            console.error('[Platform/Tauri] Failed to get session token:', e);
            return null;
        }
    },

    setSessionToken(token: string | null): void {
        cachedSessionToken = token;
        // Tauri manages the token server-side, this is just for local caching
    },
};

// =============================================================================
// Credential Operations Implementation
// =============================================================================

const tauriCredentialOps: CredentialOperations = {
    async isAvailable(): Promise<boolean> {
        try {
            return await tauriInvoke<boolean>('is_encryption_available');
        } catch {
            return false;
        }
    },

    async list(): Promise<ConnectionInfo[]> {
        return tauriInvoke<ConnectionInfo[]>('list_connections');
    },

    async listByType(type: DatabaseType): Promise<ConnectionInfo[]> {
        return tauriInvoke<ConnectionInfo[]>('list_connections_by_type', { db_type: type });
    },

    async get(id: string): Promise<ConnectionInfo | null> {
        return tauriInvoke<ConnectionInfo | null>('get_connection', { id });
    },

    async create(input: CreateConnectionInput): Promise<ConnectionInfo> {
        return tauriInvoke<ConnectionInfo>('create_connection', { input });
    },

    async update(id: string, input: UpdateConnectionInput): Promise<ConnectionInfo> {
        return tauriInvoke<ConnectionInfo>('update_connection', { id, input });
    },

    async delete(id: string): Promise<void> {
        await tauriInvoke('delete_connection', { id });
    },

    async resolve(id: string): Promise<ResolvedConnection | null> {
        return tauriInvoke<ResolvedConnection | null>('resolve_connection', { id });
    },

    async test(id: string): Promise<ConnectionTestResult> {
        return tauriInvoke<ConnectionTestResult>('test_connection', { id });
    },
};

// =============================================================================
// Menu Operations Implementation
// =============================================================================

const tauriMenuOps: MenuOperations = {
    onMenuAction(_callback: (action: MenuAction, data?: unknown) => void): (() => void) | undefined {
        // Tauri menu events would be handled via tauri::Menu and event listeners
        // For now, we rely on the web UI for menu actions (same as web platform)
        // Full native menu integration can be added later
        return undefined;
    },
};

// =============================================================================
// Platform Adapter
// =============================================================================

const tauriCapabilities: PlatformCapabilities = {
    secureStorage: true,
    nativeDialogs: true,
    backendManagement: true,
    nativeMenus: false, // Can be enabled when native menu is implemented
};

export const tauriPlatform: PlatformAdapter = {
    name: 'tauri',
    capabilities: tauriCapabilities,
    files: tauriFileOps,
    settings: tauriSettingsOps,
    auth: tauriAuthOps,
    credentials: tauriCredentialOps,
    menu: tauriMenuOps,

    async initialize(): Promise<void> {
        // Initialize Tauri API
        await initTauriApi();

        if (!invoke) {
            console.warn('[Platform/Tauri] Tauri API not available, some features will be limited');
            tauriCapabilities.secureStorage = false;
            tauriCapabilities.nativeDialogs = false;
            tauriCapabilities.backendManagement = false;
            return;
        }

        // Pre-fetch session token
        await tauriAuthOps.getSessionToken();

        // Check encryption availability
        const encryptionAvailable = await tauriCredentialOps.isAvailable();
        tauriCapabilities.secureStorage = encryptionAvailable;

        console.info('[Platform/Tauri] Initialized successfully');
    },
};
