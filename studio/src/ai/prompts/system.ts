/**
 * System Prompt — Workflow Agent
 *
 * Constructs the system prompt for the agentic workflow builder.
 *
 * **Token optimization**: The prompt is split into static and dynamic sections.
 * Static instructions (tool reference, rules) are cacheable across turns.
 * Dynamic context (canvas state, formula catalog) is injected only when relevant.
 * The formula catalog is conditionally included only when the canvas uses or
 * may need Formula tools.
 */

import type { Tool, Wire, WorkflowMeta } from '@domain/workflow/entities/workflow';
import { listToolTypes } from '@data/toolConfigSchemas';
import { buildFormulaCatalogForPrompt } from './formulaCatalog';

// ---------------------------------------------------------------------------
// Static prompt sections (cacheable, identical across turns)
// ---------------------------------------------------------------------------

const STATIC_INSTRUCTIONS = `You are an AI assistant embedded in Sigilweaver Loom Studio, a visual data pipeline builder. You help users create data workflows by adding and configuring tools on a canvas.

## How to Build Workflows

**For new workflows** (empty canvas), use \`build_workflow\` with a spec — it handles IDs, sockets, wiring, and layout automatically. The response includes an \`idMap\` and a **data profile** for the first Read tool.

**For modifying existing workflows**, use \`add_tool\` with \`after\` to add and connect in one step. Layout is automatic. When connected, \`add_tool\` returns an **inline preview** (up to 5 rows as CSV).

### Key Patterns
- **Data format**: Compact text (CSV rows, one-line profiles), typed headers like \`ColName:type?\`
- **Finding files**: Use \`search_files\` before building — never guess paths
- **Column names are case-sensitive**: Usually lowercase. Use names from profiles/metadata only.
- **Two-phase builds**: search_files → build_workflow (Read only) → read profile → add_tool with exact column names
- **Branching**: Fan-out from Read — do NOT chain Aggregates in series (columns get dropped)
- **Batch builds**: Use \`batch_canvas_ops\` to add+connect multiple tools in one call. Assign \`refId\` strings to reference new tools within the same batch (e.g. add tool with refId "t1", then connect from "t1" to another). Layout runs once at the end.

## Rules
1. Column names are case-sensitive — use exact names from data profiles/metadata
2. Right tool for the job: Aggregate (type: "Summarize") for aggregation, Formula for row-level math, Filter for row selection
3. Build reproducible pipelines — never calculate values yourself, add tools instead
4. Use \`add_tool\` with \`after\` (auto-connects, auto-layouts)
5. Handle errors — if preview fails, read the error, adjust config, retry
6. Explain briefly between tool calls
7. Use \`ask_user\` when genuinely ambiguous — ask BEFORE building, not after
8. ALWAYS add comments to every tool — a workflow without comments is incomplete`;

const TOOL_CONFIG_REFERENCE = `## Tool Config Reference

**Input**: \`{ "category": "file", "type": "csv", "source": "/path/to/file.csv" }\` — types: csv, parquet, yxdb, xlsx, json
**Filter**: \`{ "conditions": [{ "column": "col", "operator": "gt", "value": "18" }], "combinator": "and" }\` — Operators: eq, neq, gt, lt, gte, lte, contains, not_contains, starts_with, ends_with, is_null, is_not_null. Nested: add \`groups\` array.
**Aggregate** (type: "Summarize"): \`{ "groupByColumns": ["cat"], "aggregations": [{ "column": "amt", "operation": "Sum", "outputName": "total" }] }\` — Ops: Sum, Mean, Count, Min, Max, Median, Std, First, Last, CountDistinct
**Formula**: Prefer structured ops: \`{ "operations": [{ "operationId": "divide", "sourceColumn": "total", "params": { "mode": "column", "operand": "qty" }, "columnName": "unit_price" }] }\` — Raw Polars fallback: \`{ "operations": [{ "column_name": "result", "expression": "pl.col('a') / pl.col('b').sum()" }] }\`
**Sort**: \`{ "sortColumns": [{ "column": "created_at", "order": "descending" }] }\`
**Join**: \`{ "joinType": "inner", "leftKeys": ["customer_id"], "rightKeys": ["id"] }\` — Types: inner, left, right, outer, cross. Sockets: input-left, input-right, output-match (default), output-left, output-right. ALWAYS set keys.
**Output**: \`{ "type": "csv", "path": "/path/to/output.csv" }\`

## Sockets
Most tools: input → output. Non-default: Filter: output-true (default), output-false | Join: input-left, input-right, output-match (default) | Unique: output-unique (default), output-duplicate`;

/**
 * Short tail reminder appended after dynamic context.
 * Reinforces critical rules without repeating the full prompt.
 */
