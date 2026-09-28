import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../types/settings';

const invoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

async function loadAdapter() {
  vi.resetModules();
  return (await import('../tauri')).tauriPlatform;
}

beforeEach(() => {
  invoke.mockReset();
  localStorage.clear();
});

describe('tauri adapter: files', () => {
  it('invokes the file commands with the argument names Rust expects', async () => {
    const tauri = await loadAdapter();
    invoke.mockResolvedValueOnce('contents');
    expect(await tauri.files.readFile('/tmp/a.swwf')).toBe('contents');
    expect(invoke).toHaveBeenLastCalledWith('read_file', { path: '/tmp/a.swwf' });

    invoke.mockResolvedValueOnce(undefined);
    await tauri.files.writeFile('/tmp/a.swwf', '{}');
    expect(invoke).toHaveBeenLastCalledWith('write_file', { path: '/tmp/a.swwf', content: '{}' });
  });

  it('maps dialog options to the Rust option structs', async () => {
    const tauri = await loadAdapter();
    const filters = [{ name: 'Workflow', extensions: ['swwf'] }];
    invoke.mockResolvedValue('/tmp/a.swwf');

    await tauri.files.showOpenDialog({ title: 'Open', defaultPath: 'x', filters, properties: ['openFile'] });
    expect(invoke).toHaveBeenLastCalledWith('show_open_dialog', {
      options: { title: 'Open', defaultPath: 'x', filters },
    });

    await tauri.files.showSaveDialog({ defaultPath: 'a.swwf', filters });
    expect(invoke).toHaveBeenLastCalledWith('show_save_dialog', {
      options: { title: undefined, defaultPath: 'a.swwf', filters },
    });

    await tauri.files.showOpenDialog();
    expect(invoke).toHaveBeenLastCalledWith('show_open_dialog', { options: null });
  });

  it('propagates command failures (for example a denied path)', async () => {
    const tauri = await loadAdapter();
    invoke.mockRejectedValueOnce('Access denied');
    await expect(tauri.files.readFile('/etc/passwd')).rejects.toBe('Access denied');
  });
});

describe('tauri adapter: settings', () => {
  it('merges stored settings over defaults', async () => {
    const tauri = await loadAdapter();
    invoke.mockResolvedValueOnce({ author: 'Ada', layout: { gridSnap: 20 } });
    const settings = await tauri.settings.getSettings();
    expect(settings.author).toBe('Ada');
    expect(settings.layout.gridSnap).toBe(20);
    expect(settings.layout.alignment).toBe(DEFAULT_SETTINGS.layout.alignment);
  });

  it('returns defaults before the first save and on errors', async () => {
    const tauri = await loadAdapter();
    invoke.mockResolvedValueOnce(null);
    expect(await tauri.settings.getSettings()).toEqual(DEFAULT_SETTINGS);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    invoke.mockRejectedValueOnce(new Error('store broken'));
    expect(await tauri.settings.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves the complete settings object', async () => {
    const tauri = await loadAdapter();
    invoke.mockResolvedValueOnce(undefined);
    await tauri.settings.setSettings(DEFAULT_SETTINGS);
    expect(invoke).toHaveBeenLastCalledWith('set_settings', { settings: DEFAULT_SETTINGS });
  });
});

describe('tauri adapter: auth', () => {
  it('reads the token from Rust once and caches it', async () => {
    const tauri = await loadAdapter();
    invoke.mockResolvedValue('rust-token');
    expect(await tauri.auth.getSessionToken()).toBe('rust-token');
    expect(await tauri.auth.getSessionToken()).toBe('rust-token');
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('get_session_token', undefined);
  });

  it('does not persist tokens to localStorage', async () => {
    const tauri = await loadAdapter();
    tauri.auth.setSessionToken('abc');
    expect(localStorage.getItem('api-token')).toBeNull();
    expect(await tauri.auth.getSessionToken()).toBe('abc');
  });

  it('yields null when the command fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const tauri = await loadAdapter();
    invoke.mockRejectedValueOnce(new Error('no token'));
    expect(await tauri.auth.getSessionToken()).toBeNull();
  });
});

describe('tauri adapter: credentials', () => {
  it('uses the Rust command and argument names', async () => {
    const tauri = await loadAdapter();
    invoke.mockResolvedValue({ id: 'c1' });
    const input = { name: 'n', type: 'postgresql' as const, host: 'h', port: 1, database: 'd', username: 'u', password: 'p' };

    await tauri.credentials.list();
    expect(invoke).toHaveBeenLastCalledWith('list_connections', undefined);
    await tauri.credentials.get('c1');
    expect(invoke).toHaveBeenLastCalledWith('get_connection', { id: 'c1' });
    await tauri.credentials.create(input);
    expect(invoke).toHaveBeenLastCalledWith('create_connection', { input });
    await tauri.credentials.update('c1', { host: 'h2' });
    expect(invoke).toHaveBeenLastCalledWith('update_connection', { id: 'c1', input: { host: 'h2' } });
    await tauri.credentials.delete('c1');
    expect(invoke).toHaveBeenLastCalledWith('delete_connection', { id: 'c1' });
    await tauri.credentials.test('c1');
    expect(invoke).toHaveBeenLastCalledWith('test_connection', { id: 'c1' });
    await tauri.credentials.resolve('c1');
    expect(invoke).toHaveBeenLastCalledWith('resolve_connection', { id: 'c1' });
  });

  it('reports availability false when the command errors', async () => {
    const tauri = await loadAdapter();
    invoke.mockRejectedValueOnce(new Error('nope'));
    expect(await tauri.credentials.isAvailable()).toBe(false);
  });

  it('sends proxy requests through backend_request and rebuilds the Response', async () => {
    const tauri = await loadAdapter();
    invoke.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: [['content-type', 'application/json']],
      body: '{"rows":1}',
    });
    const res = await tauri.credentials.fetch('http://localhost:25811/api/datasource/preview', {
      method: 'POST',
      body: '{"source":"loom-connection://abc"}',
    });
    expect(await res.json()).toEqual({ rows: 1 });
    expect(invoke).toHaveBeenLastCalledWith('backend_request', {
      request: {
        url: 'http://localhost:25811/api/datasource/preview',
        method: 'POST',
        headers: {},
        body: '{"source":"loom-connection://abc"}',
      },
    });
  });
});

describe('tauri adapter: initialize', () => {
  it('enables the credential proxy when Rust reports it', async () => {
    const tauri = await loadAdapter();
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_session_token') return 'tok';
      if (cmd === 'is_encryption_available') return true;
      if (cmd === 'connection_proxy_available') return true;
      return null;
    });
    await tauri.initialize();
    expect(tauri.capabilities.secureStorage).toBe(true);
    expect(tauri.capabilities.credentialProxy).toBe(true);
  });

  it('leaves the proxy off when the command is missing or false', async () => {
    const tauri = await loadAdapter();
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'connection_proxy_available') throw new Error('unknown command');
      return cmd === 'is_encryption_available' ? true : null;
    });
    await tauri.initialize();
    expect(tauri.capabilities.credentialProxy).toBe(false);
  });
});

describe('tauri adapter: menu', () => {
  it('registers no listener', async () => {
    const tauri = await loadAdapter();
    expect(tauri.menu.onMenuAction(() => {})).toBeUndefined();
  });
});
