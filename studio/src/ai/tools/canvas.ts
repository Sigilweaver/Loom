/**
 * Canvas Manipulation Tools
 *
 * Vercel AI SDK tool definitions for adding, updating, removing tools
 * and managing wires on the workflow canvas.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { useWorkflowStore } from '@state/workflowStore';
import { getToolDefinition } from '@data/tools';
import { generateUniqueId } from '@utils/id';
import { previewTool } from '@api';
import { formatAddToolResult } from '../format';
import { shareableRows } from '../dataSharing';
import { declinedResult, requestApproval } from '../approval';
import { createLogger } from '../../utils/logger';
import { generateComment } from '@domain/workflow/services/commentGenerator';
import { OPERATIONS_BY_ID } from '@components/config/prepare/formulaOperations';
import { useAIStore } from '@state/aiStore';
import { useTabStore } from '@state/tabStore';
import { setConfigPath, removeConfigPath } from './configPath';
import { defaultOutputSocket, resolveToolType, unknownToolTypeError } from './toolTypes';
import type { Tool, Wire, ToolConfig } from '@domain/workflow/entities/workflow';

const logger = createLogger('AI:CanvasTools');

// ---------------------------------------------------------------------------
// Canvas write guard - prevents agent from modifying the wrong tab's canvas
// ---------------------------------------------------------------------------

/**
 * Check that the running agent owns the currently active canvas tab.
 * Returns an error object if the tab has changed since the agent started,
 * or null if the agent is safe to proceed.
 */
function checkTabOwnership(): { success: false; error: string } | null {
  const agentTab = useAIStore.getState().agentTabId;
  if (!agentTab) return null; // No agent context (e.g. direct tool call in tests)
  const activeTab = useTabStore.getState().activeTabId;
  if (activeTab !== agentTab) {
    return {
      success: false,
      error: 'Canvas write blocked: user switched to a different tab while the agent was running. Retry when the original tab is active.',
    };
  }
  return null;
}

function describeTool(t: Tool): string {
  return `${t.type} [${t.id}]${t.comment ? ` "${t.comment}"` : ''}`;
}

/** What removing these tools affects, for the approval prompt. */
export function removalDetails(toolIds: string[]): string[] {
  const { tools, wires } = useWorkflowStore.getState();
  const removing = new Set(toolIds);
  const details = tools.filter((t) => removing.has(t.id)).map((t) => describeTool(t));
  const cut = wires.filter((w) => removing.has(w.from.tool) || removing.has(w.to.tool));
  if (cut.length > 0) details.push(`${cut.length} connection${cut.length > 1 ? 's' : ''} removed`);
  const orphaned = new Set(cut.filter((w) => removing.has(w.from.tool) && !removing.has(w.to.tool)).map((w) => w.to.tool));
  for (const id of orphaned) {
    const t = tools.find((x) => x.id === id);
    if (t) details.push(`${describeTool(t)} loses its input`);
  }
  return details;
}

// ---------------------------------------------------------------------------
// Filter expression auto-generation
// ---------------------------------------------------------------------------

interface FilterCondition {
  column: string;
  operator: string;
  value?: string;
}

interface FilterConditionGroup {
  conditions: FilterCondition[];
  combinator?: string;
}

/** Escape a value for a double-quoted Python string literal. */
function pyString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/**
 * Generate a Polars expression from a single condition. Mirrors the Filter
 * panel's Basic-mode generator (FilterExpressionBuilder) so reopening the
 * tool in the UI produces the same expression.
 */
function conditionToExpr(c: FilterCondition): string | null {
  if (!c.column) return null;
  const colRef = `pl.col(${pyString(c.column)})`;
  const val = String(c.value ?? '');
  const isNum = val.trim() !== '' && !isNaN(Number(val));
  const formatted = isNum ? val.trim() : pyString(val);
  const lit = pyString(val);

  switch (c.operator) {
    case 'eq': return `${colRef} == ${formatted}`;
    case 'neq': return `${colRef} != ${formatted}`;
    case 'gt': return `${colRef} > ${formatted}`;
    case 'lt': return `${colRef} < ${formatted}`;
    case 'gte': return `${colRef} >= ${formatted}`;
    case 'lte': return `${colRef} <= ${formatted}`;
    case 'contains': return `${colRef}.str.contains(${lit})`;
    case 'not_contains': return `~(${colRef}.str.contains(${lit}))`;
    case 'starts_with': return `${colRef}.str.starts_with(${lit})`;
    case 'ends_with': return `${colRef}.str.ends_with(${lit})`;
    case 'is_null': return `${colRef}.is_null()`;
    case 'is_not_null': return `${colRef}.is_not_null()`;
    case 'is_true': return `${colRef} == True`;
    case 'is_false': return `${colRef} == False`;
    default: return null;
  }
}

/**
 * Join expression parts with a combinator.
 */
function joinExprs(parts: string[], combinator: string): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  const op = combinator === 'or' ? '|' : '&';
  return parts.map((p) => `(${p})`).join(` ${op} `);
}

/**
 * Auto-generate a Polars expression from basic-mode filter conditions,
 * supporting nested groups for complex logic like (A) AND (B OR C).
 *
 * Schema accepted:
 * - `conditions`: flat list of conditions combined by `combinator`
 * - `groups`: optional sub-groups, each with their own conditions/combinator
 *
 * Example: Survived==0 AND (Sex=="female" OR Age<18)
 * {
 *   conditions: [{ column: "Survived", operator: "eq", value: "0" }],
 *   groups: [{ conditions: [...], combinator: "or" }],
 *   combinator: "and"
 * }
 */
function generateFilterExpression(
  conditions: FilterCondition[],
  combinator: string,
  groups?: FilterConditionGroup[],
): string {
  const parts: string[] = [];

  // Process flat conditions
  for (const c of conditions) {
    const expr = conditionToExpr(c);
    if (expr) parts.push(expr);
  }

  // Process sub-groups
  if (groups) {
    for (const g of groups) {
      const groupParts: string[] = [];
      for (const c of g.conditions) {
        const expr = conditionToExpr(c);
        if (expr) groupParts.push(expr);
      }
      if (groupParts.length > 0) {
        parts.push(joinExprs(groupParts, g.combinator ?? 'and'));
      }
    }
  }

  return joinExprs(parts, combinator);
}

