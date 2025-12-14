/**
 * Connection Store
 * 
 * Manages database connections with secure credential storage.
 * Credentials are stored encrypted in Electron via safeStorage.
 * This store handles the React side and communicates via IPC.
 */

import { create } from 'zustand';
import type { 
  ConnectionInfo, 
  CreateConnectionInput, 
  UpdateConnectionInput,
  ResolvedConnection,
  ConnectionTestResult,
  DatabaseType 
} from '../types/connections';
import { initializeServerConnectionsAuth, listServerConnections } from '../api/serverConnections';

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
      // Initialize auth for server connections
      await initializeServerConnectionsAuth();
      
      // Load client-managed connections from Electron
      const clientConnections: ConnectionInfo[] = [];
      let encryptionAvailable = false;
      
      if (window.electronAPI?.listConnections) {
        const electronConns = await window.electronAPI.listConnections();
        clientConnections.push(...electronConns);
        encryptionAvailable = await window.electronAPI.isEncryptionAvailable?.() ?? false;
      } else {
        console.warn('[ConnectionStore] Electron API not available - client connections unavailable');
      }
      
      // Load server-managed connections from backend
      const serverConnections: ConnectionInfo[] = [];
      try {
        const backendConns = await listServerConnections();
        serverConnections.push(...backendConns);
        console.log(`[ConnectionStore] Loaded ${serverConnections.length} server connections`);
      } catch (error) {
        console.warn('[ConnectionStore] Failed to load server connections:', error);
        // Don't fail the whole load - client connections still work
      }
      
      // Combine both sources
      const allConnections = [...clientConnections, ...serverConnections];
      set({ connections: allConnections, loaded: true, loading: false, encryptionAvailable });
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
    if (!window.electronAPI?.createConnection) {
      throw new Error('Electron API not available');
    }

    set({ loading: true, error: null });
    try {
      const connection = await window.electronAPI.createConnection(input);
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
    if (!window.electronAPI?.updateConnection) {
      throw new Error('Electron API not available');
    }

    set({ loading: true, error: null });
    try {
      const connection = await window.electronAPI.updateConnection(id, input);
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
    if (!window.electronAPI?.deleteConnection) {
      throw new Error('Electron API not available');
    }

    set({ loading: true, error: null });
    try {
      await window.electronAPI.deleteConnection(id);
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
    if (!window.electronAPI?.resolveConnection) {
      throw new Error('Electron API not available');
    }

    try {
      return await window.electronAPI.resolveConnection(id);
    } catch (error) {
      console.error('[ConnectionStore] Failed to resolve connection:', error);
      return null;
    }
  },

  testConnection: async (id: string) => {
    if (!window.electronAPI?.testConnection) {
      return { success: false, message: 'Electron API not available' };
    }

    set({ loading: true, error: null });
    try {
      const result = await window.electronAPI.testConnection(id);
      set({ loading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to test connection';
      set({ error: message, loading: false });
      return { success: false, message };
    }
  },

  checkEncryption: async () => {
    if (!window.electronAPI?.isEncryptionAvailable) {
      return false;
    }
    const available = await window.electronAPI.isEncryptionAvailable();
    set({ encryptionAvailable: available });
    return available;
  },

  clearError: () => {
    set({ error: null });
  },
}));
