import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../types/settings';
import { electronPlatform } from '../electron';

type ElectronApi = NonNullable<Window['electronAPI']>;

function installApi(overrides: Partial<Record<keyof ElectronApi, unknown>> = {}) {
  const api = {
    saveFile: vi.fn().mockResolvedValue('/tmp/wf.swwf'),
    readFile: vi.fn().mockResolvedValue('{}'),
    showSaveDialog: vi.fn().mockResolvedValue('/tmp/wf.swwf'),
    showOpenDialog: vi.fn().mockResolvedValue('/tmp/wf.swwf'),
    getSettings: vi.fn().mockResolvedValue({ author: 'Ada', ui: { snapToGrid: false } }),
    setSettings: vi.fn().mockResolvedValue(undefined),
    getSessionToken: vi.fn().mockResolvedValue('shell-token'),
    isEncryptionAvailable: vi.fn().mockResolvedValue(true),
    listConnections: vi.fn().mockResolvedValue([]),
    getConnection: vi.fn().mockResolvedValue(null),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn().mockResolvedValue(undefined),
    resolveConnection: vi.fn().mockResolvedValue(null),
    connectionProxyAvailable: vi.fn().mockResolvedValue(false),
    backendRequest: vi.fn(),
    testConnection: vi.fn(),
    ...overrides,
  };
  window.electronAPI = api as unknown as ElectronApi;
  return api;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete window.electronAPI;
  vi.restoreAllMocks();
});

describe('electron adapter: files', () => {
  it('passes paths and content to the preload API with the right argument order', async () => {
    const api = installApi();
    await electronPlatform.files.writeFile('/tmp/wf.swwf', '{"a":1}');
    // The preload signature is saveFile(content, filename).
    expect(api.saveFile).toHaveBeenCalledWith('{"a":1}', '/tmp/wf.swwf');
    expect(await electronPlatform.files.readFile('/tmp/wf.swwf')).toBe('{}');
    expect(api.readFile).toHaveBeenCalledWith('/tmp/wf.swwf');
  });

  it('propagates rejections from the main process', async () => {
    installApi({ readFile: vi.fn().mockRejectedValue(new Error('Access denied')) });
    await expect(electronPlatform.files.readFile('/etc/passwd')).rejects.toThrow('Access denied');
  });

  it('forwards dialog options and results', async () => {
    const api = installApi({ showOpenDialog: vi.fn().mockResolvedValue(null) });
    const options = { title: 'Open', filters: [{ name: 'Workflow', extensions: ['swwf'] }] };
    expect(await electronPlatform.files.showOpenDialog(options)).toBeNull();
    expect(api.showOpenDialog).toHaveBeenCalledWith(options);
    expect(await electronPlatform.files.showSaveDialog({ defaultPath: 'a.swwf' })).toBe('/tmp/wf.swwf');
  });

  it('throws for read/write but returns null for dialogs without the bridge', async () => {
    await expect(electronPlatform.files.readFile('/x')).rejects.toThrow(/not available/);
    await expect(electronPlatform.files.writeFile('/x', '')).rejects.toThrow(/not available/);
    expect(await electronPlatform.files.showOpenDialog()).toBeNull();
    expect(await electronPlatform.files.showSaveDialog()).toBeNull();
  });
});

