/**
 * Tests for connection store
 * 
 * Tests the Zustand store for database connection management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConnectionStore } from '../connectionStore';
import type {
  ConnectionInfo,
  CreateConnectionInput,
  UpdateConnectionInput,
  ResolvedConnection,
  ConnectionTestResult,
} from '../../types/connections';

// Mock the server connections API to prevent real backend calls during unit tests
vi.mock('../../api/serverConnections', () => ({
  initializeServerConnectionsAuth: vi.fn().mockResolvedValue(undefined),
  listServerConnections: vi.fn().mockResolvedValue([]),
  setServerConnectionsToken: vi.fn(),
  getConnectionStoreStatus: vi.fn().mockResolvedValue({ enabled: false, connectionCount: 0 }),
}));

describe('connectionStore', () => {
  // Mock Electron API
  const mockElectronAPI = {
    listConnections: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    resolveConnection: vi.fn(),
    testConnection: vi.fn(),
    isEncryptionAvailable: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - mocking window.electronAPI
    window.electronAPI = mockElectronAPI;
    
    // Reset store state
    useConnectionStore.setState({
      connections: [],
      loaded: false,
      loading: false,
      error: null,
      encryptionAvailable: false,
    });
  });

  describe('loadConnections', () => {
    it('should load connections from Electron API', async () => {
      const mockConnections: ConnectionInfo[] = [
        {
          id: 'conn-1',
          name: 'Test DB',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          owner: 'client',
          createdAt: '2025-08-01',
          updatedAt: '2025-08-01',
        },
      ];

      mockElectronAPI.listConnections.mockResolvedValue(mockConnections);
      mockElectronAPI.isEncryptionAvailable.mockResolvedValue(true);

      const { loadConnections } = useConnectionStore.getState();
      await loadConnections();

      const state = useConnectionStore.getState();
      expect(state.connections).toEqual(mockConnections);
      expect(state.loaded).toBe(true);
      expect(state.encryptionAvailable).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('should handle loading errors', async () => {
      mockElectronAPI.listConnections.mockRejectedValue(new Error('Failed to load'));

      const { loadConnections } = useConnectionStore.getState();
      await loadConnections();

      const state = useConnectionStore.getState();
      expect(state.error).toBe('Failed to load');
      expect(state.loaded).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('should handle missing Electron API gracefully', async () => {
      // @ts-expect-error - intentionally removing API
      window.electronAPI = undefined;

      const { loadConnections } = useConnectionStore.getState();
      await loadConnections();

      const state = useConnectionStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.connections).toEqual([]);
    });
  });

  describe('getConnectionsByType', () => {
    it('should filter connections by type', async () => {
      const mockConnections: ConnectionInfo[] = [
        {
          id: 'conn-1',
          name: 'PostgreSQL DB',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'db1',
          owner: 'client',
          createdAt: '2025-08-01',
          updatedAt: '2025-08-01',
        },
        {
          id: 'conn-2',
          name: 'MySQL DB',
          type: 'mysql',
          host: 'localhost',
          port: 3306,
          database: 'db2',
          owner: 'client',
          createdAt: '2025-08-01',
          updatedAt: '2025-08-01',
        },
      ];

      mockElectronAPI.listConnections.mockResolvedValue(mockConnections);
      mockElectronAPI.isEncryptionAvailable.mockResolvedValue(true);

      const { loadConnections, getConnectionsByType } = useConnectionStore.getState();
      await loadConnections();

      const postgresConnections = getConnectionsByType('postgresql');
      expect(postgresConnections).toHaveLength(1);
      expect(postgresConnections[0]?.type).toBe('postgresql');

      const mysqlConnections = getConnectionsByType('mysql');
      expect(mysqlConnections).toHaveLength(1);
      expect(mysqlConnections[0]?.type).toBe('mysql');
    });

    it('should return empty array when no connections match', () => {
      const { getConnectionsByType } = useConnectionStore.getState();
      
      const sqliteConnections = getConnectionsByType('sqlite');
      expect(sqliteConnections).toEqual([]);
    });
  });

  describe('createConnection', () => {
    it('should create a new connection', async () => {
      const input: CreateConnectionInput = {
        name: 'New DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'newdb',
        username: 'user',
        password: 'pass',
      };

      const mockCreated: ConnectionInfo = {
        id: 'conn-new',
        name: 'New DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'newdb',
        owner: 'client',
        createdAt: '2025-08-01',
        updatedAt: '2025-08-01',
      };

      mockElectronAPI.createConnection.mockResolvedValue(mockCreated);

      const { createConnection } = useConnectionStore.getState();
      const result = await createConnection(input);

      expect(result).toEqual(mockCreated);
      const state = useConnectionStore.getState();
      expect(state.connections).toContainEqual(mockCreated);
      expect(state.loading).toBe(false);
    });

    it('should handle creation errors', async () => {
      const input: CreateConnectionInput = {
        name: 'New DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'newdb',
        username: 'user',
        password: 'pass',
      };

      mockElectronAPI.createConnection.mockRejectedValue(new Error('Creation failed'));

      const { createConnection } = useConnectionStore.getState();
      
      await expect(createConnection(input)).rejects.toThrow();
      
      const state = useConnectionStore.getState();
      expect(state.error).toBe('Creation failed');
      expect(state.loading).toBe(false);
    });

    it('should throw when Electron API not available', async () => {
      // @ts-expect-error - intentionally removing API
      window.electronAPI = undefined;

      const input: CreateConnectionInput = {
        name: 'New DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'newdb',
        username: 'user',
        password: 'pass',
      };

      const { createConnection } = useConnectionStore.getState();
      await expect(createConnection(input)).rejects.toThrow('Electron API not available');
    });
  });

  describe('updateConnection', () => {
    it('should update an existing connection', async () => {
      const existing: ConnectionInfo = {
        id: 'conn-1',
        name: 'Old Name',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'db',
        owner: 'client',
        createdAt: '2025-08-01',
        updatedAt: '2025-08-01',
      };

      useConnectionStore.setState({ connections: [existing] });

      const update: UpdateConnectionInput = {
        name: 'New Name',
        port: 5433,
      };

      const mockUpdated: ConnectionInfo = {
        ...existing,
        name: 'New Name',
        port: 5433,
        updatedAt: '2024-01-02',
      };

      mockElectronAPI.updateConnection.mockResolvedValue(mockUpdated);

      const { updateConnection } = useConnectionStore.getState();
      const result = await updateConnection('conn-1', update);

      expect(result).toEqual(mockUpdated);
      const state = useConnectionStore.getState();
      expect(state.connections[0]).toEqual(mockUpdated);
      expect(state.loading).toBe(false);
    });

    it('should handle update errors', async () => {
      mockElectronAPI.updateConnection.mockRejectedValue(new Error('Update failed'));

      const { updateConnection } = useConnectionStore.getState();
      
      await expect(updateConnection('conn-1', { name: 'New' })).rejects.toThrow();
      
      const state = useConnectionStore.getState();
      expect(state.error).toBe('Update failed');
      expect(state.loading).toBe(false);
    });
  });

  describe('deleteConnection', () => {
    it('should delete a connection', async () => {
      const connections: ConnectionInfo[] = [
        {
          id: 'conn-1',
          name: 'DB 1',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'db1',
          owner: 'client',
          createdAt: '2025-08-01',
          updatedAt: '2025-08-01',
        },
        {
          id: 'conn-2',
          name: 'DB 2',
          type: 'postgresql',
          host: 'localhost',
          port: 5433,
          database: 'db2',
          owner: 'client',
          createdAt: '2025-08-01',
          updatedAt: '2025-08-01',
        },
      ];

      useConnectionStore.setState({ connections });

      mockElectronAPI.deleteConnection.mockResolvedValue(undefined);

      const { deleteConnection } = useConnectionStore.getState();
      await deleteConnection('conn-1');

      const state = useConnectionStore.getState();
      expect(state.connections).toHaveLength(1);
      expect(state.connections[0]?.id).toBe('conn-2');
      expect(state.loading).toBe(false);
    });

    it('should handle deletion errors', async () => {
      mockElectronAPI.deleteConnection.mockRejectedValue(new Error('Deletion failed'));

      const { deleteConnection } = useConnectionStore.getState();
      
      await expect(deleteConnection('conn-1')).rejects.toThrow();
      
      const state = useConnectionStore.getState();
      expect(state.error).toBe('Deletion failed');
      expect(state.loading).toBe(false);
    });
  });

  describe('resolveConnection', () => {
    it('should resolve connection with credentials', async () => {
      const mockResolved: ResolvedConnection = {
        id: 'conn-1',
        name: 'Test DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        owner: 'client',
        createdAt: '2025-08-01',
        updatedAt: '2025-08-01',
      };

      mockElectronAPI.resolveConnection.mockResolvedValue(mockResolved);

      const { resolveConnection } = useConnectionStore.getState();
      const result = await resolveConnection('conn-1');

      expect(result).toEqual(mockResolved);
      expect(mockElectronAPI.resolveConnection).toHaveBeenCalledWith('conn-1');
    });

    it('should return null when resolution fails', async () => {
      mockElectronAPI.resolveConnection.mockResolvedValue(null);

      const { resolveConnection } = useConnectionStore.getState();
      const result = await resolveConnection('invalid-id');

      expect(result).toBeNull();
    });

    it('should throw when Electron API not available', async () => {
      // @ts-expect-error - intentionally removing API
      window.electronAPI = undefined;

      const { resolveConnection } = useConnectionStore.getState();
      await expect(resolveConnection('conn-1')).rejects.toThrow('Electron API not available');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockResult: ConnectionTestResult = {
        success: true,
        message: 'Connection successful',
        latencyMs: 42,
      };

      mockElectronAPI.testConnection.mockResolvedValue(mockResult);

      const { testConnection } = useConnectionStore.getState();
      const result = await testConnection('conn-1');

      expect(result).toEqual(mockResult);
      expect(mockElectronAPI.testConnection).toHaveBeenCalledWith('conn-1');
    });

    it('should handle test failures', async () => {
      const mockResult: ConnectionTestResult = {
        success: false,
        message: 'Connection refused',
      };

      mockElectronAPI.testConnection.mockResolvedValue(mockResult);

      const { testConnection } = useConnectionStore.getState();
      const result = await testConnection('conn-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('refused');
    });

    it('should handle test errors', async () => {
      mockElectronAPI.testConnection.mockRejectedValue(new Error('Test error'));

      const { testConnection } = useConnectionStore.getState();
      const result = await testConnection('conn-1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Test error');
    });

    it('should return error when Electron API not available', async () => {
      // @ts-expect-error - intentionally removing API
      window.electronAPI = undefined;

      const { testConnection } = useConnectionStore.getState();
      const result = await testConnection('conn-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Electron API not available');
    });
  });

  describe('checkEncryption', () => {
    it('should check if encryption is available', async () => {
      mockElectronAPI.isEncryptionAvailable.mockResolvedValue(true);

      const { checkEncryption } = useConnectionStore.getState();
      const result = await checkEncryption();

      expect(result).toBe(true);
      const state = useConnectionStore.getState();
      expect(state.encryptionAvailable).toBe(true);
    });

    it('should handle encryption unavailable', async () => {
      mockElectronAPI.isEncryptionAvailable.mockResolvedValue(false);

      const { checkEncryption } = useConnectionStore.getState();
      const result = await checkEncryption();

      expect(result).toBe(false);
      const state = useConnectionStore.getState();
      expect(state.encryptionAvailable).toBe(false);
    });

    it('should return false when Electron API not available', async () => {
      // @ts-expect-error - intentionally removing API
      window.electronAPI = undefined;

      const { checkEncryption } = useConnectionStore.getState();
      const result = await checkEncryption();

      expect(result).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useConnectionStore.setState({ error: 'Some error' });

      const { clearError } = useConnectionStore.getState();
      clearError();

      const state = useConnectionStore.getState();
      expect(state.error).toBeNull();
    });
  });
});
