/**
 * AI tool-config drift tests.
 *
 * The agent writes tool configs from `toolConfigSchemas.ts` and the prompt
 * examples in `prompts/toolReference.ts`. These tests check both against the
 * Server's own config models, snapshotted in `__fixtures__/serverToolContract.json`
 * by `server/tests/test_ai_tool_contract.py` (which fails when the snapshot is
 * stale). A key or enum value the Server does not read is a silent bug: the
 * Server ignores it and runs with its default.
 */

import { describe, expect, it } from 'vitest';
import contract from '../__fixtures__/serverToolContract.json';
import { getAllToolConfigSchemas, getToolConfigSchema, type FieldSchema } from '@data/toolConfigSchemas';
import { TOOL_DEFINITIONS } from '@data/tools';
import { TOOL_CONFIG_EXAMPLES, buildToolConfigReference, resolveSchemaField } from '../prompts/toolReference';
import { enrichToolConfig } from '../tools/canvas';

interface JsonSchema {
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  anyOf?: JsonSchema[];
  enum?: string[];
  const?: string;
  required?: string[];
  additionalProperties?: boolean;
}

const serverSchemas = contract.configSchemas as unknown as Record<string, JsonSchema | null>;

/**
 * Keys Studio writes that the Server's config model does not declare, with
 * the reason each is allowed. Anything not listed here must exist on the
 * Server side.
 */
const STUDIO_ONLY_KEYS: Record<string, string> = {
  // Agent input only: Filter enrichment folds `groups` into conditionGroup
  // and drops the key (checked by the enrichment test below).
  'Filter.groups': 'agent input, removed by enrichment',
  // Formula structured operations: Studio fills expression/column_name.
  'Formula.operations.operationId': 'structured op, resolved by Studio',
  'Formula.operations.sourceColumn': 'structured op, resolved by Studio',
  'Formula.operations.params': 'structured op, resolved by Studio',
  'Formula.operations.columnName': 'structured op, copied to column_name by Studio',
};

const editorStateKeys = contract.editorStateKeys as Record<string, string[]>;
const forwardsExtraConfig = contract.forwardsExtraConfig as Record<string, boolean>;

/**
 * Top-level keys the Server accepts without a run warning beyond its model
 * fields: Studio editor state, and anything for tools that forward extra
 * keys to their reader or writer (BaseTool.unknown_config_keys).
 */
function serverIgnoresTopLevelKey(toolType: string, key: string): boolean {
  return key.startsWith('_') || forwardsExtraConfig[toolType] === true || (editorStateKeys[toolType] ?? []).includes(key);
}

/**
 * Enum values Studio writes that the Server model does not list, with reason.
 */
const STUDIO_ONLY_ENUM_VALUES: Record<string, string[]> = {
  // The Join UI writes "cross" when no keys are set and the Server executes it
  // (join.py treats joinType "cross" as a cross join), but JoinToolConfig's
  // Literal omits it.
  'Join.joinType': ['cross'],
};

function deref(schema: JsonSchema, root: JsonSchema): JsonSchema {
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop()!;
    return root.$defs?.[name] ?? schema;
  }
  if (schema.anyOf) {
    const nonNull = schema.anyOf.find((s) => (s as { type?: string }).type !== 'null');
    if (nonNull) return deref(nonNull, root);
  }
  return schema;
}

/** Server-accepted values for a field that the Server keeps as a plain string. */
const SERVER_VALUE_SETS: Record<string, string[]> = {
  'Input.type': contract.values.inputTypes,
  'Output.type': contract.values.outputTypes,
  'Summarize.aggregations.operation': contract.values.summarizeOperations,
  'Pivot.aggregateFunction': contract.values.pivotAggregations,
};

