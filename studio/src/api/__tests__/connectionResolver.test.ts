/**
 * Tests for connection resolution utilities
 * 
 * Tests the connection resolver that turns connectionIds into
 * `loom-connection://<id>` references before workflow execution. The
 * renderer never sees credentials: the desktop shell swaps references for
 * real URIs (see tauri/src/commands/proxy.rs, which has the URI tests).
 *
 * Connection ownership:
 * - owner='client': Replaced by a reference the shell expands
 * - owner='server': Passed through to backend for resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveWorkflowConnections,
  hasDatabaseConnections,
  getWorkflowConnectionIds,
  getWorkflowConnectionIdsByOwner,
} from '../connectionResolver';
import type { WorkflowJSON } from '../../domain/workflow/services/WorkflowSerializer';
import type { ConnectionInfo } from '../../types/connections';
import {
  mockPlatform,
  mockPlatformCapabilities,
  mockPlatformCredentials,
} from '../../test-setup';

describe('connectionResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default to desktop mode with secure storage
    mockPlatform.name = 'tauri';
    mockPlatformCapabilities.secureStorage = true;
    mockPlatformCapabilities.nativeDialogs = true;
    mockPlatformCapabilities.credentialProxy = true;
  });

  afterEach(() => {
    mockPlatformCapabilities.credentialProxy = false;
  });

  describe('resolveWorkflowConnections', () => {
    it('does not log details from a native lookup error', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        mockPlatformCredentials.get.mockRejectedValueOnce(
          new Error('postgresql://alice:secret-password@localhost/db'),
        );
        const workflow: WorkflowJSON = {
          version: '1.0',
          meta: { name: 'Test', description: '', author: '', workflowId: 'test', created: '2025-08-01' },
          tools: [{
            id: 'db1', type: 'Input', x: 0, y: 0, sockets: [],
            config: { category: 'database', type: 'postgresql', connectionId: 'conn-1', owner: 'client' },
          }],
          wires: [],
        };
        await resolveWorkflowConnections(workflow);
        expect(spy).toHaveBeenCalled();
        expect(JSON.stringify(spy.mock.calls)).not.toContain('secret-password');
        expect(spy.mock.calls.flat()).not.toContainEqual(expect.any(Error));
      } finally {
        spy.mockRestore();
      }
    });

    it('should return workflow unchanged when no database tools present', async () => {
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'csv1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'file',
              type: 'csv',
              source: '/path/to/file.csv',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const result = await resolveWorkflowConnections(workflow);
      
      expect(result).toEqual(workflow);
      expect(mockPlatformCredentials.get).not.toHaveBeenCalled();
    });

    it('should replace the connection with a reference', async () => {
      const mockResolved: ConnectionInfo = {
        id: 'conn-1',
        name: 'Test DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        owner: 'client',
        createdAt: '2025-08-01',
        updatedAt: '2025-08-01',
      };

      mockPlatformCredentials.get.mockResolvedValue(mockResolved);

      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              connectionId: 'conn-1',
              query: 'SELECT * FROM users',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const result = await resolveWorkflowConnections(workflow);

      expect(mockPlatformCredentials.get).toHaveBeenCalledWith('conn-1');
      const tool0 = result.tools[0];
      if (!tool0 || !tool0.config) throw new Error('Tool not found');
      expect(tool0.config.source).toBe('loom-connection://conn-1');
      expect(JSON.stringify(result)).not.toContain('testuser');
      // Original config should be preserved
      expect(tool0.config.connectionId).toBe('conn-1');
      expect(tool0.config.query).toBe('SELECT * FROM users');
    });

    it('should handle multiple database connections', async () => {
      mockPlatformCredentials.get
        .mockResolvedValueOnce({
          id: 'conn-1',
          name: 'DB1',
          type: 'postgresql',
          host: 'host1',
          port: 5432,
          database: 'db1',
          owner: 'client',
          createdAt: '2025-08-01',
          updatedAt: '2025-08-01',
        })
        .mockResolvedValueOnce({
          id: 'conn-2',
          name: 'DB2',
          type: 'postgresql',
          host: 'host2',
          port: 5433,
          database: 'db2',
          owner: 'client',
          createdAt: '2025-08-01',
          updatedAt: '2025-08-01',
        });

      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              connectionId: 'conn-1',
              query: 'SELECT * FROM table1',
            },
            sockets: [],
          },
          {
            id: 'db2',
            type: 'Input',
            x: 100,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              connectionId: 'conn-2',
              query: 'SELECT * FROM table2',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const result = await resolveWorkflowConnections(workflow);

      expect(mockPlatformCredentials.get).toHaveBeenCalledTimes(2);
      const tool0 = result.tools[0];
      const tool1 = result.tools[1];
      if (!tool0 || !tool0.config || !tool1 || !tool1.config) throw new Error('Tools not found');
      expect(tool0.config.source).toBe('loom-connection://conn-1');
      expect(tool1.config.source).toBe('loom-connection://conn-2');
    });

    it('should return original workflow if connection resolution fails', async () => {
      mockPlatformCredentials.get.mockResolvedValue(null);

      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              connectionId: 'invalid-conn',
              query: 'SELECT 1',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const result = await resolveWorkflowConnections(workflow);

      // Should return original since resolution failed
      expect(result).toEqual(workflow);
      const tool0 = result.tools[0];
      if (!tool0 || !tool0.config) throw new Error('Tool not found');
      expect(tool0.config.source).toBeUndefined();
    });

    it('should throw error when secure storage not available', async () => {
      // Simulate browser mode without secure storage
      mockPlatformCapabilities.secureStorage = false;

      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              connectionId: 'conn-1',
              query: 'SELECT 1',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      await expect(resolveWorkflowConnections(workflow)).rejects.toThrow(
        'desktop app'
      );
    });

    it('should not modify non-database tools', async () => {
      mockPlatformCredentials.get.mockResolvedValue({
        id: 'conn-1',
        name: 'DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'db',
        owner: 'client',
        createdAt: '2025-08-01',
        updatedAt: '2025-08-01',
      });

      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'csv1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'file',
              type: 'csv',
              source: '/path/to/file.csv',
            },
            sockets: [],
          },
          {
            id: 'db1',
            type: 'Input',
            x: 100,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              connectionId: 'conn-1',
              query: 'SELECT 1',
            },
            sockets: [],
          },
          {
            id: 'filter1',
            type: 'Filter',
            x: 200,
            y: 0,
            config: {
              expression: 'pl.col("age") > 25',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const result = await resolveWorkflowConnections(workflow);

      // CSV and Filter should be unchanged
      expect(result.tools[0]).toEqual(workflow.tools[0]);
      expect(result.tools[2]).toEqual(workflow.tools[2]);
      // Only database tool should have source added
      const tool1 = result.tools[1];
      if (!tool1 || !tool1.config) throw new Error('Tool not found');
      expect(tool1.config.source).toBeDefined();
    });

    it('should pass through server-owned connections without resolving', async () => {
      // Server connections should not be resolved client-side
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              owner: 'server',
              connectionId: 'server-conn-1',
              query: 'SELECT * FROM users',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const result = await resolveWorkflowConnections(workflow);

      // Should NOT call the platform credential API for server connections
      expect(mockPlatformCredentials.get).not.toHaveBeenCalled();
      
      const tool0 = result.tools[0];
      if (!tool0 || !tool0.config) throw new Error('Tool not found');
      
      // Should preserve connectionId and owner, no source
      expect(tool0.config.connectionId).toBe('server-conn-1');
      expect(tool0.config.owner).toBe('server');
      expect(tool0.config.source).toBeUndefined();
    });

    it('should handle mixed client and server connections', async () => {
      mockPlatformCredentials.get.mockResolvedValue({
        id: 'client-conn-1',
        name: 'Client DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'clientdb',
        owner: 'client',
        createdAt: '2025-08-01',
        updatedAt: '2025-08-01',
      });

      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              owner: 'client',
              connectionId: 'client-conn-1',
              query: 'SELECT * FROM client_table',
            },
            sockets: [],
          },
          {
            id: 'db2',
            type: 'Input',
            x: 100,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              owner: 'server',
              connectionId: 'server-conn-1',
              query: 'SELECT * FROM server_table',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const result = await resolveWorkflowConnections(workflow);

      // Should only resolve client connection
      expect(mockPlatformCredentials.get).toHaveBeenCalledTimes(1);
      expect(mockPlatformCredentials.get).toHaveBeenCalledWith('client-conn-1');
      
      const tool0 = result.tools[0];
      const tool1 = result.tools[1];
      if (!tool0 || !tool0.config || !tool1 || !tool1.config) throw new Error('Tools not found');
      
      // Client connection should have source
      expect(tool0.config.source).toBe('loom-connection://client-conn-1');
      expect(tool0.config.owner).toBe('client');
      
      // Server connection should NOT have source (backend resolves it)
      expect(tool1.config.source).toBeUndefined();
      expect(tool1.config.owner).toBe('server');
      expect(tool1.config.connectionId).toBe('server-conn-1');
    });

    it('should default to client owner when not specified', async () => {
      mockPlatformCredentials.get.mockResolvedValue({
        id: 'conn-1',
        name: 'DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'db',
        owner: 'client',
        createdAt: '2025-08-01',
        updatedAt: '2025-08-01',
      });

      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              // No owner specified - should default to 'client'
              connectionId: 'conn-1',
              query: 'SELECT 1',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const result = await resolveWorkflowConnections(workflow);

      // Should resolve as client connection
      expect(mockPlatformCredentials.get).toHaveBeenCalledWith('conn-1');
      
      const tool0 = result.tools[0];
      if (!tool0 || !tool0.config) throw new Error('Tool not found');
      expect(tool0.config.source).toBeDefined();
      expect(tool0.config.owner).toBe('client');
    });
  });

  describe('hasDatabaseConnections', () => {
    it('should return true when workflow has database tools', () => {
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      expect(hasDatabaseConnections(workflow)).toBe(true);
    });

    it('should return false when workflow has no database tools', () => {
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'csv1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'file',
              type: 'csv',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      expect(hasDatabaseConnections(workflow)).toBe(false);
    });

    it('should return false for empty workflow', () => {
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [],
        wires: [],
      };

      expect(hasDatabaseConnections(workflow)).toBe(false);
    });
  });

  describe('getWorkflowConnectionIds', () => {
    it('should extract all connection IDs from workflow', () => {
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              connectionId: 'conn-1',
            },
            sockets: [],
          },
          {
            id: 'db2',
            type: 'Input',
            x: 100,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              connectionId: 'conn-2',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const ids = getWorkflowConnectionIds(workflow);
      
      expect(ids).toHaveLength(2);
      expect(ids).toContain('conn-1');
      expect(ids).toContain('conn-2');
    });

    it('should return empty array when no database tools', () => {
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'csv1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'file',
              type: 'csv',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const ids = getWorkflowConnectionIds(workflow);
      
      expect(ids).toHaveLength(0);
    });

    it('should ignore database tools without connectionId', () => {
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              // No connectionId
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const ids = getWorkflowConnectionIds(workflow);
      
      expect(ids).toHaveLength(0);
    });
  });

  describe('getWorkflowConnectionIdsByOwner', () => {
    it('should filter connection IDs by client owner', () => {
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              owner: 'client',
              connectionId: 'client-conn-1',
            },
            sockets: [],
          },
          {
            id: 'db2',
            type: 'Input',
            x: 100,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              owner: 'server',
              connectionId: 'server-conn-1',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const clientIds = getWorkflowConnectionIdsByOwner(workflow, 'client');
      const serverIds = getWorkflowConnectionIdsByOwner(workflow, 'server');
      
      expect(clientIds).toEqual(['client-conn-1']);
      expect(serverIds).toEqual(['server-conn-1']);
    });

    it('should default to client owner for connections without owner field', () => {
      const workflow: WorkflowJSON = {
        version: '1.0',
        meta: {
          name: 'Test',
          description: '',
          author: 'Test',
          workflowId: 'test-1',
          created: '2025-08-01',
        },
        tools: [
          {
            id: 'db1',
            type: 'Input',
            x: 0,
            y: 0,
            config: {
              category: 'database',
              type: 'postgresql',
              // No owner specified
              connectionId: 'conn-1',
            },
            sockets: [],
          },
        ],
        wires: [],
      };

      const clientIds = getWorkflowConnectionIdsByOwner(workflow, 'client');
      const serverIds = getWorkflowConnectionIdsByOwner(workflow, 'server');
      
      expect(clientIds).toEqual(['conn-1']);
      expect(serverIds).toEqual([]);
    });
  });
});
