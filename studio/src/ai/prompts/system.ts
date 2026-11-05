/**
 * System Prompt - Workflow Agent
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
import { buildToolConfigReference } from './toolReference';

// ---------------------------------------------------------------------------
// Static prompt sections (cacheable, identical across turns)
// ---------------------------------------------------------------------------

const STATIC_INSTRUCTIONS = `You are an AI assistant embedded in Sigilweaver Loom Studio, a visual data pipeline builder. You help users create data workflows by adding and configuring tools on a canvas.

## How to Build Workflows

**For new workflows** (empty canvas), use \`build_workflow\` with a spec - it handles IDs, sockets, wiring, and layout automatically. The response includes an \`idMap\` and a **data profile** for the first Input tool.

**For modifying existing workflows**, use \`add_tool\` with \`after\` to add and connect in one step. Layout is automatic. When connected, \`add_tool\` returns an **inline preview** (up to 5 rows as CSV when sample data sharing is on; otherwise row count and schema).

### Key Patterns
- **Data format**: Compact text (CSV rows, one-line profiles), typed headers like \`ColName:type?\`
- **Tool IDs**: Use the exact IDs shown in brackets on the canvas or returned by tool calls
- **Finding files**: Use \`search_files\` before building - never guess paths
- **Column names are case-sensitive**: Use names exactly as they appear in profiles/metadata.
- **Two-phase builds**: search_files -> build_workflow (Input only) -> read profile -> add_tool with exact column names
- **Branching**: Fan-out from the Input - do NOT chain Summarize tools in series (columns get dropped)
- **Batch builds**: Use \`batch_canvas_ops\` to add+connect multiple tools in one call. Assign \`refId\` strings to reference new tools within the same batch (e.g. add tool with refId "t1", then connect from "t1" to another). Layout runs once at the end.

### Editing Existing Workflows
- **Change one field**: Use \`patch_tool_config\` with a path (e.g. \`conditions.0.value\`) to amend a single nested field. Do NOT resend the whole config via \`update_tool\` - patching saves tokens and leaves sibling fields untouched.
- **Add a step in the middle**: Use \`insert_tool_between\` to splice a tool onto an existing wire (A->B becomes A->new->B). Do NOT remove and rebuild the downstream nodes.
- Only touch the tools that need to change - leave unrelated nodes alone.
- **Destructive edits**: Removing tools and replacing a non-empty canvas may ask the user for approval. If they decline, do not retry; ask what they want instead.

### Checking Your Work
- **Before finishing**: Call \`validate_workflow\` after building or editing. It reports structural problems and runs every tool on the Server, returning row counts and columns per output. Fix what it reports, then validate again.
- **Read a full config**: The canvas summary truncates long values; call \`get_tool_config\` before patching a field you cannot see in full.
- **Unsure of a field**: Call \`get_tool_config_schema\` for every field of a tool type.

### Databases
- **Discover connections**: Use \`list_database_connections\` to get a \`connectionId\`. Never guess connection ids.
- **Learn the schema first**: Use \`describe_schema\` to list tables and columns before writing SQL - use exact table/column names from it.
- **Run read-only queries**: Use \`query_database\` to validate a SELECT against the real database. Only SELECT is allowed; DDL/DML is rejected.

## Rules
1. Column names are case-sensitive - use exact names from data profiles/metadata
2. Right tool for the job: Summarize for aggregation, Formula for row-level math, Filter for row selection
3. Build reproducible pipelines - never calculate values yourself, add tools instead
4. Use \`add_tool\` with \`after\` (auto-connects, auto-layouts)
5. Handle errors - if a preview or validation fails, read the error, adjust the config, and retry; do not repeat an identical failing call
6. Explain briefly between tool calls
7. Use \`ask_user\` when genuinely ambiguous - ask BEFORE building, not after
8. ALWAYS add comments to every tool - a workflow without comments is incomplete`;

/**
 * Short tail reminder appended after dynamic context.
 * Reinforces critical rules without repeating the full prompt.
 */
const TAIL_REMINDER = `

Remember: column names are case-sensitive and must match the data exactly, always add comments, use structured tool configs, never calculate values yourself.`;

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
 * - Canvas state uses compact serialization (truncated config values, full IDs)
 * - Tail reminder reinforces key rules in ~20 tokens instead of repeating full instructions
 */
export function buildWorkflowSystemPrompt(
  tools: Tool[],
  wires: Wire[],
  meta: WorkflowMeta,
  options?: { auditEnabled?: boolean; shareSampleData?: boolean },
): string {
  const { stable, dynamic } = buildWorkflowSystemPromptParts(tools, wires, meta, options);
  return `${stable}\n${dynamic}`;
}

/**
 * Same prompt as {@link buildWorkflowSystemPrompt}, split at the point where
 * it starts depending on the live canvas. `stable` is identical across turns
 * (until the formula catalog toggles), so it can carry a provider cache
 * breakpoint; `dynamic` holds the canvas state and changes after every edit.
 */