/**
 * Build the conditionGroup tree structure that FilterConfiguration expects.
 * Supports flat conditions + nested groups.
 */
function buildConditionGroupTree(
  conditions: FilterCondition[],
  combinator: string,
  groups?: FilterConditionGroup[],
): Record<string, unknown> {
  // Build children from flat conditions
  const children: Record<string, unknown>[] = conditions.map((c) => ({
    id: crypto.randomUUID(),
    type: 'condition',
    column: c.column,
    operator: c.operator,
    value: c.value ?? '',
  }));

  // Build children from sub-groups
  if (groups) {
    for (const g of groups) {
      children.push({
        id: crypto.randomUUID(),
        type: 'group',
        combinator: g.combinator ?? 'and',
        children: g.conditions.map((c) => ({
          id: crypto.randomUUID(),
          type: 'condition',
          column: c.column,
          operator: c.operator,
          value: c.value ?? '',
        })),
      });
    }
  }

  return {
    id: crypto.randomUUID(),
    type: 'group',
    combinator,
    children,
  };
}

/**
 * Process filter config from the AI agent:
 * - If conditions/groups are provided: generate expression + conditionGroup
 * - Always ensures conditionGroup has children (prevents auto-seed overwrite)
 */
function enrichFilterConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const conditions = (config['conditions'] as FilterCondition[] | undefined) ?? [];
  const groups = config['groups'] as FilterConditionGroup[] | undefined;
  const hasConditions = Array.isArray(conditions) && conditions.length > 0;
  const hasGroups = groups && Array.isArray(groups) && groups.length > 0;

  if (!hasConditions && !hasGroups) {
    return config;
  }

  const combinator = (config['combinator'] as string) || 'and';
  const expression = generateFilterExpression(
    hasConditions ? conditions : [],
    combinator,
    hasGroups ? groups : undefined,
  );
  const conditionGroup = buildConditionGroupTree(
    hasConditions ? conditions : [],
    combinator,
    hasGroups ? groups : undefined,
  );

  // Build flat conditions list for legacy compat (only include flat ones)
  const flatConditions = hasConditions
    ? conditions.map((c) => ({
      id: crypto.randomUUID(),
      column: c.column,
      operator: c.operator,
      value: c.value ?? '',
    }))
    : [];

  // Remove `groups` from the final config (it's internal to the AI schema)
  const { groups: _groups, ...rest } = config;

  return {
    ...rest,
    mode: 'Basic',
    expression,
    conditions: flatConditions,
    combinator,
    conditionGroup,
  };
}

// ---------------------------------------------------------------------------
// Summarize config enrichment
// ---------------------------------------------------------------------------

interface SummarizeAggregation {
  column: string;
  operation: string;
  outputName?: string;
  alias?: string; // Accept alias as alternative name for outputName
}

/**
 * Enrich Summarize tool config so the UI's `actions` array is properly built.
 *
 * The UI stores a unified `actions` array where GroupBy and aggregations are
 * interleaved. Without this, the select dropdown can't match the operation
 * value and defaults to showing "GroupBy" for all rows.
 *
 * Also normalizes operation names to PascalCase (Count, Mean, etc.).
 */
function enrichSummarizeConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const aggregations = config['aggregations'] as SummarizeAggregation[] | undefined;
  const groupByColumns = config['groupByColumns'] as (string | { column: string })[] | undefined;

  if (!aggregations && !groupByColumns) return config;

  // Normalize operation names to PascalCase
  const OP_MAP: Record<string, string> = {
    sum: 'Sum', mean: 'Mean', median: 'Median', min: 'Min', max: 'Max',
    std: 'Std', var: 'Var', count: 'Count', countdistinct: 'CountDistinct',
    count_distinct: 'CountDistinct', first: 'First', last: 'Last',
    concat: 'Concat',
    // Already correct PascalCase - pass through
    Sum: 'Sum', Mean: 'Mean', Median: 'Median', Min: 'Min', Max: 'Max',
    Std: 'Std', Var: 'Var', Count: 'Count', CountDistinct: 'CountDistinct',
    First: 'First', Last: 'Last', Concat: 'Concat',
  };

  // Build unified actions array for the UI
  const actions: Array<{
    _id: string;
    column: string;
    action: string;
    outputName: string;
  }> = [];

  // Group-by columns first
  const normalizedGroupBy: Array<{ _id: string; column: string }> = [];
  if (groupByColumns && Array.isArray(groupByColumns)) {
    for (const gb of groupByColumns) {
      const col = typeof gb === 'string' ? gb : gb.column;
      const id = crypto.randomUUID();
      actions.push({ _id: id, column: col, action: 'GroupBy', outputName: col });
      normalizedGroupBy.push({ _id: id, column: col });
    }
  }

  // Aggregations
  const normalizedAggs: Array<{
    _id: string;
    column: string;
    operation: string;
    outputName: string;
  }> = [];
  if (aggregations && Array.isArray(aggregations)) {
    for (const agg of aggregations) {
      const op = OP_MAP[agg.operation] ?? agg.operation;
      const outputName = agg.outputName || agg.alias || `${agg.column}_${op}`;
      const id = crypto.randomUUID();
      actions.push({ _id: id, column: agg.column, action: op, outputName });
      normalizedAggs.push({ _id: id, column: agg.column, operation: op, outputName });
    }
  }

  return {
    ...config,
    actions,
    groupByColumns: normalizedGroupBy,
    aggregations: normalizedAggs,
  };
}

// ---------------------------------------------------------------------------
// Unified config enrichment (exported for use by compiler)
// ---------------------------------------------------------------------------

/**
 * Enrich a tool config by type. Dispatches to type-specific enrichment
 * functions (Filter, Summarize, etc.). Returns config unchanged for
 * unrecognized types.
 */
export function enrichToolConfig(
  type: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  switch (type) {
    case 'Filter': return enrichFilterConfig(config);
    case 'Summarize': return enrichSummarizeConfig(config);
    case 'Formula': return enrichFormulaConfig(config);
    case 'Join': return enrichJoinConfig(config);
    default: return config;
  }
}

