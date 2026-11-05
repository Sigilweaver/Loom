/**
 * Connection references.
 *
 * A connection reference (`loom-connection://<id>`) stands in for a stored
 * client connection inside a request body. The renderer only ever handles
 * references; the desktop shell swaps them for real connection URIs (with
 * credentials) immediately before forwarding the request to the Server, then
 * redacts the credentials from the response. See `src/api/backendFetch.ts`
 * for the renderer side and `tauri/src/commands/proxy.rs` for the shell side,
 * which also owns building connection URIs.
 *
 * This module is pure (no DOM, no shell APIs) and is used by the renderer.
 */

/** URI scheme used for connection references. */
export const CONNECTION_REF_PREFIX = 'loom-connection://';

const REF_PATTERN = /^loom-connection:\/\/([A-Za-z0-9_-]{1,64})$/;

/** Build a connection reference for a stored connection id. */
export function connectionRef(id: string): string {
  return `${CONNECTION_REF_PREFIX}${id}`;
}

/** Extract the connection id from a reference, or null if it is not one. */
export function parseConnectionRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = REF_PATTERN.exec(value);
  return match?.[1] ?? null;
}
