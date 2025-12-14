import type { AppSettings } from './settings';
import type { 
  ConnectionInfo, 
  CreateConnectionInput, 
  UpdateConnectionInput,
  ResolvedConnection,
  ConnectionTestResult,
  DatabaseType 
} from './connections';

interface ElectronFileFilter {
  name: string;
  extensions: string[];
}

interface ElectronOpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: ElectronFileFilter[];
  properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[];
  message?: string;
}

interface ElectronSaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: ElectronFileFilter[];
  message?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      onMenuAction: (callback: (action: string, data?: unknown) => void) => (() => void) | void
      saveFile: (content: string, filename: string) => Promise<string | null>
      readFile: (filePath: string) => Promise<string>
      showSaveDialog: (options?: ElectronSaveDialogOptions) => Promise<string | null>
      showOpenDialog: (options?: ElectronOpenDialogOptions) => Promise<string | null>
      getSettings: () => Promise<AppSettings>
      setSettings: (settings: AppSettings) => Promise<void>
      /** Get ephemeral session token for backend authentication (desktop mode only) */
      getSessionToken: () => Promise<string | null>
      
      // Connection management APIs (credentials encrypted via safeStorage)
      /** List all connections (without credentials) */
      listConnections: () => Promise<ConnectionInfo[]>
      /** List connections filtered by database type */
      listConnectionsByType: (type: DatabaseType) => Promise<ConnectionInfo[]>
      /** Get a single connection by ID (without credentials) */
      getConnection: (id: string) => Promise<ConnectionInfo | null>
      /** Create a new connection (credentials will be encrypted) */
      createConnection: (input: CreateConnectionInput) => Promise<ConnectionInfo>
      /** Update an existing connection */
      updateConnection: (id: string, input: UpdateConnectionInput) => Promise<ConnectionInfo>
      /** Delete a connection */
      deleteConnection: (id: string) => Promise<void>
      /** Resolve connection with decrypted credentials (for backend requests) */
      resolveConnection: (id: string) => Promise<ResolvedConnection | null>
      /** Test a connection (uses resolved credentials internally) */
      testConnection: (id: string) => Promise<ConnectionTestResult>
      /** Check if encryption is available (safeStorage) */
      isEncryptionAvailable: () => Promise<boolean>
    }
  }
}

export {}