/**
 * Resolve a structured basic-mode formula operation from the AI agent.
 *
 * Takes an operation with `operationId`, `sourceColumn`, `params`, `columnName`
 * and resolves it through the formula operations catalog to produce a full
 * FormulaOperationConfig with the generated Polars expression.
 *
 * This allows the user to edit the operation via the GUI (Basic mode)
 * instead of needing to understand the raw Polars expression.
 *
 * Falls back to raw expression format if the operationId is not found.
 */
function resolveBasicFormulaOperation(op: Record<string, unknown>): Record<string, unknown> {
  const operationId = op.operationId as string;
  const sourceColumn = (op.sourceColumn as string) ?? '';
  const params = (op.params as Record<string, string>) ?? {};
  const columnName = (op.columnName as string)
    ?? (op.column_name as string)
    ?? '';

  const opDef = OPERATIONS_BY_ID[operationId];
  if (!opDef) {
    // Unknown operation - fall back to raw expression if provided
    logger.warn(`Unknown formula operation: "${operationId}", falling back to raw mode`);
    return {
      column_name: columnName || 'new_column',
      expression: (op.expression as string) ?? '',
    };
  }

  // Fill in default param values for any params the agent omitted
  const resolvedParams: Record<string, string> = {};
  for (const paramDef of opDef.params) {
    resolvedParams[paramDef.key] = params[paramDef.key] ?? paramDef.defaultValue ?? '';
  }

  // Generate the Polars expression via the catalog
  const expression = opDef.toExpression(sourceColumn, resolvedParams);

  // Auto-generate column name if not provided
  const resolvedColumnName = columnName || opDef.toColumnName(sourceColumn, resolvedParams);

  // Return full GUI state so FormulaConfiguration can render in Basic mode
  return {
    id: crypto.randomUUID(),
    operationId,
    sourceColumn,
    params: resolvedParams,
    columnName: resolvedColumnName,
    column_name: resolvedColumnName,
    columnNameEdited: !!columnName,
    mode: 'basic',
    expression,
  };
}

/**
 * Enrich Formula config - normalize the various shapes the agent might produce
 * into the canonical `operations` array format.
 *
 * The agent may send:
 *   - Structured operations: `[{ operationId, sourceColumn, params, columnName }]` (preferred)
 *   - Raw expressions: `[{ column_name, expression }]`
 *   - `formulas: [{ column, expression }]`   (common LLM hallucination)
 *   - `operations: [{ columnName, expression }]` (camelCase variant)
 *   - top-level `column_name` + `expression` (single-op shorthand)
 *
 * Structured operations are resolved via the formula operations catalog
 * (toExpression) and stored with full GUI state so the user can edit
 * them in Basic mode without dealing with raw Polars.
 */
function enrichFormulaConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result = { ...config };

  // If the agent used the `formulas` key instead of `operations`, convert it
  if (Array.isArray(result.formulas) && !Array.isArray(result.operations)) {
    result.operations = (result.formulas as Array<Record<string, unknown>>).map((f) => ({
      column_name: f.column_name ?? f.columnName ?? f.column ?? f.name ?? 'new_column',
      expression: f.expression ?? '',
    }));
    delete result.formulas;
  }

  // Process operations array
  if (Array.isArray(result.operations)) {
    result.operations = (result.operations as Array<Record<string, unknown>>).map((op) => {
      // Check if this is a structured basic-mode operation (has operationId)
      if (op.operationId && typeof op.operationId === 'string') {
        return resolveBasicFormulaOperation(op);
      }
      // Raw expression format - normalize field names
      return {
        column_name: op.column_name ?? op.columnName ?? op.column ?? op.name ?? 'new_column',
        expression: op.expression ?? '',
      };
    });
  }

  // If there's a top-level column_name + expression but no operations, wrap it
  if (
    !Array.isArray(result.operations) &&
    (result.column_name || result.columnName) &&
    result.expression
  ) {
    result.operations = [{
      column_name: result.column_name ?? result.columnName,
      expression: result.expression,
    }];
  }

  // Clean up legacy/hallucinated top-level fields
  if (Array.isArray(result.operations) && (result.operations as unknown[]).length > 0) {
    delete result.formulas;
    // Keep expression/column_name for legacy single-op compat in UI
  }

  return result;
}

/**
 * Enrich Join config - validate that leftKeys and rightKeys are properly set.
 * If they're present but empty, remove them so the UI shows unconfigured state
 * instead of silently producing a cross join.
 */
function enrichJoinConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result = { ...config };
  const leftKeys = result.leftKeys as string[] | undefined;
  const rightKeys = result.rightKeys as string[] | undefined;

  // Normalize join type
  if (result.joinType && typeof result.joinType === 'string') {
    result.joinType = result.joinType.toLowerCase();
  }

  // If keys are empty arrays, make sure they're valid
  // Empty keys + non-cross join type → cross join (data hazard)
  if (leftKeys && leftKeys.length === 0) delete result.leftKeys;
  if (rightKeys && rightKeys.length === 0) delete result.rightKeys;

  return result;
}

// ---------------------------------------------------------------------------
// Auto-layout helper (runs after structural mutations)
// ---------------------------------------------------------------------------

/**
 * Re-run auto-layout on the canvas. Called automatically after add/remove/connect
 * operations so the agent never needs to think about positioning.
 */
async function runAutoLayout(): Promise<void> {
  const { tools, wires, batchUpdateToolPositions } = useWorkflowStore.getState();
  if (tools.length === 0) return;

  const { autoLayout } = await import('@domain/workflow/services/autoLayout');
  const { positions } = autoLayout(tools, wires);
  if (positions.length > 0) {
    batchUpdateToolPositions(positions);
  }
}

/**
 * Add a tool to the canvas.
 * Auto-previews the tool's output when connected, so the agent immediately
 * sees whether it executed correctly and what the data looks like.
 */
