import type { AppSettings } from './settings';
import type {
  ConnectionInfo,
  CreateConnectionInput,
  UpdateConnectionInput,
  ResolvedConnection,
  ConnectionTestResult,
} from './connections';
import type { OpenDialogOptions, SaveDialogOptions } from '../platform/types';
import type { ProxyRequestPayload, ProxyResponsePayload } from '../platform/shared';

declare global {
  interface Window {
    /** Exposed by electron/preload.ts. Undefined outside Electron. */
    electronAPI?: {
      /**
       * Write a file. Rejects unless the path came from showSaveDialog or
       * showOpenDialog in this session.
       */
      saveFile: (content: string, filename: string) => Promise<string>
      /** Read a file. Same path rule as saveFile. */
      readFile: (filePath: string) => Promise<string>
      showSaveDialog: (options?: SaveDialogOptions) => Promise<string | null>
      showOpenDialog: (options?: OpenDialogOptions) => Promise<string | null>
      getSettings: () => Promise<AppSettings>
      setSettings: (settings: AppSettings) => Promise<void>
      /** Get ephemeral session token for backend authentication (desktop mode only) */
      getSessionToken: () => Promise<string | null>

      // Connection management APIs (credentials encrypted via safeStorage)
      /** List all connections (without credentials) */
      listConnections: () => Promise<ConnectionInfo[]>
      /** Get a single connection by ID (without credentials) */
      getConnection: (id: string) => Promise<ConnectionInfo | null>
      /** Create a new connection (credentials will be encrypted) */
      createConnection: (input: CreateConnectionInput) => Promise<ConnectionInfo>
      /** Update an existing connection */
      updateConnection: (id: string, input: UpdateConnectionInput) => Promise<ConnectionInfo>
      /** Delete a connection */
      deleteConnection: (id: string) => Promise<void>
      /**
       * Resolve connection with decrypted credentials. Refused by the main
       * process while the bundled server runs; use backendRequest instead.
       */
      resolveConnection: (id: string) => Promise<ResolvedConnection | null>
      /** Whether backendRequest can inject credentials (bundled server running). */
      connectionProxyAvailable: () => Promise<boolean>
      /**
       * Forward a request to the bundled server with loom-connection://
       * references expanded by the main process and credentials redacted
       * from the response.
       */
      backendRequest: (request: ProxyRequestPayload) => Promise<ProxyResponsePayload>
      /** Test a connection (uses resolved credentials internally) */
      testConnection: (id: string) => Promise<ConnectionTestResult>
      /** Check if secure credential storage is usable (safeStorage) */
      isEncryptionAvailable: () => Promise<boolean>
    }
  }
}

export {}