export function buildWorkflowSystemPromptParts(
  tools: Tool[],
  wires: Wire[],
  meta: WorkflowMeta,
  options?: { auditEnabled?: boolean; shareSampleData?: boolean },
): { stable: string; dynamic: string } {
  const parts: string[] = [];

  // 1. Static instructions (cacheable)
  parts.push(STATIC_INSTRUCTIONS);

  // 2. Audit notice (conditional)
  if (options?.auditEnabled) {
    parts.push('\n9. **Your work will be audited** - A separate model will review your output. Ensure correct tool types, connections, and comments.');
  }

  // 3. Available tool types (semi-static, changes rarely)
  const toolTypeSummary = listToolTypes()
    .map((t) => `  - ${t.type}: ${t.description}`)
    .join('\n');
  parts.push(`\n## Available Tool Types\n\n${toolTypeSummary}`);

  // 4. Tool config reference (generated from the schemas and tool registry)
  parts.push(`\n${buildToolConfigReference()}`);

  // 5. Formula catalog (conditional - only when relevant)
  // Include when: canvas is empty (new workflow), has <10 tools (early building), or has Formula tools
  const hasFormulaTools = tools.some((t) => t.type === 'Formula');
  const includeFormulaCatalog = tools.length === 0 || tools.length < 10 || hasFormulaTools;
  if (includeFormulaCatalog) {
    const formulaCatalog = buildFormulaCatalogForPrompt();
    parts.push(`\nAvailable Formula operations (use operationId):\n${formulaCatalog}`);
  }

  const stable = parts.join('\n');
  parts.length = 0;

  // 6. Dynamic canvas context
  const canvasContext = tools.length > 0
    ? `\nCurrent canvas has ${tools.length} tool(s) and ${wires.length} wire(s):\n${formatCanvasState(tools, wires)}`
    : '\nCanvas is empty - no tools or wires yet.';
  parts.push(`\n## Current Workflow\n\nName: ${meta.name}${canvasContext}`);

  // Data sharing (dynamic: the user can toggle it between turns)
  parts.push(options?.shareSampleData
    ? '\nData sharing: sample rows and value statistics are available in tool results.'
    : '\nData sharing: the user has not enabled sample data sharing. Tool results show column names, types and counts but no values. Do not guess values; ask the user when a filter or mapping needs one.');

  // 7. Tail reminder (compact rule reinforcement)
  parts.push(TAIL_REMINDER);

  return { stable, dynamic: parts.join('\n') };
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
export function stripInternalIds(value: unknown): unknown {
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

/** Canvas summaries longer than this switch to the compact one-line-per-tool form. */
export const CANVAS_DETAIL_CHAR_BUDGET = 12_000;

/** Config keys that only drive the Studio UI and duplicate other keys. */
const HIDDEN_CONFIG_KEYS = new Set(['_emit', 'actions', 'conditionGroup', 'placeholder']);
/** `mode` is UI-only for these types (Basic/Custom editors); elsewhere it matters. */
const UI_MODE_TYPES = new Set(['Filter', 'Formula']);
/** Max chars for a single config value (long expressions/arrays are truncated). */
const MAX_VALUE_LEN = 80;

function formatToolDetailed(t: Tool): string {
  const configParts: string[] = [];
  for (const [k, v] of Object.entries(t.config)) {
    if (HIDDEN_CONFIG_KEYS.has(k) || (k === 'mode' && UI_MODE_TYPES.has(t.type))) continue;
    const raw = JSON.stringify(stripInternalIds(v));
    configParts.push(`${k}=${raw.length > MAX_VALUE_LEN ? `${raw.slice(0, MAX_VALUE_LEN)}...` : raw}`);
  }
  const commentStr = t.comment ? ` // ${t.comment}` : '';
  return `  [${t.id}] ${t.type} - ${configParts.join(', ') || '(default)'}${commentStr}`;
}

function formatToolCompact(t: Tool): string {
  return `  [${t.id}] ${t.type}${t.comment ? ` // ${t.comment}` : ''}`;
}

/**
 * Format current canvas state for inclusion in the system prompt.
 *
 * Full IDs are always shown (the agent passes them back verbatim). Configs
 * are shown as truncated key=value pairs; when that would exceed
 * {@link CANVAS_DETAIL_CHAR_BUDGET} the summary drops configs and points the
 * agent at get_tool_config, so large workflows do not crowd out the
 * conversation.
 */
export function formatCanvasState(tools: Tool[], wires: Wire[]): string {
  const wireLines = wires.map((w) => {
    const fromTool = tools.find((t) => t.id === w.from.tool);
    const toTool = tools.find((t) => t.id === w.to.tool);
    const fromLabel = fromTool ? `${fromTool.type}[${w.from.tool}]` : w.from.tool;
    const toLabel = toTool ? `${toTool.type}[${w.to.tool}]` : w.to.tool;
    return `  ${fromLabel}.${w.from.socket} -> ${toLabel}.${w.to.socket}`;
  });
  const wiresText = `Wires:\n${wireLines.length > 0 ? wireLines.join('\n') : '  (none)'}`;

  const detailed = `Tools:\n${tools.map(formatToolDetailed).join('\n')}\n${wiresText}`;
  if (detailed.length <= CANVAS_DETAIL_CHAR_BUDGET) {
    return `${detailed}\nLong config values end in "..."; use get_tool_config to read one in full.`;
  }
  return `Tools (large workflow: configs omitted, use get_tool_config to read one):\n` +
    `${tools.map(formatToolCompact).join('\n')}\n${wiresText}`;
}
