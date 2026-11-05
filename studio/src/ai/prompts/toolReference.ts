/**
 * Tool config reference for the workflow agent's system prompt.
 *
 * The examples are data, not prose, so tests can check every key and enum
 * value against `toolConfigSchemas.ts` (which is itself checked against the
 * Server's config models). Display names, socket IDs and allowed values are
 * read from the tool registry and schemas rather than restated by hand.
 */

import { TOOL_DEFINITIONS } from '@data/tools';
import { getToolConfigSchema, type FieldSchema } from '@data/toolConfigSchemas';
import { defaultOutputSocket } from '../tools/toolTypes';

export interface ToolConfigExample {
  /** Internal tool type (the value for `type` in add_tool / build_workflow). */
  type: string;
  /** Example configs in the shape the agent should send. */
  examples: Record<string, unknown>[];
  /** Short guidance appended after the examples. */
  notes?: string;
  /** Schema enum fields whose allowed values are listed after the examples. */
  listEnums?: string[];
}

export const TOOL_CONFIG_EXAMPLES: ToolConfigExample[] = [
  {
    type: 'Input',
    examples: [
      { category: 'file', type: 'csv', source: '/data/sales.csv' },
      { category: 'database', type: 'postgresql', connectionId: 'conn-id-from-list_database_connections', query: 'SELECT id, amount FROM orders' },
    ],
    notes: 'Use exact paths from search_files.',
    listEnums: ['type'],
  },
  {
    type: 'Output',
    examples: [{ type: 'csv', destination: '/data/out/result.csv' }],
    listEnums: ['type'],
  },
  {
    type: 'Filter',
    examples: [
      { conditions: [{ column: 'age', operator: 'gte', value: '18' }], combinator: 'and' },
      {
        conditions: [{ column: 'status', operator: 'eq', value: 'active' }],
        groups: [{ conditions: [{ column: 'tier', operator: 'eq', value: 'gold' }, { column: 'spend', operator: 'gt', value: '1000' }], combinator: 'or' }],
        combinator: 'and',
      },
    ],
    notes: 'The expression is generated from the conditions; do not write it. Values are strings. Rows that fail go to output-false.',
  },
  {
    type: 'Select',
    examples: [{ columnConfigs: [{ name: 'id' }, { name: 'amt', rename: 'amount', targetType: 'Float64' }, { name: 'notes', selected: false }] }],
    notes: 'Only listed columns with selected=true are kept, in list order. Omit columnConfigs to pass everything through.',
  },
  {
    type: 'Sort',
    examples: [{ sortColumns: [{ column: 'created_at', direction: 'desc' }, { column: 'id', direction: 'asc', nullsFirst: false }] }],
  },
  {
    type: 'Formula',
    examples: [
      { operations: [{ operationId: 'divide', sourceColumn: 'total', params: { mode: 'column', operand: 'qty' }, columnName: 'unit_price' }] },
      { operations: [{ column_name: 'margin', expression: '(pl.col("revenue") - pl.col("cost")) / pl.col("revenue")' }] },
    ],
    notes: 'Prefer structured operations (operationId from the catalog below); use a raw Polars expression only when no operation fits. Reusing an existing column name overwrites it.',
  },
  {
    type: 'Sample',
    examples: [{ mode: 'FirstN', n: 100 }, { mode: 'RandomPercent', percent: 10, seed: 42 }],
    listEnums: ['mode'],
  },
  {
    type: 'Unique',
    examples: [{ columns: ['customer_id'], mode: 'First' }],
    notes: 'Empty columns means all columns. Duplicates go to output-duplicate.',
  },
  {
    type: 'Union',
    examples: [{ mode: 'ByName' }],
    notes: 'Connect every input to the single "input" socket.',
  },
  {
    type: 'Join',
    examples: [{ joinType: 'inner', leftKeys: ['customer_id'], rightKeys: ['id'] }],
    notes: 'ALWAYS set leftKeys and rightKeys (same length); empty keys produce a cross join. Wire the inputs to input-left and input-right.',
    listEnums: ['joinType'],
  },
  {
    type: 'Summarize',
    examples: [{ groupByColumns: ['region'], aggregations: [{ column: 'amount', operation: 'Sum', outputName: 'total_amount' }, { column: 'order_id', operation: 'CountDistinct', outputName: 'orders' }] }],
    notes: 'Output has only the group-by columns and the aggregations.',
    listEnums: ['aggregations.operation'],
  },
  {
    type: 'Pivot',
    examples: [{ index: ['region'], on: 'month', values: 'sales', aggregateFunction: 'sum' }],
    listEnums: ['aggregateFunction'],
  },
  {
    type: 'Unpivot',
    examples: [{ index: ['id'], on: ['q1', 'q2', 'q3', 'q4'], variableName: 'quarter', valueName: 'sales' }],
  },
];

/** Resolve a dotted schema path ("aggregations.operation") to its field. */
export function resolveSchemaField(type: string, path: string): FieldSchema | undefined {
  const schema = getToolConfigSchema(type);
  if (!schema) return undefined;
  const [head, ...rest] = path.split('.');
  let field: FieldSchema | undefined = schema.fields[head!];
  for (const key of rest) {
    if (!field?.items || 'type' in field.items) return undefined;
    field = (field.items as Record<string, FieldSchema>)[key];
  }
  return field;
}

function socketSummary(type: string): string {
  const def = TOOL_DEFINITIONS.find((d) => d.type === type);
  if (!def) return '';
  const inputs = def.sockets.filter((s) => s.direction === 'input').map((s) => s.id);
  const outputs = def.sockets.filter((s) => s.direction === 'output').map((s) => s.id);
  if (inputs.length <= 1 && outputs.length <= 1) return '';
  const defaultOut = defaultOutputSocket(def);
  const fmt = (ids: string[], dflt: string | undefined) => ids.map((id) => (id === dflt ? `${id} (default)` : id)).join(', ');
  return ` Sockets: in ${fmt(inputs, inputs[0]) || 'none'}; out ${fmt(outputs, defaultOut) || 'none'}.`;
}

/** Build the "Tool Config Reference" section of the system prompt. */
export function buildToolConfigReference(): string {
  const lines: string[] = ['## Tool Config Reference', ''];
  lines.push('Use the internal `type` (left) in tool calls. The canvas shows the display name in parentheses. Sockets default to "input" and "output".');
  lines.push('');
  for (const entry of TOOL_CONFIG_EXAMPLES) {
    const def = TOOL_DEFINITIONS.find((d) => d.type === entry.type);
    const display = def && def.name !== def.type ? ` ("${def.name}")` : '';
    const examples = entry.examples.map((e) => `\`${JSON.stringify(e)}\``).join(' or ');
    const enums = (entry.listEnums ?? [])
      .map((path) => {
        const values = resolveSchemaField(entry.type, path)?.enum;
        return values ? ` ${path.split('.').pop()}: ${values.join(', ')}.` : '';
      })
      .join('');
    const notes = entry.notes ? ` ${entry.notes}` : '';
    lines.push(`**${entry.type}**${display}: ${examples}.${enums}${notes}${socketSummary(entry.type)}`);
  }
  lines.push('');
  lines.push('Call get_tool_config_schema for every field of a tool type.');
  return lines.join('\n');
}
