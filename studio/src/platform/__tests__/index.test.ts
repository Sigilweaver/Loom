import { afterEach, describe, expect, it, vi } from 'vitest';

// test-setup.ts replaces '@platform' with a mock; load the real module.
async function loadIndex() {
  return vi.importActual<typeof import('../index')>('../index');
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  delete (window as unknown as Record<string, unknown>).__TAURI__;
  delete window.electronAPI;
});

describe('detectPlatform', () => {
  it('defaults to web', async () => {
    const { detectPlatform } = await loadIndex();
    expect(detectPlatform()).toBe('web');
  });

  it('detects Electron by the preload bridge', async () => {
    window.electronAPI = {} as NonNullable<Window['electronAPI']>;
    const { detectPlatform } = await loadIndex();
    expect(detectPlatform()).toBe('electron');
  });

  it('detects Tauri via __TAURI_INTERNALS__, which exists without withGlobalTauri', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const { detectPlatform } = await loadIndex();
    expect(detectPlatform()).toBe('tauri');
  });

  it('detects Tauri via the global __TAURI__ object as well', async () => {
    (window as unknown as Record<string, unknown>).__TAURI__ = {};
    const { detectPlatform } = await loadIndex();
    expect(detectPlatform()).toBe('tauri');
  });

  it('prefers Tauri when both bridges are present', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    window.electronAPI = {} as NonNullable<Window['electronAPI']>;
    const { detectPlatform } = await loadIndex();
    expect(detectPlatform()).toBe('tauri');
  });
});

describe('getPlatformAdapter', () => {
  it('returns the adapter matching the name', async () => {
    const { getPlatformAdapter } = await loadIndex();
    expect(getPlatformAdapter('electron').name).toBe('electron');
    expect(getPlatformAdapter('tauri').name).toBe('tauri');
    expect(getPlatformAdapter('web').name).toBe('web');
  });
});

describe('capability helpers', () => {
  it('reflect the active adapter', async () => {
    const { platform, hasNativeDialogs, hasSecureStorage } = await loadIndex();
    expect(platform.name).toBe('web');
    expect(hasNativeDialogs()).toBe(false);
    expect(hasSecureStorage()).toBe(false);
  });

  it('initializePlatform initializes the adapter and logs capabilities', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { initializePlatform, platform } = await loadIndex();
    const spy = vi.spyOn(platform, 'initialize').mockResolvedValue(undefined);
    await initializePlatform();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
