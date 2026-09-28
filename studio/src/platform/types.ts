/**
 * Platform Abstraction Types
 * 
 * Platform-agnostic interfaces for native functionality.
 * Implementations exist for Electron, Tauri, and Web (limited).
 */

import type { AppSettings } from '../types/settings';
import type {
  ConnectionInfo,
  CreateConnectionInput,
  UpdateConnectionInput,
  ResolvedConnection,
  ConnectionTestResult,
} from '../types/connections';

// =============================================================================
// File Operations
// =============================================================================

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[];
  message?: string;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  message?: string;
}

export interface FileOperations {
  /**
   * Read a text file.
   *
   * Desktop shells only honour paths the user chose in a native open or save
   * dialog during this session (returned by showOpenDialog/showSaveDialog);
   * any other path is rejected.
   * @param filePath Absolute path returned by a dialog
   * @returns File contents as a string
   */
  readFile(filePath: string): Promise<string>;

  /**
   * Write text to a file. Subject to the same dialog-granted path rule as
   * readFile. Rejects if the write fails.
   * @param filePath Absolute path returned by a dialog
   * @param content Content to write
   */
  writeFile(filePath: string, content: string): Promise<void>;

  /**
   * Show a native open file dialog.
   * @param options Dialog options
   * @returns Selected file path, or null if cancelled
   */
  showOpenDialog(options?: OpenDialogOptions): Promise<string | null>;

  /**
   * Show a native save file dialog.
   * @param options Dialog options
   * @returns Selected file path, or null if cancelled
   */
  showSaveDialog(options?: SaveDialogOptions): Promise<string | null>;
}

// =============================================================================
// Settings Operations
// =============================================================================

export interface SettingsOperations {
  /**
   * Load application settings from persistent storage.
   */
  getSettings(): Promise<AppSettings>;

  /**
   * Save application settings to persistent storage.
   */
  setSettings(settings: AppSettings): Promise<void>;
}

// =============================================================================
// Authentication Operations
// =============================================================================

export interface AuthOperations {
  /**
   * Get the current session token for backend authentication.
   * In desktop mode, this is an ephemeral token generated at app launch.
   * In browser mode, this may be stored in localStorage or null.
   */
  getSessionToken(): Promise<string | null>;

  /**
   * Set a session token (primarily for browser mode configuration).
   */
  setSessionToken(token: string | null): void;
}

// =============================================================================
// Credential Storage Operations
// =============================================================================

export interface CredentialOperations {
  /**
   * Check if secure credential storage is available.
   * Returns false in browser mode or if OS keychain is unavailable.
   */
  isAvailable(): Promise<boolean>;

  /**
   * List all stored connections (without credentials).
   */
  list(): Promise<ConnectionInfo[]>;

  /**
   * Get a single connection by ID (without credentials).
   */
  get(id: string): Promise<ConnectionInfo | null>;

  /**
   * Create a new connection with encrypted credentials.
   */
  create(input: CreateConnectionInput): Promise<ConnectionInfo>;

  /**
   * Update an existing connection.
   */
  update(id: string, input: UpdateConnectionInput): Promise<ConnectionInfo>;

  /**
   * Delete a connection and its credentials.
   */
  delete(id: string): Promise<void>;

  /**
   * Resolve a connection with decrypted credentials.
   *
   * @deprecated Hands plaintext credentials to the renderer. It is refused by
   * the desktop shell whenever `capabilities.credentialProxy` is true; in that
   * case put `connectionRef(id)` in the request body and send it with
   * `credentials.fetch` (or `backendFetch` from `@api`) so the shell injects
   * the credentials. It remains only for setups where the shell does not own
   * the server (Client build, development, remote server).
   */
  resolve(id: string): Promise<ResolvedConnection | null>;

  /**
   * HTTP request to the bundled server in which `loom-connection://<id>`
   * references are replaced by the shell with real connection URIs, so
   * credentials never enter the renderer. Credentials echoed back in the
   * response are redacted. Rejects unless `capabilities.credentialProxy`.
   */
  fetch(url: string, init?: RequestInit): Promise<Response>;

  /**
   * Test a connection by attempting to connect.
   */
  test(id: string): Promise<ConnectionTestResult>;
}

// =============================================================================
// Menu Operations
// =============================================================================

export type MenuAction =
  | 'new-workflow'
  | 'open-workflow'
  | 'save-workflow'
  | 'run-workflow'
  | 'validate-workflow'
  | 'show-workflow-viewer'
  | 'hide-workflow-viewer'
  | 'toggle-workflow-viewer';

export interface MenuOperations {
  /**
   * Register a callback for menu actions.
   * @param callback Function called when a menu action is triggered
   * @returns Cleanup function to unregister the callback
   */
  onMenuAction(callback: (action: MenuAction, data?: unknown) => void): (() => void) | undefined;
}

// =============================================================================
// Platform Capabilities
// =============================================================================

export interface PlatformCapabilities {
  /** Whether secure credential storage is available */
  secureStorage: boolean;
  /** Whether native file dialogs are available */
  nativeDialogs: boolean;
  /**
   * Whether the shell owns the server process and can inject stored
   * credentials into requests to it (see CredentialOperations.fetch). When
   * true, the renderer must not (and cannot) resolve plaintext credentials.
   */
  credentialProxy: boolean;
}

// =============================================================================
// Platform Adapter Interface
// =============================================================================

export type PlatformName = 'electron' | 'tauri' | 'web';

export interface PlatformAdapter {
  /** Platform identifier */
  readonly name: PlatformName;

  /** Platform capabilities */
  readonly capabilities: PlatformCapabilities;

  /** File system operations */
  readonly files: FileOperations;

  /** Application settings */
  readonly settings: SettingsOperations;

  /** Authentication */
  readonly auth: AuthOperations;

  /** Secure credential storage */
  readonly credentials: CredentialOperations;

  /** Menu system */
  readonly menu: MenuOperations;

  /**
   * Initialize the platform adapter.
   * Should be called once at app startup.
   */
  initialize(): Promise<void>;
}