function checkFields(
  toolType: string,
  path: string,
  fields: Record<string, FieldSchema>,
  server: JsonSchema | undefined,
  root: JsonSchema,
  problems: string[],
): void {
  for (const [key, field] of Object.entries(fields)) {
    const fullPath = `${toolType}.${path ? `${path}.` : ''}${key}`;
    const serverField = server?.properties?.[key] ? deref(server.properties[key]!, root) : undefined;
    if (!serverField) {
      if (!path && serverIgnoresTopLevelKey(toolType, key)) continue;
      if (!(fullPath in STUDIO_ONLY_KEYS)) {
        problems.push(`${fullPath}: not declared by the Server config model`);
      }
      continue;
    }

    if (field.enum) {
      const allowed = serverField.enum
        ?? (serverField.const !== undefined ? [serverField.const] : undefined)
        ?? SERVER_VALUE_SETS[fullPath];
      if (allowed) {
        const extra = STUDIO_ONLY_ENUM_VALUES[fullPath] ?? [];
        for (const v of field.enum) {
          if (!allowed.includes(v) && !extra.includes(v)) {
            problems.push(`${fullPath}: value "${v}" not accepted by the Server (${allowed.join(', ')})`);
          }
        }
      }
    }

    if (field.items && !('type' in field.items) && serverField.items) {
      const serverItem = deref(serverField.items, root);
      checkFields(toolType, path ? `${path}.${key}` : key, field.items as Record<string, FieldSchema>, serverItem, root, problems);
    }
  }
}