export const addTool = tool({
  description: 'Add a new tool to the workflow canvas. Optionally connect via "after". Returns inline preview of the tool output when connected.',
  inputSchema: z.object({
    type: z.string().describe('Internal tool type from the Tool Config Reference, e.g. "Input", "Filter", "Summarize".'),
    config: z.record(z.string(), z.unknown()).optional().describe('Tool configuration. Omit to use defaults.'),
    comment: z.string().optional().describe('REQUIRED: Brief human-readable comment explaining what this tool does in the pipeline. Every tool must have a comment (e.g. "Load raw sales data", "Keep only active customers", "Calculate profit margin per product"). Comments help users understand the workflow.'),
    after: z.string().optional().describe('ID of the upstream tool whose output feeds into this new tool. The new tool only sees columns from that tool\'s output. For independent analyses (e.g. several Summarize tools on the raw data), point each back to the Input tool, not to another Summarize.'),
    fromSocket: z.string().optional().describe('Output socket on the "after" tool. Only needed for non-default sockets (e.g. "output-false").'),
    toSocket: z.string().optional().describe('Input socket on the new tool. Only needed for multi-input tools like Join ("input-left", "input-right").'),
  }),
  execute: async ({ type, config, comment, after, fromSocket, toSocket }) => {
    const tabErr = checkTabOwnership();
    if (tabErr) return tabErr;

    const def = getToolDefinition(resolveToolType(type) ?? type);
    if (!def) {
      return { success: false, error: unknownToolTypeError(type) };
    }

    const { tools, addTool: storeAddTool, addWire } = useWorkflowStore.getState();
    const existingIds = new Set(tools.map((t) => t.id));

    // Validate the upstream tool before touching the canvas, so a bad "after"
    // does not leave an unconnected tool behind.
    const sourceTool = after ? tools.find((t) => t.id === after) : undefined;
    if (after && !sourceTool) {
      const available = tools.map((t) => `${t.type} [${t.id}]`).join(', ') || '(canvas is empty)';
      return { success: false, error: `Upstream tool "${after}" not found; nothing was added. Tools on canvas: ${available}` };
    }

    // Resolve comment: use agent-provided, or auto-generate from config
    const resolvedConfig = config ? enrichToolConfig(def.type, config) : config;
    const finalConfig = { ...def.defaultConfig, ...resolvedConfig } as ToolConfig;
    const resolvedComment = comment || generateComment(def.type, finalConfig) || undefined;

    // Temporary position - auto-layout will fix it
    const newTool: Tool = {
      id: generateUniqueId(existingIds),
      type: def.type,
      x: 0,
      y: 0,
      config: finalConfig,
      sockets: [...def.sockets],
      ...(resolvedComment ? { comment: resolvedComment } : {}),
    };

    storeAddTool(newTool);

    // Auto-connect if "after" is specified
    let connected = false;
    let connectError: string | undefined;
    if (after && sourceTool) {
      // Resolve output socket on source - default to first output
      const outputSocket = fromSocket
        ?? defaultOutputSocket(sourceTool);
      // Resolve input socket on new tool - default to first input
      const inputSocket = toSocket
        ?? newTool.sockets.find((s) => s.direction === 'input')?.id;

      if (outputSocket && inputSocket) {
        const wire: Wire = {
          from: { tool: after, socket: outputSocket },
          to: { tool: newTool.id, socket: inputSocket },
        };
        const result = addWire(wire);
        connected = result.success;
        if (!result.success) connectError = `Added but not connected: ${result.error ?? 'wire rejected'}`;
      } else {
        connectError = `Added but not connected: socket "${fromSocket ?? toSocket ?? 'default'}" not found. ` +
          `Outputs of ${sourceTool.type}: ${sourceTool.sockets.filter((s) => s.direction === 'output').map((s) => s.id).join(', ')}; ` +
          `inputs of ${newTool.type}: ${newTool.sockets.filter((s) => s.direction === 'input').map((s) => s.id).join(', ')}`;
      }
    }

    // Auto-layout the canvas
    await runAutoLayout();
    if (connectError) {
      return { data: formatAddToolResult(newTool.id, newTool.type, false, undefined, connectError) };
    }

    // Auto-preview when the tool is connected so the agent immediately sees
    // if the tool executed correctly and what the output looks like.
    let preview: { rows: Record<string, unknown>[]; schema: import('@api/backend').ColumnSchema[]; rowCount: number } | undefined;
    if (connected) {
      try {
        const { tools: currentTools, wires: currentWires, workflowMeta } = useWorkflowStore.getState();
        const workflow = { version: '1.0' as const, tools: currentTools, wires: currentWires, meta: workflowMeta };
        const outputSocket = defaultOutputSocket(newTool) ?? 'output';
        const result = await previewTool(newTool.id, workflow, outputSocket, 5);
        preview = {
          rows: shareableRows(result.data?.slice(0, 5) ?? []),
          schema: result.data_schema?.columns ?? [],
          rowCount: result.row_count ?? 0,
        };
      } catch (err) {
        // Surface preview failure so the agent can self-correct
        const previewError = err instanceof Error ? err.message : String(err);
        logger.warn('Inline preview failed for add_tool', err);
        return {
          data: formatAddToolResult(newTool.id, newTool.type, connected, undefined, `Preview failed: ${previewError}`),
        };
      }
    }

    return {
      data: formatAddToolResult(newTool.id, newTool.type, connected, preview),
    };
  },
});

/**
 * Update an existing tool's configuration.
 */
export const updateTool = tool({
  description: 'Update a tool\'s configuration and/or comment. For Join: always set leftKeys and rightKeys - empty keys produce a cross join.',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to update.'),
    config: z.record(z.string(), z.unknown()).optional().describe('New configuration values to merge with existing config.'),
    comment: z.string().optional().describe('New comment for the tool. Replaces the existing comment.'),
  }),
  execute: async ({ toolId, config, comment }) => {
    const tabErr = checkTabOwnership();
    if (tabErr) return tabErr;

    const { tools, updateToolConfiguration, updateToolComment } = useWorkflowStore.getState();
    const existing = tools.find((t) => t.id === toolId);
    if (!existing) {
      return { success: false, error: `Tool not found: ${toolId}` };
    }

    const updatedFields: string[] = [];

    if (config) {
      // Enrich tool-specific configs for UI compatibility
      const resolvedConfig = enrichToolConfig(existing.type, config);
      const mergedConfig = { ...existing.config, ...resolvedConfig } as ToolConfig;
      updateToolConfiguration(toolId, mergedConfig);
      updatedFields.push(...Object.keys(config));
    }

    if (comment !== undefined) {
      updateToolComment(toolId, comment || undefined);
      updatedFields.push('comment');
    }

    return { success: true, toolId, updatedFields };
  },
});

