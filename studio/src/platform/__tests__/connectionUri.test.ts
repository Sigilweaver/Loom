import { describe, expect, it } from 'vitest';
import {
  CONNECTION_REF_PREFIX,
  buildConnectionUri,
  connectionRef,
  parseConnectionRef,
  redactSecrets,
  secretsFor,
  substituteConnectionRefs,
  type ResolvedRef,
  type UriConnection,
} from '../connectionUri';

const pg: UriConnection = {
  type: 'postgresql',
  host: 'db.example.com',
  port: 5432,
  database: 'sales',
  username: 'lo om',
  password: 'p@ss/w:rd',
};

const resolver =
  (map: Record<string, UriConnection>) =>
  (id: string): ResolvedRef | null => {
    const conn = map[id];
    return conn ? { uri: buildConnectionUri(conn), secrets: secretsFor(conn) } : null;
  };

describe('buildConnectionUri', () => {
  it('encodes credentials for postgresql and mysql', () => {
    expect(buildConnectionUri(pg)).toBe(
      'postgresql://lo%20om:p%40ss%2Fw%3Ard@db.example.com:5432/sales'
    );
    expect(buildConnectionUri({ ...pg, type: 'mysql', port: 3306 })).toMatch(/^mysql:\/\//);
  });

  it('adds TLS parameters for mssql', () => {
    expect(buildConnectionUri({ ...pg, type: 'mssql', port: 1433 })).toBe(
      'mssql://lo%20om:p%40ss%2Fw%3Ard@db.example.com:1433/sales?encrypt=true&trust_server_certificate=true'
    );
  });

  it('uses only the file path for sqlite, without credentials', () => {
    const uri = buildConnectionUri({ ...pg, type: 'sqlite', database: '/data/my db.sqlite' });
    expect(uri).toBe('sqlite:///data/my%20db.sqlite');
    expect(uri).not.toContain('p%40ss');
  });
});

describe('connection references', () => {
  it('round-trips ids', () => {
    expect(connectionRef('abc-123')).toBe(`${CONNECTION_REF_PREFIX}abc-123`);
    expect(parseConnectionRef('loom-connection://abc-123')).toBe('abc-123');
  });

  it('rejects anything that is not exactly a reference', () => {
    expect(parseConnectionRef('loom-connection://')).toBeNull();
    expect(parseConnectionRef('loom-connection://a/b')).toBeNull();
    expect(parseConnectionRef('x loom-connection://abc')).toBeNull();
    expect(parseConnectionRef('postgresql://u:p@h/d')).toBeNull();
    expect(parseConnectionRef(42)).toBeNull();
    expect(parseConnectionRef(undefined)).toBeNull();
  });
});

describe('substituteConnectionRefs', () => {
  const resolve = resolver({ 'conn-1': pg });

  it('returns the body untouched when there are no references', () => {
    const body = JSON.stringify({ source: 'x' });
    expect(substituteConnectionRefs(body, resolve)).toEqual({ body, secrets: [], replaced: 0 });
  });

  it('replaces a top-level source (datasource endpoints)', () => {
    const result = substituteConnectionRefs(
      JSON.stringify({ source: connectionRef('conn-1'), sourceType: 'postgresql' }),
      resolve
    );
    expect(result.replaced).toBe(1);
    expect(JSON.parse(result.body).source).toBe(buildConnectionUri(pg));
    expect(result.secrets).toContain(buildConnectionUri(pg));
  });

  it('replaces database Input tool sources under workflow.tools', () => {
    const body = JSON.stringify({
      workflow: {
        tools: [
          { id: 't1', type: 'Input', config: { category: 'database', source: connectionRef('conn-1') } },
          { id: 't2', type: 'Input', config: { category: 'file', source: connectionRef('conn-1') } },
          { id: 't3', type: 'Filter', config: { source: connectionRef('conn-1') } },
        ],
      },
    });
    const result = substituteConnectionRefs(body, resolve);
    const tools = JSON.parse(result.body).workflow.tools;
    expect(result.replaced).toBe(1);
    expect(tools[0].config.source).toBe(buildConnectionUri(pg));
    expect(tools[1].config.source).toBe(connectionRef('conn-1'));
    expect(tools[2].config.source).toBe(connectionRef('conn-1'));
  });

  it('also handles a bare workflow body with tools at the top level', () => {
    const body = JSON.stringify({
      tools: [{ id: 't1', type: 'Input', config: { category: 'database', source: connectionRef('conn-1') } }],
    });
    expect(substituteConnectionRefs(body, resolve).replaced).toBe(1);
  });

  it('leaves unknown ids and embedded references alone', () => {
    const body = JSON.stringify({ source: connectionRef('missing'), name: connectionRef('conn-1') });
    const result = substituteConnectionRefs(body, resolve);
    expect(result.replaced).toBe(0);
    expect(result.body).toBe(body);
  });

  it('survives bodies that are not JSON', () => {
    const body = `not json ${CONNECTION_REF_PREFIX}conn-1`;
    expect(substituteConnectionRefs(body, resolve).body).toBe(body);
  });
});

describe('redactSecrets', () => {
  it('scrubs the URI and raw, encoded and JSON-escaped passwords', () => {
    const conn: UriConnection = { ...pg, password: 'pa"ss/word' };
    const uri = buildConnectionUri(conn);
    const text = [
      `connect ${uri} failed`,
      'password pa"ss/word wrong',
      `encoded ${encodeURIComponent('pa"ss/word')}`,
      `json ${JSON.stringify('pa"ss/word')}`,
    ].join('\n');
    const out = redactSecrets(text, [uri, ...secretsFor(conn)]);
    expect(out).not.toContain('pa"ss/word');
    expect(out).not.toContain(encodeURIComponent('pa"ss/word'));
    expect(out).not.toContain(uri);
    expect(out).toContain('[redacted]');
  });

  it('is a no-op without secrets', () => {
    expect(redactSecrets('hello', [])).toBe('hello');
  });

  it('ignores very short passwords to avoid mangling unrelated text', () => {
    expect(secretsFor({ ...pg, password: 'ab' })).toEqual([]);
  });
});
