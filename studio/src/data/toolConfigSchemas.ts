/**
 * Machine-readable config schemas for each tool type.
 *
 * These describe what configuration fields each tool accepts, their types,
 * valid values, and descriptions.  Useful for:
 * - AI agents (knowing what configs to produce)
 * - Form validation
 * - Documentation generation
 * - Import/export validation
 *
 * Schemas are intentionally kept separate from TOOL_DEFINITIONS to avoid
 * coupling the tool registry to schema concerns.
 */

// -------------------------------------------------------------------
// Schema types
// -------------------------------------------------------------------

export interface FieldSchema {
  /** Human-readable description of the field */
  description: string;
  /** Data type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  /** Whether the field must be set for the tool to function */
  required?: boolean;
  /** Default value (should match the tool's defaultConfig) */
  default?: unknown;
  /** For enum type - allowed values */
  enum?: readonly string[];
  /** For array type - schema of each element */
  items?: FieldSchema | Record<string, FieldSchema>;
  /** For object type - nested field schemas */
  properties?: Record<string, FieldSchema>;
}

export interface ToolConfigSchema {
  type: string;
  description: string;
  fields: Record<string, FieldSchema>;
}

// -------------------------------------------------------------------
// Schemas
// -------------------------------------------------------------------

const INPUT_SCHEMA: ToolConfigSchema = {
  type: 'Input',
  description: 'Load data from a file or database connection.',
  fields: {
    category: {
      description: 'Source category',
      type: 'enum',
      enum: ['file', 'connection'] as const,
      required: true,
    },
    type: {
      description: 'File format type (when category is "file")',
      type: 'enum',
      enum: ['csv', 'parquet', 'xlsx', 'json', 'yxdb'] as const,
    },
    source: {
      description: 'File path or connection identifier',
      type: 'string',
      required: true,
    },
    hasHeader: {
      description: 'Whether the first row is a header (CSV/Excel)',
      type: 'boolean',
      default: true,
    },
    delimiter: {
      description: 'Column delimiter character (CSV only)',
      type: 'string',
      default: ',',
    },
    sheet: {
      description: 'Sheet name or index (Excel only)',
      type: 'string',
    },
    connectionId: {
      description: 'Database connection ID (when category is "connection")',
      type: 'string',
    },
    query: {
      description: 'SQL query (when category is "connection")',
      type: 'string',
    },
    table: {
      description: 'Table name (when category is "connection")',
      type: 'string',
    },
  },
};

const OUTPUT_SCHEMA: ToolConfigSchema = {
  type: 'Output',
  description: 'Write data to a file.',
  fields: {
    type: {
      description: 'Output file format',
      type: 'enum',
      enum: ['csv', 'parquet', 'xlsx', 'json'] as const,
    },
    path: {
      description: 'Output file path',
      type: 'string',
      required: true,
    },
    delimiter: {
      description: 'Column delimiter (CSV only)',
      type: 'string',
      default: ',',
    },
    includeHeader: {
      description: 'Include header row (CSV only)',
      type: 'boolean',
      default: true,
    },
  },
};

const FILTER_SCHEMA: ToolConfigSchema = {
  type: 'Filter',
  description: 'Filter rows based on conditions. Has two outputs: matching rows (True) and non-matching rows (False).',
  fields: {
    mode: {
      description: 'Configuration mode. Do not set manually - it is set automatically.',
      type: 'enum',
      enum: ['Basic', 'Custom'] as const,
      default: 'Basic',
    },
    expression: {
      description: 'Polars filter expression. Auto-generated from conditions - do not set manually.',
      type: 'string',
      default: '',
    },
    conditions: {
      description: 'Filter conditions (Basic mode). Set conditions here and the expression will be auto-generated.',
      type: 'array',
      items: {
        column: { description: 'Column name to filter on', type: 'string', required: true },
        operator: {
          description: 'Comparison operator',
          type: 'enum',
          enum: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_null', 'is_not_null'] as const,
          required: true,
        },
        value: { description: 'Value to compare against (omit for is_null/is_not_null)', type: 'string' },
      },
      default: [],
    },
    groups: {
      description: 'Sub-groups for complex logic. Each group has its own conditions and combinator. Top-level conditions and groups are combined by the top-level combinator. Example: to express (A) AND (B OR C), put A in conditions and B,C in a group with combinator "or".',
      type: 'array',
      items: {
        conditions: { description: 'Conditions within the group', type: 'array' },
        combinator: { description: 'How to combine conditions within the group (and/or)', type: 'enum', enum: ['and', 'or'] as const },
      },
      default: [],
    },
    combinator: {
      description: 'How to combine top-level conditions and groups',
      type: 'enum',
      enum: ['and', 'or'] as const,
      default: 'and',
    },
  },
};