/**
 * Batch-update multiple tools' configurations in one call.
 * More efficient than calling update_tool repeatedly when fixing
 * column-name or configuration issues across many tools at once.
 */
export const updateTools = tool({
  description: 'Batch-update multiple tools in one call. Use this instead of multiple update_tool calls when fixing config issues across several tools (e.g. correcting column names after seeing a data profile).',
  inputSchema: z.object({
    updates: z.array(z.object({
      toolId: z.string().describe('The ID of the tool to update.'),
      config: z.record(z.string(), z.unknown()).optional().describe('New configuration values to merge with existing config.'),
      comment: z.string().optional().describe('New comment for the tool.'),
    })).min(1).describe('Array of tool updates to apply.'),
  }),
  execute: async ({ updates }) => {
    const tabErr = checkTabOwnership();
    if (tabErr) return tabErr;

    const { tools, updateToolConfiguration, updateToolComment } = useWorkflowStore.getState();
    const results: Array<{ toolId: string; success: boolean; error?: string; updatedFields?: string[] }> = [];

    for (const { toolId, config, comment } of updates) {
      const existing = tools.find((t) => t.id === toolId);
      if (!existing) {
        results.push({ toolId, success: false, error: `Tool not found: ${toolId}` });
        continue;
      }

      const updatedFields: string[] = [];

      if (config) {
        const resolvedConfig = enrichToolConfig(existing.type, config);
        const mergedConfig = { ...existing.config, ...resolvedConfig } as ToolConfig;
        updateToolConfiguration(toolId, mergedConfig);
        updatedFields.push(...Object.keys(config));
      }

      if (comment !== undefined) {
        updateToolComment(toolId, comment || undefined);
        updatedFields.push('comment');
      }

      results.push({ toolId, success: true, updatedFields });
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      summary: `Updated ${succeeded}/${updates.length} tools${failed > 0 ? ` (${failed} failed)` : ''}`,
      results,
    };
  },
});

/**
 * Patch specific fields of a tool's config by path.
 *
 * Lets the agent amend a single nested field (e.g. one filter condition's
 * value) without resending the entire config - cheaper in tokens and leaves
 * sibling fields untouched. Re-runs config enrichment so derived fields
 * (filter expressions, formula operations, join keys) stay consistent.
 */