const TAIL_REMINDER = `

Remember: column names are case-sensitive (usually lowercase), always add comments, use structured tool configs, never calculate values yourself.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for the workflow agent.
 * Includes current canvas state so the agent can see what already exists.
 *
 * Token optimization:
 * - Static instructions are separated from dynamic context for Anthropic cache control
 * - Formula catalog is only included when relevant (canvas has Formula tools, or canvas is empty/small)
 * - Canvas state uses compact serialization (truncated configs, abbreviated IDs)
 * - Tail reminder reinforces key rules in ~20 tokens instead of repeating full instructions
 */
export function buildWorkflowSystemPrompt(
  tools: Tool[],
  wires: Wire[],
  meta: WorkflowMeta,
  options?: { auditEnabled?: boolean },
): string {
  const parts: string[] = [];

  // 1. Static instructions (cacheable)
  parts.push(STATIC_INSTRUCTIONS);

  // 2. Audit notice (conditional)
  if (options?.auditEnabled) {
    parts.push('\n9. **Your work will be audited** — A separate model will review your output. Ensure correct tool types, connections, and comments.');
  }

  // 3. Available tool types (semi-static, changes rarely)
  const toolTypeSummary = listToolTypes()
    .map((t) => `  - ${t.type}: ${t.description}`)
    .join('\n');
  parts.push(`\n## Available Tool Types\n\n${toolTypeSummary}`);

  // 4. Tool config reference (static)
  parts.push(`\n${TOOL_CONFIG_REFERENCE}`);

  // 5. Formula catalog (conditional — only when relevant)
  // Include when: canvas is empty (new workflow), has <10 tools (early building), or has Formula tools
  const hasFormulaTools = tools.some((t) => t.type === 'Formula');
  const includeFormulaCatalog = tools.length === 0 || tools.length < 10 || hasFormulaTools;
  if (includeFormulaCatalog) {
    const formulaCatalog = buildFormulaCatalogForPrompt();
    parts.push(`\nAvailable Formula operations (use operationId):\n${formulaCatalog}`);
  }

  // 6. Dynamic canvas context
  const canvasContext = tools.length > 0
    ? `\nCurrent canvas has ${tools.length} tool(s) and ${wires.length} wire(s):\n${formatCanvasState(tools, wires)}`
    : '\nCanvas is empty — no tools or wires yet.';
  parts.push(`\n## Current Workflow\n\nName: ${meta.name}${canvasContext}`);

  // 7. Tail reminder (compact rule reinforcement)
  parts.push(TAIL_REMINDER);

  return parts.join('\n');
}

/**
 * Get just the static portion of the system prompt (for Anthropic cache control).
 * This is the content that doesn't change between turns and can be cached.
 */
export function getStaticPromptPrefix(): string {
  return STATIC_INSTRUCTIONS;
}

/**
 * Recursively strip UI-only `_id` keys from config values before serialization.
 * These are generated for React list keys (e.g., Summarize groupByColumns/aggregations)
 * and waste tokens in the system prompt.
 */
function stripInternalIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripInternalIds);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '_id') continue;
      result[k] = stripInternalIds(v);
    }
    return result;
  }
  return value;
}

/**
 * Format current canvas state for inclusion in the system prompt.
 * Uses compact serialization: abbreviated IDs, truncated config values,
 * and tool comments for faster agent comprehension.
 */
function formatCanvasState(tools: Tool[], wires: Wire[]): string {
  // Keys that are UI-internal duplicates or not useful to the agent
  const HIDDEN_CONFIG_KEYS = new Set(['_emit', 'actions', 'conditionGroup', 'mode', 'placeholder']);
  // Max chars for a single config value (truncate long expressions/arrays)
  const MAX_VALUE_LEN = 80;

  const toolLines = tools.map((t) => {
    const configEntries = Object.entries(t.config)
      .filter(([k]) => !HIDDEN_CONFIG_KEYS.has(k));

    // Compact config: key=value pairs, values truncated
    const configParts: string[] = [];
    for (const [k, v] of configEntries) {
      const raw = JSON.stringify(stripInternalIds(v));
      const value = raw.length > MAX_VALUE_LEN
        ? raw.slice(0, MAX_VALUE_LEN) + '...'
        : raw;
      configParts.push(`${k}=${value}`);
    }
    const configStr = configParts.join(', ') || '(default)';
    const commentStr = t.comment ? ` // ${t.comment}` : '';
    return `  [${t.id.slice(0, 8)}] ${t.type} — ${configStr}${commentStr}`;
  });

  const wireLines = wires.map((w) => {
    const fromTool = tools.find((t) => t.id === w.from.tool);
    const toTool = tools.find((t) => t.id === w.to.tool);
    const fromLabel = fromTool ? `${fromTool.type}[${w.from.tool.slice(0, 8)}]` : w.from.tool.slice(0, 8);
    const toLabel = toTool ? `${toTool.type}[${w.to.tool.slice(0, 8)}]` : w.to.tool.slice(0, 8);
    return `  ${fromLabel}.${w.from.socket} → ${toLabel}.${w.to.socket}`;
  });

  return `Tools:\n${toolLines.join('\n')}\nWires:\n${wireLines.length > 0 ? wireLines.join('\n') : '  (none)'}`;
}
