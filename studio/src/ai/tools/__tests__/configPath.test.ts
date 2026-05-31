import { describe, it, expect } from 'vitest';
import { parseConfigPath, setConfigPath, removeConfigPath } from '../configPath';

describe('parseConfigPath', () => {
  it('splits dotted paths', () => {
    expect(parseConfigPath('a.b.c')).toEqual(['a', 'b', 'c']);
  });

  it('treats numeric segments as array indices', () => {
    expect(parseConfigPath('conditions.0.value')).toEqual(['conditions', 0, 'value']);
  });

  it('normalizes bracket notation', () => {
    expect(parseConfigPath('aggregations[1].operation')).toEqual([
      'aggregations',
      1,
      'operation',
    ]);
  });

  it('drops empty segments', () => {
    expect(parseConfigPath('a..b.')).toEqual(['a', 'b']);
  });
});

describe('setConfigPath', () => {
  it('sets a nested array element without touching siblings', () => {
    const config: Record<string, unknown> = {
      combinator: 'and',
      conditions: [
        { column: 'age', operator: 'gt', value: '18' },
        { column: 'state', operator: 'eq', value: 'CA' },
      ],
    };
    setConfigPath(config, 'conditions.0.value', '21');
    expect(config).toEqual({
      combinator: 'and',
      conditions: [
        { column: 'age', operator: 'gt', value: '21' },
        { column: 'state', operator: 'eq', value: 'CA' },
      ],
    });
  });

  it('creates intermediate objects and arrays', () => {
    const config: Record<string, unknown> = {};
    setConfigPath(config, 'sortColumns.0.order', 'descending');
    expect(config).toEqual({ sortColumns: [{ order: 'descending' }] });
  });

  it('sets a top-level scalar', () => {
    const config: Record<string, unknown> = { joinType: 'inner' };
    setConfigPath(config, 'joinType', 'left');
    expect(config.joinType).toBe('left');
  });

  it('throws on an empty path', () => {
    expect(() => setConfigPath({}, '', 1)).toThrow();
  });
});

describe('removeConfigPath', () => {
  it('splices an array element', () => {
    const config: Record<string, unknown> = {
      conditions: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
    };
    removeConfigPath(config, 'conditions.1');
    expect(config).toEqual({ conditions: [{ value: 'a' }, { value: 'c' }] });
  });

  it('deletes an object key', () => {
    const config: Record<string, unknown> = { keep: 1, drop: 2 };
    removeConfigPath(config, 'drop');
    expect(config).toEqual({ keep: 1 });
  });

  it('no-ops on a missing path', () => {
    const config: Record<string, unknown> = { a: { b: 1 } };
    removeConfigPath(config, 'a.x.y');
    expect(config).toEqual({ a: { b: 1 } });
  });
});
