import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPlatformCapabilities, mockPlatformCredentials } from '../../test-setup';
import { backendFetch, bodyHasConnectionRef } from '../backendFetch';

describe('backendFetch', () => {
  const plainFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', plainFetch);
    plainFetch.mockResolvedValue(new Response('{}'));
    mockPlatformCapabilities.credentialProxy = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockPlatformCapabilities.credentialProxy = false;
  });

  const refBody = JSON.stringify({ source: 'loom-connection://abc-123' });

  it('detects connection references in string bodies', () => {
    expect(bodyHasConnectionRef({ body: refBody })).toBe(true);
    expect(bodyHasConnectionRef({ body: '{"a":1}' })).toBe(false);
    expect(bodyHasConnectionRef({ body: new Blob(['loom-connection://x']) })).toBe(false);
    expect(bodyHasConnectionRef(undefined)).toBe(false);
  });

  it('routes reference-bearing requests through the shell when the proxy is available', async () => {
    mockPlatformCapabilities.credentialProxy = true;
    mockPlatformCredentials.fetch.mockResolvedValue(new Response('{"proxied":true}'));
    const init = { method: 'POST', body: refBody };

    const res = await backendFetch('http://localhost:25811/api/x', init);

    expect(await res.json()).toEqual({ proxied: true });
    expect(mockPlatformCredentials.fetch).toHaveBeenCalledWith('http://localhost:25811/api/x', init);
    expect(plainFetch).not.toHaveBeenCalled();
  });

  it('uses plain fetch for requests without references even when the proxy is available', async () => {
    mockPlatformCapabilities.credentialProxy = true;
    await backendFetch('http://localhost:25811/api/x', { method: 'POST', body: '{"a":1}' });
    expect(plainFetch).toHaveBeenCalledTimes(1);
    expect(mockPlatformCredentials.fetch).not.toHaveBeenCalled();
  });

  it('uses plain fetch when the shell has no proxy', async () => {
    await backendFetch('http://localhost:25811/api/x', { method: 'POST', body: refBody });
    expect(plainFetch).toHaveBeenCalledTimes(1);
    expect(mockPlatformCredentials.fetch).not.toHaveBeenCalled();
  });
});
