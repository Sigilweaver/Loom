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
import type { Tool, Wire, ToolConfig } from '@domain/workflow/entities/workflow';

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

/**
 * Generate a Polars expression from a single condition.
 */
function conditionToExpr(c: FilterCondition): string | null {
  if (!c.column) return null;
  const colRef = `pl.col("${c.column}")`;
  const val = c.value ?? '';
  const isNum = val !== '' && !isNaN(Number(val));
  const formatted = isNum ? val : `"${val}"`;

  switch (c.operator) {
    case 'eq': return `${colRef} == ${formatted}`;
    case 'neq': return `${colRef} != ${formatted}`;
    case 'gt': return `${colRef} > ${formatted}`;
    case 'lt': return `${colRef} < ${formatted}`;
    case 'gte': return `${colRef} >= ${formatted}`;
    case 'lte': return `${colRef} <= ${formatted}`;
    case 'contains': return `${colRef}.str.contains("${val}")`;
    case 'not_contains': return `~(${colRef}.str.contains("${val}"))`;
    case 'starts_with': return `${colRef}.str.starts_with("${val}")`;
    case 'ends_with': return `${colRef}.str.ends_with("${val}")`;
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
    // Already correct PascalCase — pass through
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
    default: return config;
  }
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
 * Get current canvas state — tools and wires.
 */
export const getCanvasState = tool({
  description: 'Get the current canvas state: all tools and wires on the workflow.',
  inputSchema: z.object({}),
  execute: async () => {
    const { tools, wires } = useWorkflowStore.getState();
    return {
      tools: tools.map((t) => ({
        id: t.id,
        type: t.type,
        config: Object.fromEntries(
          Object.entries(t.config).filter(([k]) => k !== '_emit'),
        ),
        sockets: t.sockets.map((s) => ({ id: s.id, direction: s.direction })),
        position: { x: t.x, y: t.y },
      })),
      wires: wires.map((w) => ({
        from: { tool: w.from.tool, socket: w.from.socket },
        to: { tool: w.to.tool, socket: w.to.socket },
      })),
      totalTools: tools.length,
      totalWires: wires.length,
    };
  },
});

/**
 * Add a tool to the canvas.
 */
export const addTool = tool({
  description: 'Add a new tool to the workflow canvas. Optionally connect it to an existing tool via "after". Positioning is automatic.',
  inputSchema: z.object({
    type: z.string().describe('Tool type (e.g. "Input", "Filter", "Formula", "Sort", "Select", "Join", "Union", "Summarize", "Output", "Sample", "Unique")'),
    config: z.record(z.string(), z.unknown()).optional().describe('Tool configuration. Omit to use defaults.'),
    after: z.string().optional().describe('ID of the tool to connect FROM. The new tool is wired as a downstream consumer. For Filter/Unique sources, defaults to the "true"/"unique" output socket.'),
    fromSocket: z.string().optional().describe('Output socket on the "after" tool. Only needed for non-default sockets (e.g. "output-false").'),
    toSocket: z.string().optional().describe('Input socket on the new tool. Only needed for multi-input tools like Join ("input-left", "input-right").'),
  }),
  execute: async ({ type, config, after, fromSocket, toSocket }) => {
    const def = getToolDefinition(type);
    if (!def) {
      return { success: false, error: `Unknown tool type: ${type}. Use list_tool_types to see available types.` };
    }

    const { tools, addTool: storeAddTool, addWire } = useWorkflowStore.getState();
    const existingIds = new Set(tools.map((t) => t.id));

    // Enrich tool-specific configs for UI compatibility
    const resolvedConfig = config ? enrichToolConfig(type, config) : config;

    // Temporary position — auto-layout will fix it
    const newTool: Tool = {
      id: generateUniqueId(existingIds),
      type: def.type,
      x: 0,
      y: 0,
      config: { ...def.defaultConfig, ...resolvedConfig } as ToolConfig,
      sockets: [...def.sockets],
    };

    storeAddTool(newTool);

    // Auto-connect if "after" is specified
    let connected = false;
    if (after) {
      const sourceTool = tools.find((t) => t.id === after);
      if (!sourceTool) {
        return { success: true, toolId: newTool.id, type: newTool.type, warning: `Could not connect: source tool "${after}" not found.` };
      }

      // Resolve output socket on source — default to first output
      const outputSocket = fromSocket
        ?? sourceTool.sockets.find((s) => s.direction === 'output')?.id;
      // Resolve input socket on new tool — default to first input
      const inputSocket = toSocket
        ?? newTool.sockets.find((s) => s.direction === 'input')?.id;

      if (outputSocket && inputSocket) {
        const wire: Wire = {
          from: { tool: after, socket: outputSocket },
          to: { tool: newTool.id, socket: inputSocket },
        };
        const result = addWire(wire);
        connected = result.success;
      }
    }

    // Auto-layout the canvas
    await runAutoLayout();

    return {
      success: true,
      toolId: newTool.id,
      type: newTool.type,
      connected,
    };
  },
});

/**
 * Update an existing tool's configuration.
 */
export const updateTool = tool({
  description: 'Update the configuration of an existing tool on the canvas.',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to update.'),
    config: z.record(z.string(), z.unknown()).describe('New configuration values to merge with existing config.'),
  }),
  execute: async ({ toolId, config }) => {
    const { tools, updateToolConfiguration } = useWorkflowStore.getState();
    const existing = tools.find((t) => t.id === toolId);
    if (!existing) {
      return { success: false, error: `Tool not found: ${toolId}` };
    }

    // Enrich tool-specific configs for UI compatibility
    const resolvedConfig = enrichToolConfig(existing.type, config);

    const mergedConfig = { ...existing.config, ...resolvedConfig } as ToolConfig;
    updateToolConfiguration(toolId, mergedConfig);
    return { success: true, toolId, updatedFields: Object.keys(config) };
  },
});

