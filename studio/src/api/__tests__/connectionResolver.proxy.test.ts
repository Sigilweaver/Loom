/**
 * Connection resolution when the desktop shell owns the server
 * (`capabilities.credentialProxy`): the renderer must only ever handle
 * `loom-connection://<id>` references, never plaintext credentials.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveConnectionUri, resolveWorkflowConnections } from '../connectionResolver';
import type { WorkflowJSON } from '../../domain/workflow/services/WorkflowSerializer';
import { useSettingsStore } from '../../state/settingsStore';
import { mockPlatformCapabilities, mockPlatformCredentials } from '../../test-setup';

function dbWorkflow(owner?: 'client' | 'hub'): WorkflowJSON {
  return {
    version: '1.0',
    meta: {
      name: 'wf',
      description: '',
      author: '',
      workflowId: 'wf_1',
      created: new Date().toISOString(),
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
          ...(owner ? { owner } : {}),
        },
        sockets: [{ id: 'output', direction: 'output' }],
      },
    ],
    wires: [],
  } as unknown as WorkflowJSON;
}

const info = {
  id: 'conn-1',
  name: 'Sales',
  type: 'postgresql' as const,
  owner: 'client' as const,
  host: 'db',
  port: 5432,
  database: 'sales',
  createdAt: '',
  updatedAt: '',
};

describe('connectionResolver with the credential proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformCapabilities.secureStorage = true;
    mockPlatformCapabilities.credentialProxy = true;
    mockPlatformCredentials.get.mockResolvedValue(info);
    useSettingsStore.setState({ executionMode: 'bundled' });
  });

  afterEach(() => {
    mockPlatformCapabilities.credentialProxy = false;
    useSettingsStore.setState({ executionMode: 'bundled' });
  });

  it('puts a reference in the workflow and never resolves credentials', async () => {
    const result = await resolveWorkflowConnections(dbWorkflow());
    const config = result.tools[0]?.config as Record<string, unknown>;

    expect(config.source).toBe('loom-connection://conn-1');
    expect(config.owner).toBe('client');
    expect(mockPlatformCredentials.resolve).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/password|postgresql:\/\//);
  });

  it('leaves the tool unresolved when the connection does not exist', async () => {
    mockPlatformCredentials.get.mockResolvedValue(null);
    const result = await resolveWorkflowConnections(dbWorkflow());
    const config = result.tools[0]?.config as Record<string, unknown>;
    expect(config.source).toBeUndefined();
  });

  it('does not touch hub-owned connections', async () => {
    const result = await resolveWorkflowConnections(dbWorkflow('hub'));
    const config = result.tools[0]?.config as Record<string, unknown>;
    expect(config.source).toBeUndefined();
    expect(config.owner).toBe('hub');
    expect(mockPlatformCredentials.get).not.toHaveBeenCalled();
  });

  it('refuses client connections in Hub mode, where the shell cannot inject them', async () => {
    useSettingsStore.setState({ executionMode: 'hub' });
    await expect(resolveWorkflowConnections(dbWorkflow())).rejects.toThrow(/Hub/);
    expect(mockPlatformCredentials.resolve).not.toHaveBeenCalled();
  });

  it('resolveConnectionUri returns a reference and the database type', async () => {
    await expect(resolveConnectionUri('conn-1')).resolves.toEqual({
      uri: 'loom-connection://conn-1',
      type: 'postgresql',
    });
    expect(mockPlatformCredentials.resolve).not.toHaveBeenCalled();
  });

  it('resolveConnectionUri fails clearly for unknown connections', async () => {
    mockPlatformCredentials.get.mockResolvedValue(null);
    await expect(resolveConnectionUri('nope')).rejects.toThrow(/not found/);
  });
});

describe('connectionResolver without the credential proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformCapabilities.secureStorage = true;
    mockPlatformCapabilities.credentialProxy = false;
  });

  it('still resolves credentials locally (Client build, dev, remote server)', async () => {
    mockPlatformCredentials.resolve.mockResolvedValue({ ...info, username: 'u', password: 'p@ss' });
    const result = await resolveWorkflowConnections(dbWorkflow());
    const config = result.tools[0]?.config as Record<string, unknown>;
    expect(config.source).toBe('postgresql://u:p%40ss@db:5432/sales');
    expect(mockPlatformCredentials.get).not.toHaveBeenCalled();
  });
});
