/**
 * Comment Generator — auto-generates human-readable comments for tools
 * based on their type and configuration.
 *
 * Comment semantics:
 * - undefined → auto-generate from config (this module)
 * - ""        → user explicitly cleared (show nothing)
 * - "text"    → user-provided custom comment (show as-is)
 */

import type { ToolConfig } from "@domain/workflow/entities/workflow";

/**
 * Generate a human-readable comment string for a tool based on its config.
 * Returns an empty string if the config is too sparse to produce a useful comment.
 */
export function generateComment(toolType: string, config: ToolConfig): string {
  switch (toolType) {
    case "Input":
      return generateInputComment(config);
    case "Output":
      return generateOutputComment(config);
    case "Filter":
      return generateFilterComment(config);
    case "Select":
      return generateSelectComment(config);
    case "Sort":
      return generateSortComment(config);
    case "Formula":
      return generateFormulaComment(config);
    case "Sample":
      return generateSampleComment(config);
    case "Unique":
      return generateUniqueComment(config);
    case "Union":
      return generateUnionComment(config);
    case "Join":
      return generateJoinComment(config);
    case "Summarize":
      return generateSummarizeComment(config);
    case "Pivot":
      return generatePivotComment(config);
    case "Unpivot":
      return generateUnpivotComment(config);
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Per-tool generators
// ---------------------------------------------------------------------------

function generateInputComment(config: ToolConfig): string {
  const category = config.category as string | undefined;
  const type = config.type as string | undefined;

  if (category === "database") {
    const connName = config.connectionName as string | undefined;
    const query = config.query as string | undefined;
    const label = connName || type || "Database";
    if (query) {
      // Show first meaningful line of query
      const firstLine = query.trim().split("\n")[0] ?? "";
      return `${label}: ${firstLine}`;
    }
    return label;
  }

  // File-based input
  const source = config.source as string | undefined;
  if (source) {
    return extractFilename(source);
  }

  const filePath = config.filePath as string | undefined;
  if (filePath) {
    return extractFilename(filePath);
  }

  return "";
}

function generateOutputComment(config: ToolConfig): string {
  const category = config.category as string | undefined;
  const type = config.type as string | undefined;

  if (category === "database") {
    const connName = config.connectionName as string | undefined;
    const table = config.tableName as string | undefined;
    const label = connName || type || "Database";
    return table ? `${label}: ${table}` : label;
  }

  const destination = config.destination as string | undefined;
  if (destination) {
    return extractFilename(destination);
  }

  const filePath = config.filePath as string | undefined;
  if (filePath) {
    return extractFilename(filePath);
  }

  return "";
}

function generateFilterComment(config: ToolConfig): string {
  const mode = config.mode as string | undefined;

  if (mode === "Expression" || mode === "expression") {
    const expr = config.expression as string | undefined;
    return expr ?? "";
  }

  // Basic mode — conditions array
  const conditions = config.conditions as
    | Array<{ column?: string; operator?: string; value?: unknown }>
    | undefined;
  const combinator = config.combinator as string | undefined;

  if (!conditions || conditions.length === 0) return "";

  if (conditions.length === 1) {
    const c = conditions[0];
    return c ? formatCondition(c) : "";
  }

  // Multiple conditions
  const label = (combinator || "and").toUpperCase();
  return `${conditions.length} conditions (${label})`;
}

function generateSelectComment(config: ToolConfig): string {
  const cols = config.columnConfigs as
    | Array<{ column?: string; rename?: string; selected?: boolean }>
    | undefined;

  if (!cols || cols.length === 0) return "";

  const renames = cols.filter((c) => c.rename && c.rename !== c.column);
  if (renames.length === 1 && cols.length === 1) {
    const r = renames[0];
    if (r) return `${r.column} → ${r.rename}`;
  }
  if (renames.length > 0) {
    return `${cols.length} columns, ${renames.length} renamed`;
  }
  return `${cols.length} columns`;
}

function generateSortComment(config: ToolConfig): string {
  const sortCols = config.sortColumns as
    | Array<{ column?: string; direction?: string }>
    | undefined;

  if (!sortCols || sortCols.length === 0) return "";

  if (sortCols.length === 1) {
    const s = sortCols[0];
    if (!s) return "";
    const dir = (s.direction || "asc").toUpperCase();
    return s.column ? `by ${s.column} ${dir}` : "";
  }

  // Multiple sort columns — show first + count
  const first = sortCols[0];
  if (!first) return `${sortCols.length} sort keys`;
  const dir = (first.direction || "asc").toUpperCase();
  if (first.column) {
    return `by ${first.column} ${dir}, +${sortCols.length - 1} more`;
  }
  return `${sortCols.length} sort keys`;
}

function generateFormulaComment(config: ToolConfig): string {
  const ops = config.operations as
    | Array<{ column_name?: string; expression?: string }>
    | undefined;

  // Multi-operation mode
  if (ops && ops.length > 0) {
    if (ops.length === 1) {
      const op = ops[0];
      if (!op) return "";
      if (op.column_name && op.expression) {
        return `${op.column_name} = ${op.expression}`;
      }
      return op.column_name || op.expression || "";
    }
    return `${ops.length} formulas`;
  }

  // Legacy single-expression mode
  const colName = config.column_name as string | undefined;
  const expr = config.expression as string | undefined;
  if (colName && expr) {
    return `${colName} = ${expr}`;
  }
  return expr ?? "";
}

function generateSampleComment(config: ToolConfig): string {
  const mode = config.mode as string | undefined;
  const n = config.n as number | undefined;
  const percent = config.percent as number | undefined;

  switch (mode) {
    case "FirstN":
      return `First ${n ?? 100} rows`;
    case "LastN":
      return `Last ${n ?? 100} rows`;
    case "EveryN":
      return `Every ${n ?? 1} rows`;
    case "Random":
      return `Random ${n ?? 100} rows`;
    case "RandomPercent":
      return `Random ${percent ?? 10}%`;
    case "FirstPercent":
      return `First ${percent ?? 10}%`;
    default:
      return n ? `${n} rows` : "";
  }
}

function generateUniqueComment(config: ToolConfig): string {
  const cols = config.columns as unknown[] | undefined;

  if (!cols || cols.length === 0) return "All columns";

  const colNames = cols.map(safeString).filter(Boolean);
  if (colNames.length === 1) {
    return `by ${colNames[0]}`;
  }
  return `by ${colNames.length} columns`;
}

function generateUnionComment(config: ToolConfig): string {
  const mode = config.mode as string | undefined;
  return mode ? `Concatenate ${mode}` : "Concatenate by Name";
}

function generateJoinComment(config: ToolConfig): string {
  const joinType = config.joinType as string | undefined;
  const leftKeys = config.leftKeys as unknown[] | undefined;
  const rightKeys = config.rightKeys as unknown[] | undefined;

  const type = capitalize(joinType || "inner");
  const leftNames = leftKeys ? leftKeys.map(safeString).filter(Boolean) : [];
  const rightNames = rightKeys ? rightKeys.map(safeString).filter(Boolean) : [];
  const keyCount = Math.max(leftNames.length, rightNames.length);

  if (keyCount === 0) return type;

  if (keyCount === 1) {
    const key = leftNames[0] || rightNames[0] || "";
    return `${type} on ${key}`;
  }
  return `${type} on ${keyCount} keys`;
}

function generateSummarizeComment(config: ToolConfig): string {
  const groups = config.groupByColumns as unknown[] | undefined;
  const aggs = config.aggregations as
    | Array<{ column?: string; operation?: string; outputName?: string }>
    | undefined;

  if (!aggs || aggs.length === 0) return "";

  const groupNames = groups
    ? groups.map(safeString).filter(Boolean)
    : [];

  const groupLabel =
    groupNames.length > 0
      ? groupNames.length === 1
        ? `by ${groupNames[0]}`
        : `by ${groupNames.length} groups`
      : "";

  if (aggs.length === 1) {
    const a = aggs[0];
    if (!a) return "";
    const op = a.operation || "Agg";
    const col = a.column || "";
    return col ? `${op} ${col} ${groupLabel}`.trim() : op;
  }

  return `${aggs.length} aggregations ${groupLabel}`.trim();
}

function generatePivotComment(config: ToolConfig): string {
  const on = config.on as string | undefined;
  const index = config.index as unknown[] | undefined;
  const values = config.values as string | undefined;

  const parts: string[] = [];
  if (on) parts.push(on);
  if (index && index.length > 0) {
    const names = index.map(safeString).filter(Boolean);
    parts.push(`by ${names.length === 1 ? names[0] : `${names.length} cols`}`);
  }
  if (values) parts.push(`(${values})`);

  return parts.length > 0 ? `Pivot ${parts.join(" ")}` : "";
}

function generateUnpivotComment(config: ToolConfig): string {
  const on = config.on as unknown[] | undefined;

  if (!on || on.length === 0) return "";

  const names = on.map(safeString).filter(Boolean);
  if (names.length === 1) {
    return `Unpivot ${names[0]}`;
  }
  return `Unpivot ${names.length} columns`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely convert any value to a display string, avoiding [object Object] */
function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return val.map(safeString).filter(Boolean).join(", ");
  if (typeof val === "object") {
    // Try common name-like properties
    const obj = val as Record<string, unknown>;
    for (const key of ["name", "column", "label", "id", "value"]) {
      if (typeof obj[key] === "string") return obj[key];
    }
    return "";
  }
  return String(val);
}

function extractFilename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatCondition(c: {
  column?: string;
  operator?: string;
  value?: unknown;
}): string {
  if (!c.column) return "";
  const op = c.operator || "=";
  const val = c.value !== undefined && c.value !== null ? String(c.value) : "";
  if (val) {
    return `${c.column} ${op} ${val}`;
  }
  return `${c.column} ${op}`;
}