/**
 * Remove a tool from the canvas.
 */
export const removeTool = tool({
  description: 'Remove a tool from the canvas. Also removes any wires connected to it.',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to remove.'),
  }),
  execute: async ({ toolId }) => {
    const { tools, removeTool: remove } = useWorkflowStore.getState();
    const existing = tools.find((t) => t.id === toolId);
    if (!existing) {
      return { success: false, error: `Tool not found: ${toolId}` };
    }

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
    fromSocket: z.string().optional().describe('Output socket ID on the source tool. Defaults to the first output socket.'),
    toSocket: z.string().optional().describe('Input socket ID on the target tool. Defaults to the first input socket.'),
  }),
  execute: async ({ fromToolId, toToolId, fromSocket, toSocket }) => {
    const { tools, addWire } = useWorkflowStore.getState();
    const fromTool = tools.find((t) => t.id === fromToolId);
    const toTool = tools.find((t) => t.id === toToolId);

    if (!fromTool) return { success: false, error: `Source tool not found: ${fromToolId}` };
    if (!toTool) return { success: false, error: `Target tool not found: ${toToolId}` };

    // Resolve sockets
    const outputSocket = fromSocket
      ?? fromTool.sockets.find((s) => s.direction === 'output')?.id;
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
    fromSocket: z.string().optional().describe('Output socket ID. Defaults to first output socket.'),
    toSocket: z.string().optional().describe('Input socket ID. Defaults to first input socket.'),
  }),
  execute: async ({ fromToolId, toToolId, fromSocket, toSocket }) => {
    const { tools, wires, removeWire } = useWorkflowStore.getState();
    const fromTool = tools.find((t) => t.id === fromToolId);
    const toTool = tools.find((t) => t.id === toToolId);

    if (!fromTool) return { success: false, error: `Source tool not found: ${fromToolId}` };
    if (!toTool) return { success: false, error: `Target tool not found: ${toToolId}` };

    const outputSocket = fromSocket
      ?? fromTool.sockets.find((s) => s.direction === 'output')?.id;
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
