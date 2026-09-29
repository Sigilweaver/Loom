import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../types/settings';
import { webPlatform } from '../web';

beforeEach(() => {
  localStorage.clear();
});

describe('web adapter', () => {
  it('advertises no native capabilities', () => {
    expect(webPlatform.name).toBe('web');
    expect(webPlatform.capabilities).toEqual({
      secureStorage: false,
      nativeDialogs: false,
      credentialProxy: false,
    });
  });

  it('cannot read or write by path and shows no dialogs', async () => {
    await expect(webPlatform.files.readFile('/x')).rejects.toThrow(/browser mode/);
    await expect(webPlatform.files.writeFile('/x', '')).rejects.toThrow(/browser mode/);
    expect(await webPlatform.files.showOpenDialog()).toBeNull();
    expect(await webPlatform.files.showSaveDialog()).toBeNull();
  });

  it('persists settings in localStorage', async () => {
    expect(await webPlatform.settings.getSettings()).toEqual(DEFAULT_SETTINGS);
    await webPlatform.settings.setSettings({ ...DEFAULT_SETTINGS, author: 'Web' });
    expect((await webPlatform.settings.getSettings()).author).toBe('Web');
  });

  it('keeps the API token in localStorage', async () => {
    webPlatform.auth.setSessionToken('tok');
    expect(localStorage.getItem('api-token')).toBe('tok');
    expect(await webPlatform.auth.getSessionToken()).toBe('tok');
    webPlatform.auth.setSessionToken(null);
    expect(localStorage.getItem('api-token')).toBeNull();
  });

  it('has no client credential storage', async () => {
    expect(await webPlatform.credentials.isAvailable()).toBe(false);
    expect(await webPlatform.credentials.list()).toEqual([]);
    expect(await webPlatform.credentials.get('x')).toBeNull();
    expect(await webPlatform.credentials.resolve('x')).toBeNull();
    expect((await webPlatform.credentials.test('x')).success).toBe(false);
    await expect(webPlatform.credentials.create({} as never)).rejects.toThrow(/browser mode/);
    await expect(webPlatform.credentials.update('x', {})).rejects.toThrow(/browser mode/);
    await expect(webPlatform.credentials.delete('x')).rejects.toThrow(/browser mode/);
    await expect(webPlatform.credentials.fetch('http://x/api')).rejects.toThrow(/browser mode/);
  });

  it('initializes without error', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(webPlatform.initialize()).resolves.toBeUndefined();
  });
});
