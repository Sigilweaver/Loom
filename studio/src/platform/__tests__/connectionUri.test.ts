import { describe, expect, it } from 'vitest';
import { CONNECTION_REF_PREFIX, connectionRef, parseConnectionRef } from '../connectionUri';

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
