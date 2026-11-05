import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnectionManager } from '../ConnectionManager';
import { useConnectionStore } from '../../../state/connectionStore';
import type { ConnectionInfo } from '../../../types/connections';

const connection: ConnectionInfo = {
  id: 'conn-1',
  name: 'Sales',
  type: 'postgresql',
  owner: 'client',
  host: 'db.internal',
  port: 5432,
  database: 'sales',
  createdAt: '',
  updatedAt: '',
};

describe('ConnectionManager editing', () => {
  const updateConnection = vi.fn();

  beforeEach(() => {
    updateConnection.mockReset().mockResolvedValue(connection);
    useConnectionStore.setState({
      connections: [connection],
      loaded: true,
      loading: false,
      error: null,
      encryptionAvailable: true,
      updateConnection,
    });
  });

  it('keeps the stored username and password when both are left blank', async () => {
    render(<ConnectionManager />);
    fireEvent.click(screen.getByTitle('Edit connection'));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(updateConnection).toHaveBeenCalledTimes(1));
    const [id, input] = updateConnection.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('conn-1');
    expect(input).not.toHaveProperty('username');
    expect(input).not.toHaveProperty('password');
    expect(input).toMatchObject({ name: 'Sales', host: 'db.internal', port: 5432 });
  });
});
