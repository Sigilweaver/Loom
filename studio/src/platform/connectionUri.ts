/**
 * Connection URIs and connection references.
 *
 * A connection reference (`loom-connection://<id>`) stands in for a stored
 * client connection inside a request body. The renderer only ever handles
 * references; the desktop shell swaps them for real connection URIs (with
 * credentials) immediately before forwarding the request to the bundled
 * server, then redacts the credentials from the response. See
 * `credentialFetch.ts` for the renderer side and `electron/backendProxy.ts` /
 * `tauri/src/commands/proxy.rs` for the shell side.
 *
 * This module is pure (no DOM, no Electron) so it is shared by the renderer
 * and the Electron main process.
 */

import type { DatabaseType } from '../types/connections';

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

/** The fields needed to build a URI (a resolved connection). */
export interface UriConnection {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/**
 * Build a connection URI from a resolved connection.
 *
 * - PostgreSQL / MySQL: `scheme://user:password@host:port/database`
 * - SQLite: `sqlite://<path>` (no credentials; `database` is the file path)
 * - SQL Server: `mssql://user:password@host:port/database?encrypt=true&trust_server_certificate=true`
 */
export function buildConnectionUri(connection: UriConnection): string {
  const encodedPassword = encodeURIComponent(connection.password);
  const encodedUsername = encodeURIComponent(connection.username);

  switch (connection.type) {
    case 'sqlite': {
      const encodedPath = encodeURIComponent(connection.database).replace(/%2F/g, '/');
      return `sqlite://${encodedPath}`;
    }
    case 'mssql':
      return `mssql://${encodedUsername}:${encodedPassword}@${connection.host}:${connection.port}/${connection.database}?encrypt=true&trust_server_certificate=true`;
    default:
      return `${connection.type}://${encodedUsername}:${encodedPassword}@${connection.host}:${connection.port}/${connection.database}`;
  }
}

/** A resolved connection as seen by the shell: the URI plus secrets to scrub. */
export interface ResolvedRef {
  uri: string;
  /** Strings that must never reach the renderer (raw and encoded secrets). */
  secrets: string[];
}

export interface SubstitutionResult {
  body: string;
  /** Everything that must be redacted from the response. */
  secrets: string[];
  /** Number of references replaced. */
  replaced: number;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isRecord(value: unknown): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Replace connection references in a JSON request body.
 *
 * Substitution is deliberately narrow: only a whole string value equal to a
 * reference is replaced, and only in the two places the server accepts a
 * connection URI: the top-level `source` (datasource endpoints) and
 * `config.source` of database Input tools (workflow endpoints, under either
 * `workflow.tools` or `tools`). A reference anywhere else (a name, a comment,
 * a file path) is left as-is, so a compromised page cannot use a reference to
 * make the server echo credentials into a field it controls.
 *
 * Unknown ids are left untouched and the server rejects them.
 */
export function substituteConnectionRefs(
  body: string,
  resolve: (id: string) => ResolvedRef | null
): SubstitutionResult {
  if (!body.includes(CONNECTION_REF_PREFIX)) {
    return { body, secrets: [], replaced: 0 };
  }

  let parsed: Json;
  try {
    parsed = JSON.parse(body) as Json;
  } catch {
    return { body, secrets: [], replaced: 0 };
  }

  const secrets: string[] = [];
  let replaced = 0;

  const swap = (holder: Record<string, Json>): void => {
    const id = parseConnectionRef(holder.source);
    if (!id) return;
    const resolved = resolve(id);
    if (!resolved) return;
    holder.source = resolved.uri;
    secrets.push(resolved.uri, ...resolved.secrets);
    replaced += 1;
  };

  const swapTools = (container: Json | undefined): void => {
    if (!isRecord(container) || !Array.isArray(container.tools)) return;
    for (const tool of container.tools) {
      if (!isRecord(tool) || tool.type !== 'Input' || !isRecord(tool.config)) continue;
      if (tool.config.category !== 'database') continue;
      swap(tool.config);
    }
  };

  if (isRecord(parsed)) {
    swap(parsed);
    swapTools(parsed);
    swapTools(parsed.workflow);
  }

  if (replaced === 0) {
    return { body, secrets: [], replaced: 0 };
  }
  return { body: JSON.stringify(parsed), secrets, replaced };
}

/** Secrets worth scrubbing for one connection: raw and encoded password. */
export function secretsFor(connection: UriConnection): string[] {
  const out = new Set<string>();
  if (connection.password) {
    out.add(connection.password);
    out.add(encodeURIComponent(connection.password));
    // JSON-escaped form, as it would appear inside an echoed JSON string.
    out.add(JSON.stringify(connection.password).slice(1, -1));
  }
  return [...out].filter((s) => s.length >= 4);
}

/** Replace every occurrence of a secret in `text` with a marker. */
export function redactSecrets(text: string, secrets: string[]): string {
  let out = text;
  // Longest first so a URI is redacted whole before its password fragment.
  for (const secret of [...new Set(secrets)].sort((a, b) => b.length - a.length)) {
    if (!secret) continue;
    out = out.split(secret).join('[redacted]');
  }
  return out;
}