export const patchToolConfig = tool({
  description: 'Patch specific fields of a tool\'s config by path, without resending the whole config. ' +
    'Prefer this over update_tool for small edits to large configs - it saves tokens and leaves other fields untouched. ' +
    'Paths use dot/bracket notation: "conditions.0.value", "aggregations[1].operation", "joinType".',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to patch.'),
    patches: z.array(z.object({
      path: z.string().describe('Dot/bracket path to the field, e.g. "conditions.0.value" or "sortColumns[0].direction".'),
      value: z.unknown().optional().describe('New value to set at the path. Omit when op is "remove".'),
      op: z.enum(['set', 'remove']).optional().describe('Operation: "set" (default) writes value; "remove" deletes the field or array element.'),
    })).min(1).describe('Field-level patches to apply in order.'),
    comment: z.string().optional().describe('Optional new comment for the tool.'),
  }),
  execute: async ({ toolId, patches, comment }) => {
    const tabErr = checkTabOwnership();
    if (tabErr) return tabErr;

    const { tools, updateToolConfiguration, updateToolComment } = useWorkflowStore.getState();
    const existing = tools.find((t) => t.id === toolId);
    if (!existing) {
      return { success: false, error: `Tool not found: ${toolId}` };
    }

    const draft = structuredClone(existing.config) as Record<string, unknown>;
    const patchedPaths: string[] = [];
    for (const patch of patches) {
      try {
        if ((patch.op ?? 'set') === 'remove') {
          removeConfigPath(draft, patch.path);
        } else {
          setConfigPath(draft, patch.path, patch.value);
        }
        patchedPaths.push(patch.path);
      } catch (err) {
        return {
          success: false,
          error: `Failed to apply patch "${patch.path}": ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // Re-run enrichment so derived fields stay consistent with the patched values.
    const enriched = enrichToolConfig(existing.type, draft) as ToolConfig;
    updateToolConfiguration(toolId, enriched);

    const updatedFields = [...patchedPaths];
    if (comment !== undefined) {
      updateToolComment(toolId, comment || undefined);
      updatedFields.push('comment');
    }

    return { success: true, toolId, patchedPaths, updatedFields };
  },
});

/**
 * Insert a new tool onto an existing wire, splitting it.
 *
 * An existing connection A -> B becomes A -> new -> B, so a step can be added
 * into the middle of a pipeline without removing and rebuilding the downstream
 * tools. Returns an inline preview of the inserted tool's output.
 */
export const insertToolBetween = tool({
  description: 'Insert a new tool onto an existing wire, splitting it: a connection A->B becomes A->new->B. ' +
    'Use to add a step into the middle of a pipeline without rebuilding downstream nodes. ' +
    'Returns an inline preview of the new tool output.',
  inputSchema: z.object({
    type: z.string().describe('Tool type to insert (e.g. "Filter", "Formula", "Sort").'),
    fromToolId: z.string().describe('ID of the upstream tool of the existing wire (A).'),
    toToolId: z.string().describe('ID of the downstream tool of the existing wire (B).'),
    config: z.record(z.string(), z.unknown()).optional().describe('Configuration for the new tool. Omit for defaults.'),
    comment: z.string().optional().describe('Brief human-readable comment for the new tool.'),
    fromSocket: z.string().optional().describe('Output socket on the upstream tool. Defaults to the default output (output-match for Join).'),
    toSocket: z.string().optional().describe('Input socket on the downstream tool that the wire currently feeds. Defaults to the first input socket.'),
  }),
  execute: async ({ type, fromToolId, toToolId, config, comment, fromSocket, toSocket }) => {
    const tabErr = checkTabOwnership();
    if (tabErr) return tabErr;

    const def = getToolDefinition(resolveToolType(type) ?? type);
    if (!def) {
      return { success: false, error: unknownToolTypeError(type) };
    }

    const { tools, wires, addTool: storeAddTool, addWire, removeWire } = useWorkflowStore.getState();
    const fromTool = tools.find((t) => t.id === fromToolId);
    const toTool = tools.find((t) => t.id === toToolId);
    if (!fromTool) return { success: false, error: `Upstream tool not found: ${fromToolId}` };
    if (!toTool) return { success: false, error: `Downstream tool not found: ${toToolId}` };

    const fromOutput = fromSocket ?? defaultOutputSocket(fromTool);
    const toInput = toSocket ?? toTool.sockets.find((s) => s.direction === 'input')?.id;
    if (!fromOutput) return { success: false, error: `No output socket found on ${fromTool.type}` };
    if (!toInput) return { success: false, error: `No input socket found on ${toTool.type}` };

    const existingWire = wires.find(
      (w) => w.from.tool === fromToolId && w.from.socket === fromOutput
        && w.to.tool === toToolId && w.to.socket === toInput,
    );
    if (!existingWire) {
      return {
        success: false,
        error: `No wire found from ${fromTool.type}[${fromToolId}].${fromOutput} to ${toTool.type}[${toToolId}].${toInput}`,
      };
    }

    // Build the new tool (same path as add_tool).
    const existingIds = new Set(tools.map((t) => t.id));
    const resolvedConfig = config ? enrichToolConfig(def.type, config) : config;
    const finalConfig = { ...def.defaultConfig, ...resolvedConfig } as ToolConfig;
    const resolvedComment = comment || generateComment(def.type, finalConfig) || undefined;
    const newTool: Tool = {
      id: generateUniqueId(existingIds),
      type: def.type,
      x: 0,
      y: 0,
      config: finalConfig,
      sockets: [...def.sockets],
      ...(resolvedComment ? { comment: resolvedComment } : {}),
    };

    const newInput = newTool.sockets.find((s) => s.direction === 'input')?.id;
    const newOutput = defaultOutputSocket(newTool);
    if (!newInput || !newOutput) {
      return { success: false, error: `Tool type "${type}" cannot be inserted inline (needs both an input and an output socket).` };
    }

    storeAddTool(newTool);

    // Rewire: drop A->B, then add A->new and new->B.
    removeWire(
      { tool: fromToolId, socket: fromOutput },
      { tool: toToolId, socket: toInput },
    );
    const up = addWire({ from: { tool: fromToolId, socket: fromOutput }, to: { tool: newTool.id, socket: newInput } });
    const down = addWire({ from: { tool: newTool.id, socket: newOutput }, to: { tool: toToolId, socket: toInput } });
    if (!up.success || !down.success) {
      return { success: false, error: `Inserted tool but failed to rewire: ${up.error ?? down.error ?? 'unknown error'}` };
    }

    await runAutoLayout();

    // Inline preview so the agent sees whether the inserted tool executed correctly.
    let preview: { rows: Record<string, unknown>[]; schema: import('@api/backend').ColumnSchema[]; rowCount: number } | undefined;
    try {
      const { tools: currentTools, wires: currentWires, workflowMeta } = useWorkflowStore.getState();
      const workflow = { version: '1.0' as const, tools: currentTools, wires: currentWires, meta: workflowMeta };
      const result = await previewTool(newTool.id, workflow, newOutput, 5);
      preview = {
        rows: shareableRows(result.data?.slice(0, 5) ?? []),
        schema: result.data_schema?.columns ?? [],
        rowCount: result.row_count ?? 0,
      };
    } catch (err) {
      const previewError = err instanceof Error ? err.message : String(err);
      logger.warn('Inline preview failed for insert_tool_between', err);
      return { data: formatAddToolResult(newTool.id, newTool.type, true, undefined, `Inserted but preview failed: ${previewError}`) };
    }

    return { data: formatAddToolResult(newTool.id, newTool.type, true, preview) };
  },
});

/**
 * Remove a tool from the canvas.
 */
export const removeTool = tool({
  description: 'Remove a tool from the canvas, with its wires. The user may be asked to approve first; if they decline, do not retry.',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to remove.'),
  }),
  execute: async ({ toolId }, { abortSignal }) => {
    const tabErr = checkTabOwnership();
    if (tabErr) return tabErr;

    const { tools, removeTool: remove } = useWorkflowStore.getState();
    const existing = tools.find((t) => t.id === toolId);
    if (!existing) {
      return { success: false, error: `Tool not found: ${toolId}` };
    }

    const title = `Remove ${describeTool(existing)}`;
    if (!(await requestApproval({ title, details: removalDetails([toolId]) }, abortSignal))) {
      return declinedResult(title);
    }
    const stillTabErr = checkTabOwnership();
    if (stillTabErr) return stillTabErr;

    remove(toolId);
    await runAutoLayout();
    return { success: true, removedType: existing.type };
  },
});

/**
 * Connect two tools with a wire.
 */
export const connectTools = tool({
  description: 'Connect two tools with a wire. Specify source and target tools, and optionally socket IDs. Defaults to first output/input sockets.',
  inputSchema: z.object({
    fromToolId: z.string().describe('The ID of the source tool (output).'),
    toToolId: z.string().describe('The ID of the target tool (input).'),
    fromSocket: z.string().optional().describe('Output socket ID on the source tool. Defaults to the default output (output-match for Join).'),
    toSocket: z.string().optional().describe('Input socket ID on the target tool. Defaults to the first input socket.'),
  }),
  execute: async ({ fromToolId, toToolId, fromSocket, toSocket }) => {
    const tabErr = checkTabOwnership();
    if (tabErr) return tabErr;

    const { tools, addWire } = useWorkflowStore.getState();
    const fromTool = tools.find((t) => t.id === fromToolId);
    const toTool = tools.find((t) => t.id === toToolId);

    if (!fromTool) return { success: false, error: `Source tool not found: ${fromToolId}` };
    if (!toTool) return { success: false, error: `Target tool not found: ${toToolId}` };

    // Resolve sockets
    const outputSocket = fromSocket
      ?? defaultOutputSocket(fromTool);
    const inputSocket = toSocket
      ?? toTool.sockets.find((s) => s.direction === 'input')?.id;

    if (!outputSocket) return { success: false, error: `No output socket found on ${fromTool.type}` };
    if (!inputSocket) return { success: false, error: `No input socket found on ${toTool.type}` };

    const wire: Wire = {
      from: { tool: fromToolId, socket: outputSocket },
      to: { tool: toToolId, socket: inputSocket },
    };

    const result = addWire(wire);
    await runAutoLayout();
    return result;
  },
});

/**
 * Disconnect two tools by removing their wire.
 */
export const disconnectTools = tool({
  description: 'Remove a wire between two tools.',
  inputSchema: z.object({
    fromToolId: z.string().describe('The ID of the source tool.'),
    toToolId: z.string().describe('The ID of the target tool.'),
    fromSocket: z.string().optional().describe('Output socket ID. Defaults to the default output (output-match for Join).'),
    toSocket: z.string().optional().describe('Input socket ID. Defaults to first input socket.'),
  }),
  execute: async ({ fromToolId, toToolId, fromSocket, toSocket }) => {
    const tabErr = checkTabOwnership();
    if (tabErr) return tabErr;

    const { tools, wires, removeWire } = useWorkflowStore.getState();
    const fromTool = tools.find((t) => t.id === fromToolId);
    const toTool = tools.find((t) => t.id === toToolId);

    if (!fromTool) return { success: false, error: `Source tool not found: ${fromToolId}` };
    if (!toTool) return { success: false, error: `Target tool not found: ${toToolId}` };

    const outputSocket = fromSocket
      ?? defaultOutputSocket(fromTool);
    const inputSocket = toSocket
      ?? toTool.sockets.find((s) => s.direction === 'input')?.id;

    if (!outputSocket || !inputSocket) {
      return { success: false, error: 'Could not resolve socket IDs' };
    }

    // Check if wire exists
    const wireExists = wires.some(
      (w) => w.from.tool === fromToolId && w.from.socket === outputSocket
        && w.to.tool === toToolId && w.to.socket === inputSocket,
    );

    if (!wireExists) {
      return { success: false, error: 'No wire found between these tools/sockets' };
    }

    removeWire(
      { tool: fromToolId, socket: outputSocket },
      { tool: toToolId, socket: inputSocket },
    );
    await runAutoLayout();
    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// Batch canvas operations - transactional multi-step mutations
// ---------------------------------------------------------------------------

/**
 * Operation schemas for batch_canvas_ops
 */
const batchOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add'),
    /** Temporary ID for referencing this tool in later ops within the same batch */
    refId: z.string().optional().describe('Temporary reference ID for later ops in this batch (e.g. "filter1"). Use this to connect or update tools added in this same batch.'),
    type: z.string().describe('Tool type (e.g. "Input", "Filter", "Formula", "Summarize")'),
    config: z.record(z.string(), z.unknown()).optional(),
    comment: z.string().optional().describe('Brief human-readable comment for this tool.'),
    after: z.string().optional().describe('ID or refId of upstream tool to connect to.'),
    fromSocket: z.string().optional(),
    toSocket: z.string().optional(),
  }),
  z.object({
    op: z.literal('connect'),
    from: z.string().describe('ID or refId of source tool.'),
    to: z.string().describe('ID or refId of target tool.'),
    fromSocket: z.string().optional(),
    toSocket: z.string().optional(),
  }),
  z.object({
    op: z.literal('update'),
    toolId: z.string().describe('ID or refId of tool to update.'),
    config: z.record(z.string(), z.unknown()).optional(),
    comment: z.string().optional(),
  }),
  z.object({
    op: z.literal('remove'),
    toolId: z.string().describe('ID or refId of tool to remove.'),
  }),
]);

/**
 * Batch canvas operations in a single tool call.
 * Adds, connects, updates, and removes tools transactionally with layout
 * deferred to the end. Returns an idMap of refIds to canvas IDs plus
 * an optional preview summary of the last added tool.
 */
export const batchCanvasOps = tool({
  description: 'Execute multiple canvas operations (add, connect, update, remove) in a single call. ' +
    'Use this instead of separate add_tool/connect_tools/update_tool calls when building or modifying ' +
    'multiple tools at once. Defers layout until the end. Returns an id map and optional preview. ' +
    'Use "refId" on add ops to reference newly-added tools in later ops within the same batch.',
  inputSchema: z.object({
    operations: z.array(batchOpSchema).min(1).describe('Array of operations to execute in order.'),
    previewLast: z.boolean().optional().describe('When true, previews the output of the last added tool.'),
  }),
  execute: async ({ operations, previewLast }, { abortSignal }) => {
    const tabErr = checkTabOwnership();
    if (tabErr) return tabErr;

    // Removals of existing tools need approval up front, for the whole batch.
    const existingIds = new Set(useWorkflowStore.getState().tools.map((t) => t.id));
    const removals = operations
      .filter((o): o is Extract<typeof o, { op: 'remove' }> => o.op === 'remove')
      .map((o) => o.toolId)
      .filter((id) => existingIds.has(id));
    if (removals.length > 0) {
      const title = `Remove ${removals.length} tool${removals.length > 1 ? 's' : ''} as part of a batch edit`;
      if (!(await requestApproval({ title, details: removalDetails(removals) }, abortSignal))) {
        return declinedResult(title);
      }
      const stillTabErr = checkTabOwnership();
      if (stillTabErr) return stillTabErr;
    }

    const idMap: Record<string, string> = {}; // refId → actual canvas ID
    const results: Array<{ op: string; success: boolean; toolId?: string; error?: string }> = [];

    // Resolve a tool ID that may be a refId or an actual canvas ID
    const resolveId = (idOrRef: string): string => {
      return idMap[idOrRef] ?? idOrRef;
    };

    let lastAddedToolId: string | undefined;

    for (const operation of operations) {
      try {
        switch (operation.op) {
          case 'add': {
            const def = getToolDefinition(resolveToolType(operation.type) ?? operation.type);
            if (!def) {
              results.push({ op: 'add', success: false, error: unknownToolTypeError(operation.type) });
              continue;
            }

            const { tools, addTool: storeAddTool, addWire } = useWorkflowStore.getState();
            const existingIds = new Set(tools.map((t) => t.id));

            const afterId = operation.after ? resolveId(operation.after) : undefined;
            const sourceTool = afterId ? tools.find((t) => t.id === afterId) : undefined;
            if (operation.after && !sourceTool) {
              results.push({ op: 'add', success: false, error: `Upstream tool "${operation.after}" not found; tool not added` });
              continue;
            }

            const resolvedConfig = operation.config ? enrichToolConfig(def.type, operation.config) : undefined;
            const finalConfig = { ...def.defaultConfig, ...resolvedConfig } as ToolConfig;
            const resolvedComment = operation.comment || generateComment(def.type, finalConfig) || undefined;

            const newTool: Tool = {
              id: generateUniqueId(existingIds),
              type: def.type,
              x: 0,
              y: 0,
              config: finalConfig,
              sockets: [...def.sockets],
              ...(resolvedComment ? { comment: resolvedComment } : {}),
            };

            storeAddTool(newTool);

            // Register refId mapping
            if (operation.refId) {
              idMap[operation.refId] = newTool.id;
            }
            lastAddedToolId = newTool.id;

            // Auto-connect if "after" is specified
            if (afterId && sourceTool) {
              const outputSocket = operation.fromSocket
                ?? defaultOutputSocket(sourceTool);
              const inputSocket = operation.toSocket
                ?? newTool.sockets.find((s) => s.direction === 'input')?.id;
              const wired = outputSocket && inputSocket
                ? addWire({
                  from: { tool: afterId, socket: outputSocket },
                  to: { tool: newTool.id, socket: inputSocket },
                })
                : { success: false, error: 'Could not resolve sockets' };
              if (!wired.success) {
                results.push({ op: 'add', success: false, toolId: newTool.id, error: `Added ${newTool.id} but not connected: ${wired.error ?? 'wire rejected'}` });
                break;
              }
            }

            results.push({ op: 'add', success: true, toolId: newTool.id });
            break;
          }

          case 'connect': {
            const fromId = resolveId(operation.from);
            const toId = resolveId(operation.to);
            const { tools, addWire } = useWorkflowStore.getState();
            const fromTool = tools.find((t) => t.id === fromId);
            const toTool = tools.find((t) => t.id === toId);

            if (!fromTool || !toTool) {
              results.push({ op: 'connect', success: false, error: `Tool not found: ${!fromTool ? fromId : toId}` });
              continue;
            }

            const outputSocket = operation.fromSocket
              ?? defaultOutputSocket(fromTool);
            const inputSocket = operation.toSocket
              ?? toTool.sockets.find((s) => s.direction === 'input')?.id;

            if (outputSocket && inputSocket) {
              const wired = addWire({
                from: { tool: fromId, socket: outputSocket },
                to: { tool: toId, socket: inputSocket },
              });
              results.push(wired.success
                ? { op: 'connect', success: true }
                : { op: 'connect', success: false, error: wired.error ?? 'wire rejected' });
            } else {
              results.push({ op: 'connect', success: false, error: 'Could not resolve sockets' });
            }
            break;
          }

          case 'update': {
            const toolId = resolveId(operation.toolId);
            const { tools, updateToolConfiguration, updateToolComment } = useWorkflowStore.getState();
            const existing = tools.find((t) => t.id === toolId);
            if (!existing) {
              results.push({ op: 'update', success: false, toolId, error: `Tool not found: ${toolId}` });
              continue;
            }

            if (operation.config) {
              const resolvedConfig = enrichToolConfig(existing.type, operation.config);
              updateToolConfiguration(toolId, { ...existing.config, ...resolvedConfig } as ToolConfig);
            }
            if (operation.comment !== undefined) {
              updateToolComment(toolId, operation.comment || undefined);
            }
            results.push({ op: 'update', success: true, toolId });
            break;
          }

          case 'remove': {
            const toolId = resolveId(operation.toolId);
            const { tools, removeTool: remove } = useWorkflowStore.getState();
            const existing = tools.find((t) => t.id === toolId);
            if (!existing) {
              results.push({ op: 'remove', success: false, error: `Tool not found: ${toolId}` });
              continue;
            }
            remove(toolId);
            results.push({ op: 'remove', success: true, toolId });
            break;
          }
        }
      } catch (err) {
        results.push({
          op: operation.op,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Defer layout to end of batch
    await runAutoLayout();

    // Build summary
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const parts: string[] = [];
    parts.push(`Batch: ${succeeded}/${operations.length} ops succeeded${failed > 0 ? ` (${failed} failed)` : ''}`);

    // Report id map
    if (Object.keys(idMap).length > 0) {
      parts.push('ID map: ' + Object.entries(idMap).map(([ref, id]) => `${ref} → ${id}`).join(', '));
    }

    // Report failures
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      parts.push('Errors: ' + failures.map((r) => `${r.op}: ${r.error}`).join('; '));
    }

    // Optional preview of last added tool
    if (previewLast && lastAddedToolId) {
      try {
        const { tools: currentTools, wires: currentWires, workflowMeta } = useWorkflowStore.getState();
        const lastTool = currentTools.find((t) => t.id === lastAddedToolId);
        if (lastTool) {
          const workflow = { version: '1.0' as const, tools: currentTools, wires: currentWires, meta: workflowMeta };
          const outputSocket = defaultOutputSocket(lastTool) ?? 'output';
          const result = await previewTool(lastAddedToolId!, workflow, outputSocket, 5);
          const rows = shareableRows(result.data?.slice(0, 5) ?? []);
          const schema = result.data_schema?.columns ?? [];
          const rowCount = result.row_count ?? rows.length;
          parts.push(`Preview (${lastTool.type} [${lastAddedToolId}], ${rowCount} rows):`);
          parts.push(formatAddToolResult(lastAddedToolId!, lastTool.type, true, { rows, schema, rowCount }));
        }
      } catch (err) {
        const previewError = err instanceof Error ? err.message : String(err);
        parts.push(`Preview failed: ${previewError}`);
      }
    }

    return {
      data: parts.join('\n'),
      idMap,
      results,
    };
  },
});
