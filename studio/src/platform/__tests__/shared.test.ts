import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../types/settings';
import {
  SETTINGS_KEY,
  TOKEN_KEY,
  createAuthOps,
  createLocalSettingsOps,
  loadSettingsFromLocalStorage,
  responseFromProxy,
  safeLocalStorage,
  toProxyRequest,
} from '../shared';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeLocalStorage', () => {
  it('reads, writes and removes values', () => {
    safeLocalStorage.set('k', 'v');
    expect(safeLocalStorage.get('k')).toBe('v');
    safeLocalStorage.remove('k');
    expect(safeLocalStorage.get('k')).toBeNull();
  });

  it('swallows storage errors instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(safeLocalStorage.get('k')).toBeNull();
    expect(() => safeLocalStorage.set('k', 'v')).not.toThrow();
    expect(() => safeLocalStorage.remove('k')).not.toThrow();
  });
});

describe('local settings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettingsFromLocalStorage()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges stored settings over defaults', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ author: 'Ada', ui: { snapToGrid: false } }));
    const settings = await createLocalSettingsOps().getSettings();
    expect(settings.author).toBe('Ada');
    expect(settings.ui.snapToGrid).toBe(false);
    expect(settings.ui.edgeStyle).toBe(DEFAULT_SETTINGS.ui.edgeStyle);
  });

  it('falls back to defaults on corrupt JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettingsFromLocalStorage()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through setSettings', async () => {
    const ops = createLocalSettingsOps();
    await ops.setSettings({ ...DEFAULT_SETTINGS, author: 'Grace' });
    expect((await ops.getSettings()).author).toBe('Grace');
  });
});

describe('createAuthOps', () => {
  it('prefers the shell token and caches it', async () => {
    const fromShell = vi.fn().mockResolvedValue('shell-token');
    const auth = createAuthOps({ fromShell, persist: true });
    localStorage.setItem(TOKEN_KEY, 'stored-token');
    expect(await auth.getSessionToken()).toBe('shell-token');
    expect(await auth.getSessionToken()).toBe('shell-token');
    expect(fromShell).toHaveBeenCalledTimes(1);
  });

  it('falls back to localStorage when the shell has no token', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token');
    const auth = createAuthOps({ fromShell: async () => null, persist: true });
    expect(await auth.getSessionToken()).toBe('stored-token');
  });

  it('treats a failing shell as no token', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const auth = createAuthOps({
      fromShell: async () => {
        throw new Error('ipc down');
      },
      persist: false,
    });
    expect(await auth.getSessionToken()).toBeNull();
  });

  it('ignores localStorage when persistence is off', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token');
    const auth = createAuthOps({ fromShell: async () => null, persist: false });
    expect(await auth.getSessionToken()).toBeNull();
  });

  it('persists set tokens only when asked to', async () => {
    const persisted = createAuthOps({ persist: true });
    persisted.setSessionToken('abc');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc');
    expect(await persisted.getSessionToken()).toBe('abc');
    persisted.setSessionToken(null);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();

    const memoryOnly = createAuthOps({ persist: false });
    memoryOnly.setSessionToken('xyz');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(await memoryOnly.getSessionToken()).toBe('xyz');
  });
});

describe('responseFromProxy', () => {
  it('rebuilds a normal response', async () => {
    const res = responseFromProxy({
      status: 201,
      statusText: 'Created',
      headers: [['content-type', 'application/json']],
      body: '{"ok":true}',
    });
    expect(res.status).toBe(201);
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('drops the body for null-body statuses instead of throwing', () => {
    const res = responseFromProxy({ status: 204, statusText: 'No Content', headers: [], body: '' });
    expect(res.status).toBe(204);
  });

  it('keeps error statuses readable', async () => {
    const res = responseFromProxy({ status: 400, statusText: 'Bad', headers: [], body: '{"detail":"nope"}' });
    expect(res.ok).toBe(false);
    expect((await res.json()).detail).toBe('nope');
  });
});

describe('toProxyRequest', () => {
  it('flattens headers and keeps string bodies', () => {
    const req = toProxyRequest('http://localhost:25811/api/x', {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: '{"a":1}',
    });
    expect(req).toEqual({
      url: 'http://localhost:25811/api/x',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
    });
  });

  it('defaults to GET with no body', () => {
    expect(toProxyRequest('http://localhost:25811/api/x')).toEqual({
      url: 'http://localhost:25811/api/x',
      method: 'GET',
      headers: {},
    });
  });

  it('rejects bodies that are not strings', () => {
    expect(() => toProxyRequest('http://x/api', { method: 'POST', body: new Blob(['x']) })).toThrow(/string/);
  });
});