const SELECT_SCHEMA: ToolConfigSchema = {
  type: 'Select',
  description: 'Select, reorder, rename, or change the type of columns.',
  fields: {
    columnConfigs: {
      description: 'Column configuration array',
      type: 'array',
      items: {
        column: { description: 'Source column name', type: 'string', required: true },
        rename: { description: 'New name for the column (optional)', type: 'string' },
        type: { description: 'Cast to a new data type (optional)', type: 'string' },
        selected: { description: 'Whether to include this column in output', type: 'boolean', default: true },
      },
      default: [],
    },
  },
};

const SORT_SCHEMA: ToolConfigSchema = {
  type: 'Sort',
  description: 'Sort rows by one or more columns.',
  fields: {
    sortColumns: {
      description: 'Columns to sort by, in priority order',
      type: 'array',
      items: {
        column: { description: 'Column name', type: 'string', required: true },
        order: { description: 'Sort direction', type: 'enum', enum: ['ascending', 'descending'] as const, required: true },
      },
      default: [],
      required: true,
    },
  },
};

const FORMULA_SCHEMA: ToolConfigSchema = {
  type: 'Formula',
  description: 'Create or transform columns using Polars expressions.',
  fields: {
    operations: {
      description: 'List of formula operations to apply',
      type: 'array',
      items: {
        expression: { description: 'Polars expression that produces the column value', type: 'string', required: true },
        column_name: { description: 'Name of the output column (new or existing to overwrite)', type: 'string', required: true },
      },
      default: [],
    },
    expression: {
      description: 'Single expression (legacy, prefer operations array)',
      type: 'string',
      default: '',
    },
    column_name: {
      description: 'Single column name (legacy, prefer operations array)',
      type: 'string',
      default: '',
    },
  },
};

const SAMPLE_SCHEMA: ToolConfigSchema = {
  type: 'Sample',
  description: 'Take a sample of rows from the data.',
  fields: {
    mode: {
      description: 'Sampling mode',
      type: 'enum',
      enum: ['FirstN', 'LastN', 'Random', 'Percent', 'Offset'] as const,
      default: 'FirstN',
      required: true,
    },
    n: {
      description: 'Number of rows (for FirstN, LastN, Random)',
      type: 'number',
      default: 100,
    },
    percent: {
      description: 'Percentage of rows (for Percent mode)',
      type: 'number',
      default: 10.0,
    },
    offset: {
      description: 'Row offset to start from (for Offset mode)',
      type: 'number',
      default: 0,
    },
    seed: {
      description: 'Random seed for reproducibility (Random/Percent modes)',
      type: 'number',
      default: null as unknown as undefined,
    },
  },
};

const UNIQUE_SCHEMA: ToolConfigSchema = {
  type: 'Unique',
  description: 'Deduplicate rows. Has two outputs: unique rows and duplicate rows.',
  fields: {
    columns: {
      description: 'Columns to check for uniqueness (empty = all columns)',
      type: 'array',
      items: { description: 'Column name', type: 'string' },
      default: [],
    },
    mode: {
      description: 'Which row to keep when duplicates are found',
      type: 'enum',
      enum: ['First', 'Last', 'None'] as const,
      default: 'First',
    },
  },
};

const UNION_SCHEMA: ToolConfigSchema = {
  type: 'Union',
  description: 'Combine multiple datasets vertically (stack rows). Accepts multiple inputs.',
  fields: {
    mode: {
      description: 'How to match columns across inputs',
      type: 'enum',
      enum: ['ByName', 'ByPosition'] as const,
      default: 'ByName',
      required: true,
    },
  },
};

