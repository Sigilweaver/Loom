import { describe, it, expect } from 'vitest';
import {
  getToolConfigSchema,
  getAllToolConfigSchemas,
  listToolTypes,
} from '../toolConfigSchemas';
import { TOOL_DEFINITIONS } from '../tools';

describe('toolConfigSchemas', () => {
  it('has a schema for every tool definition', () => {
    const schemas = getAllToolConfigSchemas();
    const schemaTypes = new Set(schemas.map((s) => s.type));

    for (const def of TOOL_DEFINITIONS) {
      expect(
        schemaTypes.has(def.type),
        `Missing config schema for tool type: ${def.type}`,
      ).toBe(true);
    }
  });

  it('getToolConfigSchema returns the correct schema', () => {
    const filterSchema = getToolConfigSchema('Filter');
    expect(filterSchema).toBeDefined();
    expect(filterSchema!.type).toBe('Filter');
    expect(filterSchema!.fields).toHaveProperty('expression');
    expect(filterSchema!.fields).toHaveProperty('conditions');
    expect(filterSchema!.fields).toHaveProperty('mode');
    expect(filterSchema!.fields).toHaveProperty('combinator');
  });

  it('getToolConfigSchema returns undefined for unknown types', () => {
    expect(getToolConfigSchema('NonExistent')).toBeUndefined();
  });

  it('every schema has a description', () => {
    for (const schema of getAllToolConfigSchemas()) {
      expect(
        schema.description.length,
        `${schema.type} schema has empty description`,
      ).toBeGreaterThan(0);
    }
  });

  it('every schema has at least one field', () => {
    for (const schema of getAllToolConfigSchemas()) {
      expect(
        Object.keys(schema.fields).length,
        `${schema.type} schema has no fields`,
      ).toBeGreaterThan(0);
    }
  });

  it('every field has a description and type', () => {
    for (const schema of getAllToolConfigSchemas()) {
      for (const [fieldName, field] of Object.entries(schema.fields)) {
        expect(
          field.description.length,
          `${schema.type}.${fieldName} has empty description`,
        ).toBeGreaterThan(0);
        expect(
          ['string', 'number', 'boolean', 'array', 'object', 'enum'],
          `${schema.type}.${fieldName} has invalid type: ${field.type}`,
        ).toContain(field.type);
      }
    }
  });

  it('enum fields have valid enum arrays', () => {
    for (const schema of getAllToolConfigSchemas()) {
      for (const [fieldName, field] of Object.entries(schema.fields)) {
        if (field.type === 'enum') {
          expect(
            Array.isArray(field.enum) && field.enum.length > 0,
            `${schema.type}.${fieldName} is enum type but has no enum values`,
          ).toBe(true);
        }
      }
    }
  });

  it('listToolTypes returns type and description for all tools', () => {
    const types = listToolTypes();
    expect(types.length).toBe(getAllToolConfigSchemas().length);
    for (const t of types) {
      expect(t.type).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });

  describe('schema field consistency with defaultConfig', () => {
    for (const def of TOOL_DEFINITIONS) {
      it(`${def.type}: schema fields cover defaultConfig keys`, () => {
        const schema = getToolConfigSchema(def.type);
        if (!schema) return; // Already caught by the "has a schema" test

        // Check that all non-internal defaultConfig keys appear in the schema
        // (skip 'placeholder' which is a temporary standin)
        for (const key of Object.keys(def.defaultConfig)) {
          if (key === 'placeholder' || key.startsWith('_')) continue;
          expect(
            schema.fields,
            `${def.type} schema missing field for defaultConfig key "${key}"`,
          ).toHaveProperty(key);
        }
      });
    }
  });

  describe('individual tool schemas', () => {
    it('Filter schema has correct mode enum', () => {
      const schema = getToolConfigSchema('Filter')!;
      expect(schema.fields.mode!.enum).toContain('Basic');
      expect(schema.fields.mode!.enum).toContain('Custom');
    });

    it('Join schema has correct joinType enum', () => {
      const schema = getToolConfigSchema('Join')!;
      expect(schema.fields.joinType!.enum).toContain('inner');
      expect(schema.fields.joinType!.enum).toContain('left');
      expect(schema.fields.joinType!.enum).toContain('outer');
    });

    it('Summarize aggregation operations include common functions', () => {
      const schema = getToolConfigSchema('Summarize')!;
      const aggField = schema.fields.aggregations!;
      expect(aggField.type).toBe('array');
      const items = aggField.items as Record<string, { enum?: readonly string[] }>;
      const ops = items.operation!.enum!;
      expect(ops).toContain('Sum');
      expect(ops).toContain('Mean');
      expect(ops).toContain('Count');
      expect(ops).toContain('Min');
      expect(ops).toContain('Max');
    });

    it('Sample schema has all sampling modes', () => {
      const schema = getToolConfigSchema('Sample')!;
      expect(schema.fields.mode!.enum).toContain('FirstN');
      expect(schema.fields.mode!.enum).toContain('Random');
      expect(schema.fields.mode!.enum).toContain('Percent');
    });

    it('Input schema has file and connection categories', () => {
      const schema = getToolConfigSchema('Input')!;
      expect(schema.fields.category!.enum).toContain('file');
      expect(schema.fields.category!.enum).toContain('connection');
    });
  });
});