describe('Studio tool schemas vs Server config models', () => {
  it('covers exactly the Server tool types', () => {
    const studio = getAllToolConfigSchemas().map((s) => s.type).sort();
    expect(studio).toEqual([...contract.toolTypes].sort());
    expect(TOOL_DEFINITIONS.map((d) => d.type).sort()).toEqual([...contract.toolTypes].sort());
  });

  it('only uses keys and enum values the Server reads', () => {
    const problems: string[] = [];
    for (const schema of getAllToolConfigSchemas()) {
      const server = serverSchemas[schema.type];
      expect(server, `no Server config model for ${schema.type}`).toBeTruthy();
      checkFields(schema.type, '', schema.fields, server!, server!, problems);
    }
    expect(problems).toEqual([]);
  });

  it('enum values for Server value sets match exactly where Studio lists them', () => {
    for (const [path, serverValues] of Object.entries(SERVER_VALUE_SETS)) {
      const [type, ...rest] = path.split('.');
      const field = resolveSchemaField(type!, rest.join('.'));
      expect(field?.enum, path).toBeDefined();
      expect([...field!.enum!].sort(), path).toEqual([...serverValues].sort());
    }
  });

  it('marks every field the Server requires as required', () => {
    const problems: string[] = [];
    for (const schema of getAllToolConfigSchemas()) {
      const server = serverSchemas[schema.type]!;
      for (const [key, prop] of Object.entries(server.properties ?? {})) {
        const resolved = deref(prop, server);
        const item = resolved.items ? deref(resolved.items, server) : undefined;
        const studioField = schema.fields[key];
        if (!item?.required || !studioField?.items || 'type' in studioField.items) continue;
        const studioItems = studioField.items as Record<string, FieldSchema>;
        for (const req of item.required) {
          if (!studioItems[req]) problems.push(`${schema.type}.${key}.${req}: required by the Server but missing in Studio`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('checks required item fields for every list-of-objects config (not vacuous)', () => {
    const checked: string[] = [];
    for (const schema of getAllToolConfigSchemas()) {
      const server = serverSchemas[schema.type]!;
      for (const [key, prop] of Object.entries(server.properties ?? {})) {
        const resolved = deref(prop, server);
        const item = resolved.items ? deref(resolved.items, server) : undefined;
        if (item?.required) checked.push(`${schema.type}.${key}`);
      }
    }
    expect(checked.sort()).toEqual(['Formula.operations', 'Select.columnConfigs', 'Sort.sortColumns']);
  });

  it('lists the allowed keys exhaustively (no stale allowlist entries)', () => {
    for (const path of Object.keys(STUDIO_ONLY_KEYS)) {
      const [type, ...rest] = path.split('.');
      expect(resolveSchemaField(type!, rest.join('.')), `${path} is allowlisted but not in toolConfigSchemas`).toBeDefined();
    }
  });
});

/** Collect key/enum problems for an example config against a Studio schema. */
function validateExample(
  toolType: string,
  value: Record<string, unknown>,
  fields: Record<string, FieldSchema>,
  path: string,
  problems: string[],
): void {
  for (const [key, v] of Object.entries(value)) {
    const field = fields[key];
    const here = `${toolType}.${path}${key}`;
    if (!field) {
      problems.push(`${here}: not in toolConfigSchemas`);
      continue;
    }
    if (field.enum && !field.enum.includes(String(v))) {
      problems.push(`${here}: "${String(v)}" not one of ${field.enum.join(', ')}`);
    }
    if (field.type === 'array' && Array.isArray(v) && field.items && !('type' in field.items)) {
      for (const item of v) {
        if (item && typeof item === 'object') {
          validateExample(toolType, item as Record<string, unknown>, field.items as Record<string, FieldSchema>, `${path}${key}[].`, problems);
        }
      }
    }
  }
}

describe('prompt Tool Config Reference', () => {
  it('has an example for every tool type', () => {
    expect(TOOL_CONFIG_EXAMPLES.map((e) => e.type).sort()).toEqual([...contract.toolTypes].sort());
  });

  it('examples only use schema keys and valid enum values', () => {
    const problems: string[] = [];
    for (const entry of TOOL_CONFIG_EXAMPLES) {
      const schema = getToolConfigSchema(entry.type)!;
      for (const example of entry.examples) {
        validateExample(entry.type, example, schema.fields, '', problems);
      }
      for (const path of entry.listEnums ?? []) {
        if (!resolveSchemaField(entry.type, path)?.enum) problems.push(`${entry.type}: listEnums "${path}" is not an enum field`);
      }
    }
    // Filter group conditions are validated by the filter enrichment, not
    // the schema (the schema types them as a plain array).
    expect(problems).toEqual([]);
  });

  it('configs the agent writes carry no key the Server would warn about', () => {
    const problems: string[] = [];
    for (const entry of TOOL_CONFIG_EXAMPLES) {
      const def = TOOL_DEFINITIONS.find((d) => d.type === entry.type)!;
      const known = new Set(Object.keys(serverSchemas[entry.type]?.properties ?? {}));
      for (const example of entry.examples) {
        const written = { ...def.defaultConfig, ...enrichToolConfig(entry.type, example) };
        for (const key of Object.keys(written)) {
          if (!known.has(key) && !serverIgnoresTopLevelKey(entry.type, key)) problems.push(`${entry.type}.${key}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('uses socket IDs that exist', () => {
    const reference = buildToolConfigReference();
    const allSockets = new Set(TOOL_DEFINITIONS.flatMap((d) => d.sockets.map((s) => s.id)));
    for (const match of reference.matchAll(/\b(input|output)-[a-z]+\b/g)) {
      expect(allSockets.has(match[0]), match[0]).toBe(true);
    }
  });

  it('names display aliases so models can map them', () => {
    const reference = buildToolConfigReference();
    expect(reference).toContain('**Summarize** ("Aggregate")');
    expect(reference).toContain('**Input** ("Read")');
  });
});

describe('Polars names in prompts and catalog', () => {
  const allowed = new Set(contract.expressions.plAllowedNames);

  it('every pl.<name> in the generated reference is allowed by the sandbox', async () => {
    const { buildWorkflowSystemPrompt } = await import('../prompts/system');
    const { buildExpressionPrompt, buildBasicFilterPrompt } = await import('../prompts/expression');
    const meta = { name: 'w', description: '', author: '', workflowId: 'x', created: '', defaultEngine: 'core/polars' };
    const texts = [
      buildWorkflowSystemPrompt([], [], meta as never),
      buildExpressionPrompt([{ name: 'a', dtype: 'Int64' }], 'x', 'Formula'),
      buildBasicFilterPrompt([{ name: 'a', dtype: 'Int64' }], 'x'),
    ];
    const bad = new Set<string>();
    for (const text of texts) {
      for (const m of text.matchAll(/\bpl\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        if (!allowed.has(m[1]!)) bad.add(m[1]!);
      }
      for (const denied of contract.expressions.deniedMethodSamples) {
        if (text.includes(`.${denied}(`)) bad.add(denied);
      }
    }
    expect([...bad]).toEqual([]);
  });

  it('every formula catalog operation compiles to allowed pl.<name> calls', async () => {
    const { ALL_OPERATIONS: FORMULA_OPERATIONS } = await import('@components/config/prepare/formulaOperations');
    const bad: string[] = [];
    for (const op of FORMULA_OPERATIONS) {
      const params: Record<string, string> = {};
      for (const p of op.params) params[p.key] = p.defaultValue ?? '1';
      const expr = op.toExpression('col_a', params);
      for (const m of expr.matchAll(/\bpl\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        if (!allowed.has(m[1]!)) bad.push(`${op.id}: pl.${m[1]}`);
      }
      for (const denied of contract.expressions.deniedMethodSamples) {
        if (expr.includes(`.${denied}(`)) bad.push(`${op.id}: .${denied}()`);
      }
    }
    expect(bad).toEqual([]);
  });
});
