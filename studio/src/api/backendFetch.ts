/**
 * fetch for requests to the Server that may carry client-owned connections.
 *
 * Requests whose body contains a `loom-connection://<id>` reference go
 * through the desktop shell, which swaps the reference for the real
 * connection URI (credentials included) and forwards the request to the
 * bundled server. The renderer therefore never sees the credentials. All
 * other requests use plain fetch.
 */

import { platform } from '@platform';
import { CONNECTION_REF_PREFIX } from '../platform/connectionUri';

export function bodyHasConnectionRef(init?: RequestInit): boolean {
  return typeof init?.body === 'string' && init.body.includes(CONNECTION_REF_PREFIX);
}

export async function backendFetch(url: string, init?: RequestInit): Promise<Response> {
  if (platform.capabilities.credentialProxy && bodyHasConnectionRef(init)) {
    return platform.credentials.fetch(url, init);
  }
  return fetch(url, init);
}