describe('electron adapter: settings', () => {
  it('fills in fields the stored settings predate', async () => {
    installApi();
    const settings = await electronPlatform.settings.getSettings();
    expect(settings.author).toBe('Ada');
    expect(settings.ui.snapToGrid).toBe(false);
    expect(settings.ui.edgeStyle).toBe(DEFAULT_SETTINGS.ui.edgeStyle);
    expect(settings.layout).toEqual(DEFAULT_SETTINGS.layout);
  });

  it('saves through the main process', async () => {
    const api = installApi();
    await electronPlatform.settings.setSettings(DEFAULT_SETTINGS);
    expect(api.setSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });

  it('falls back to localStorage without the bridge', async () => {
    await electronPlatform.settings.setSettings({ ...DEFAULT_SETTINGS, author: 'Local' });
    expect((await electronPlatform.settings.getSettings()).author).toBe('Local');
  });
});

describe('electron adapter: credentials', () => {
  it('lists, gets, creates, updates, deletes and tests connections via IPC', async () => {
    const info = { id: 'c1' };
    const api = installApi({
      listConnections: vi.fn().mockResolvedValue([info]),
      getConnection: vi.fn().mockResolvedValue(info),
      createConnection: vi.fn().mockResolvedValue(info),
      updateConnection: vi.fn().mockResolvedValue(info),
      testConnection: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
    });
    const input = { name: 'n', type: 'postgresql' as const, host: 'h', port: 1, database: 'd', username: 'u', password: 'p' };

    expect(await electronPlatform.credentials.list()).toEqual([info]);
    expect(await electronPlatform.credentials.get('c1')).toEqual(info);
    expect(await electronPlatform.credentials.create(input)).toEqual(info);
    expect(api.createConnection).toHaveBeenCalledWith(input);
    await electronPlatform.credentials.update('c1', { name: 'x' });
    expect(api.updateConnection).toHaveBeenCalledWith('c1', { name: 'x' });
    await electronPlatform.credentials.delete('c1');
    expect(api.deleteConnection).toHaveBeenCalledWith('c1');
    expect((await electronPlatform.credentials.test('c1')).success).toBe(true);
  });

  it('degrades gracefully without the bridge', async () => {
    expect(await electronPlatform.credentials.isAvailable()).toBe(false);
    expect(await electronPlatform.credentials.list()).toEqual([]);
    expect(await electronPlatform.credentials.get('x')).toBeNull();
    expect(await electronPlatform.credentials.resolve('x')).toBeNull();
    expect((await electronPlatform.credentials.test('x')).success).toBe(false);
    await expect(electronPlatform.credentials.create({} as never)).rejects.toThrow(/not available/);
    await expect(electronPlatform.credentials.fetch('http://localhost:25811/api/x')).rejects.toThrow(/not available/);
  });

  it('rebuilds a Response from the proxy payload', async () => {
    const api = installApi({
      backendRequest: vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: [['content-type', 'application/json']],
        body: '{"tables":[]}',
      }),
    });
    const res = await electronPlatform.credentials.fetch('http://localhost:25811/api/datasource/schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"source":"loom-connection://abc"}',
    });
    expect(await res.json()).toEqual({ tables: [] });
    expect(api.backendRequest).toHaveBeenCalledWith({
      url: 'http://localhost:25811/api/datasource/schema',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"source":"loom-connection://abc"}',
    });
  });

  it('surfaces the main process refusing plaintext resolution', async () => {
    installApi({
      resolveConnection: vi.fn().mockRejectedValue(new Error('Credentials are not available to the renderer')),
    });
    await expect(electronPlatform.credentials.resolve('c1')).rejects.toThrow(/not available to the renderer/);
  });
});

describe('electron adapter: initialize', () => {
  it('reads secure storage and credential proxy availability from the shell', async () => {
    installApi({
      isEncryptionAvailable: vi.fn().mockResolvedValue(true),
      connectionProxyAvailable: vi.fn().mockResolvedValue(true),
    });
    await electronPlatform.initialize();
    expect(electronPlatform.capabilities.secureStorage).toBe(true);
    expect(electronPlatform.capabilities.credentialProxy).toBe(true);
    expect(await electronPlatform.auth.getSessionToken()).toBe('shell-token');
  });

  it('reports no secure storage when the OS keychain is unusable', async () => {
    installApi({
      isEncryptionAvailable: vi.fn().mockResolvedValue(false),
      connectionProxyAvailable: vi.fn().mockResolvedValue(false),
    });
    await electronPlatform.initialize();
    expect(electronPlatform.capabilities.secureStorage).toBe(false);
    expect(electronPlatform.capabilities.credentialProxy).toBe(false);
  });

  it('turns every native capability off when the bridge is missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await electronPlatform.initialize();
    expect(electronPlatform.capabilities).toEqual({
      secureStorage: false,
      nativeDialogs: false,
      credentialProxy: false,
    });
  });
});