const JOIN_SCHEMA: ToolConfigSchema = {
  type: 'Join',
  description: 'Join two datasets on matching key columns. Has three outputs: left-only, matched, and right-only rows.',
  fields: {
    joinType: {
      description: 'Type of join',
      type: 'enum',
      enum: ['inner', 'left', 'right', 'outer', 'cross'] as const,
      default: 'inner',
      required: true,
    },
    leftKeys: {
      description: 'Key columns from the left (L) input',
      type: 'array',
      items: { description: 'Column name', type: 'string' },
      default: [],
      required: true,
    },
    rightKeys: {
      description: 'Key columns from the right (R) input',
      type: 'array',
      items: { description: 'Column name', type: 'string' },
      default: [],
      required: true,
    },
  },
};

const SUMMARIZE_SCHEMA: ToolConfigSchema = {
  type: 'Summarize',
  description: 'Group rows and compute aggregate statistics.',
  fields: {
    groupByColumns: {
      description: 'Columns to group by',
      type: 'array',
      items: { description: 'Column name', type: 'string' },
      default: [],
    },
    aggregations: {
      description: 'Aggregation operations to compute per group',
      type: 'array',
      items: {
        column: { description: 'Column to aggregate', type: 'string', required: true },
        operation: {
          description: 'Aggregation function',
          type: 'enum',
          enum: ['Sum', 'Mean', 'Min', 'Max', 'Count', 'CountDistinct', 'First', 'Last', 'Median', 'Std', 'Var'] as const,
          required: true,
        },
        outputName: { description: 'Name for the result column', type: 'string', required: true },
      },
      required: true,
    },
    includeNulls: {
      description: 'Whether to include null values in group-by columns',
      type: 'boolean',
      default: false,
    },
  },
};

const PIVOT_SCHEMA: ToolConfigSchema = {
  type: 'Pivot',
  description: 'Reshape data from long to wide format.',
  fields: {
    on: {
      description: 'Column whose unique values become new column headers',
      type: 'string',
      required: true,
    },
    index: {
      description: 'Columns to keep as row identifiers',
      type: 'array',
      items: { description: 'Column name', type: 'string' },
      required: true,
    },
    values: {
      description: 'Column whose values fill the new columns',
      type: 'string',
      required: true,
    },
    aggregateFunction: {
      description: 'Aggregation function for conflicting values',
      type: 'enum',
      enum: ['first', 'sum', 'mean', 'min', 'max', 'count', 'last', 'median'] as const,
      default: 'first',
    },
  },
};

const UNPIVOT_SCHEMA: ToolConfigSchema = {
  type: 'Unpivot',
  description: 'Reshape data from wide to long format.',
  fields: {
    on: {
      description: 'Columns to unpivot (their names become values in the variable column)',
      type: 'array',
      items: { description: 'Column name', type: 'string' },
      required: true,
    },
    index: {
      description: 'Columns to keep as identifiers (not unpivoted)',
      type: 'array',
      items: { description: 'Column name', type: 'string' },
    },
    variableName: {
      description: 'Name of the new column containing original column names',
      type: 'string',
      default: 'variable',
    },
    valueName: {
      description: 'Name of the new column containing the values',
      type: 'string',
      default: 'value',
    },
  },
};

// -------------------------------------------------------------------
// Registry
// -------------------------------------------------------------------

const SCHEMAS: ToolConfigSchema[] = [
  INPUT_SCHEMA,
  OUTPUT_SCHEMA,
  FILTER_SCHEMA,
  SELECT_SCHEMA,
  SORT_SCHEMA,
  FORMULA_SCHEMA,
  SAMPLE_SCHEMA,
  UNIQUE_SCHEMA,
  UNION_SCHEMA,
  JOIN_SCHEMA,
  SUMMARIZE_SCHEMA,
  PIVOT_SCHEMA,
  UNPIVOT_SCHEMA,
];

const schemasByType = new Map<string, ToolConfigSchema>(
  SCHEMAS.map((s) => [s.type, s]),
);

/**
 * Get the config schema for a specific tool type.
 * Returns undefined if the tool type has no schema defined.
 */
export function getToolConfigSchema(type: string): ToolConfigSchema | undefined {
  return schemasByType.get(type);
}

/**
 * Get all tool config schemas.
 */
export function getAllToolConfigSchemas(): ToolConfigSchema[] {
  return SCHEMAS;
}

/**
 * List available tool types with their descriptions.
 */
export function listToolTypes(): Array<{ type: string; description: string }> {
  return SCHEMAS.map((s) => ({ type: s.type, description: s.description }));
}
