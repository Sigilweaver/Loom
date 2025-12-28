/**
 * Connection Store
 * 
 * Manages database connections with secure credential storage.
 * Credentials are stored encrypted via platform-specific secure storage.
 * 
 * Connection sources by execution mode:
 * - Bundled/External: Client connections only (local secure storage)
 * - Hub: Client connections (local) + Hub-managed connections (from Hub API)
 * 
 * Note: Server is purely an execution engine - it does NOT manage connections.
 */

import { create } from 'zustand';
import { platform, hasSecureStorage } from '@platform';
import type { 
  ConnectionInfo, 
  CreateConnectionInput, 
  UpdateConnectionInput,
  ResolvedConnection,
  ConnectionTestResult,
  DatabaseType 
} from '../types/connections';

interface ConnectionState {
  /** All connections (without credentials) */
  connections: ConnectionInfo[];
  /** Whether connections have been loaded */
  loaded: boolean;
  /** Loading state for async operations */
  loading: boolean;
  /** Last error message */
  error: string | null;
  /** Whether encryption is available */
  encryptionAvailable: boolean;
  
  // Actions
  loadConnections: () => Promise<void>;
  getConnectionsByType: (type: DatabaseType) => ConnectionInfo[];
  createConnection: (input: CreateConnectionInput) => Promise<ConnectionInfo>;
  updateConnection: (id: string, input: UpdateConnectionInput) => Promise<ConnectionInfo>;
  deleteConnection: (id: string) => Promise<void>;
  resolveConnection: (id: string) => Promise<ResolvedConnection | null>;
  testConnection: (id: string) => Promise<ConnectionTestResult>;
  checkEncryption: () => Promise<boolean>;
  clearError: () => void;
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  connections: [],
  loaded: false,
  loading: false,
  error: null,
  encryptionAvailable: false,

  loadConnections: async () => {
    set({ loading: true, error: null });
    
    try {
      // Load client-managed connections from platform secure storage
      const clientConnections: ConnectionInfo[] = [];
      let encryptionAvailable = false;
      
      if (hasSecureStorage()) {
        const platformConns = await platform.credentials.list();
        clientConnections.push(...platformConns);
        encryptionAvailable = await platform.credentials.isAvailable();
      } else {
        console.warn('[ConnectionStore] Secure storage not available - client connections unavailable');
      }
      
      // Note: In Hub mode, Hub-managed connections are fetched separately
      // via the Hub API when needed for execution. They are NOT mixed into
      // this store to keep local and Hub connections clearly separated.
      
      set({ connections: clientConnections, loaded: true, loading: false, encryptionAvailable });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load connections';
      set({ error: message, loading: false, loaded: true });
      console.error('[ConnectionStore] Failed to load connections:', error);
    }
  },

  getConnectionsByType: (type: DatabaseType) => {
    return get().connections.filter(c => c.type === type);
  },

  createConnection: async (input: CreateConnectionInput) => {
    if (!hasSecureStorage()) {
      throw new Error('Secure storage not available');
    }

    set({ loading: true, error: null });
    try {
      const connection = await platform.credentials.create(input);
      set(state => ({
        connections: [...state.connections, connection],
        loading: false,
      }));
      return connection;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create connection';
      set({ error: message, loading: false });
      throw error;
    }
  },

  updateConnection: async (id: string, input: UpdateConnectionInput) => {
    if (!hasSecureStorage()) {
      throw new Error('Secure storage not available');
    }

    set({ loading: true, error: null });
    try {
      const connection = await platform.credentials.update(id, input);
      set(state => ({
        connections: state.connections.map(c => c.id === id ? connection : c),
        loading: false,
      }));
      return connection;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update connection';
      set({ error: message, loading: false });
      throw error;
    }
  },

  deleteConnection: async (id: string) => {
    if (!hasSecureStorage()) {
      throw new Error('Secure storage not available');
    }

    set({ loading: true, error: null });
    try {
      await platform.credentials.delete(id);
      set(state => ({
        connections: state.connections.filter(c => c.id !== id),
        loading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete connection';
      set({ error: message, loading: false });
      throw error;
    }
  },

  resolveConnection: async (id: string) => {
    if (!hasSecureStorage()) {
      throw new Error('Secure storage not available');
    }

    try {
      return await platform.credentials.resolve(id);
    } catch (error) {
      console.error('[ConnectionStore] Failed to resolve connection:', error);
      return null;
    }
  },

  testConnection: async (id: string) => {
    if (!hasSecureStorage()) {
      return { success: false, message: 'Secure storage not available' };
    }

    set({ loading: true, error: null });
    try {
      const result = await platform.credentials.test(id);
      set({ loading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to test connection';
      set({ error: message, loading: false });
      return { success: false, message };
    }
  },

  checkEncryption: async () => {
    const available = await platform.credentials.isAvailable();
    set({ encryptionAvailable: available });
    return available;
  },

  clearError: () => {
    set({ error: null });
  },
}));
