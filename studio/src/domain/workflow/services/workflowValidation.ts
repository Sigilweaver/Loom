/**
 * Workflow validation.
 *
 * Pure checks over a workflow's tools and wires that find problems a user can
 * fix before running: unconnected inputs, loops, missing required settings and
 * so on. Validation is advisory. It never blocks Run or Preview on its own, so
 * the rules here only flag things that are definitely (error) or very likely
 * (warning) wrong.
 */
import type { Tool, Wire, ToolConfig } from '@domain/workflow/entities/workflow';
import { wouldCreateCycle } from '@domain/workflow/services/loopDetection';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  /** Stable id, unique within one report (safe as a React key). */
  id: string;
  severity: IssueSeverity;
  /** The tool the issue belongs to. Absent for workflow-level issues. */
  toolId?: string;
  /** Display label of the tool, when the issue belongs to one. */
  toolLabel?: string;
  message: string;
}

export interface ValidationOptions {
  /** Friendly display name for a tool (defaults to its type). */
  toolLabel?: (tool: Tool) => string;
}

export interface ValidationSummary {
  errors: number;
  warnings: number;
}

export function summarizeIssues(issues: readonly ValidationIssue[]): ValidationSummary {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === 'error') errors++;
    else warnings++;
  }
  return { errors, warnings };
}

/** Human summary such as "2 errors, 1 warning". */
export function describeSummary({ errors, warnings }: ValidationSummary): string {
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} ${errors === 1 ? 'error' : 'errors'}`);
  if (warnings > 0) parts.push(`${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const nonEmptyArray = (value: unknown): value is unknown[] =>
  Array.isArray(value) && value.length > 0;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

type ConfigRule = (config: ToolConfig) => Array<{ severity: IssueSeverity; message: string }>;

const error = (message: string) => ({ severity: 'error' as const, message });
const warning = (message: string) => ({ severity: 'warning' as const, message });

/** Number of leaf conditions in a nested Filter condition group. */
function countGroupConditions(group: unknown): number {
  const children = asRecord(group).children;
  if (!Array.isArray(children)) return 0;
  return children.reduce<number>((total, child) => {
    return total + (asRecord(child).type === 'group' ? countGroupConditions(child) : 1);
  }, 0);
}

const CONFIG_RULES: Record<string, ConfigRule> = {
  Input: (config) => {
    if (config.category === 'database') {
      const issues = [];
      if (!isNonEmptyString(config.connectionId)) {
        issues.push(error('Choose a database connection.'));
      }
      if (!isNonEmptyString(config.query)) {
        issues.push(error('Enter the SQL query to read.'));
      }
      return issues;
    }
    return isNonEmptyString(config.source) ? [] : [error('Choose a file to read.')];
  },

  Output: (config) =>
    isNonEmptyString(config.destination) ? [] : [error('Choose where to write the output.')],

  Filter: (config) => {
    const hasExpression = isNonEmptyString(config.expression);
    const hasConditions =
      nonEmptyArray(config.conditions) ||
      countGroupConditions(config.conditionGroup) > 0 ||
      nonEmptyArray(config.groups);
    return hasExpression || hasConditions
      ? []
      : [warning('No filter conditions are set, so every row passes through.')];
  },

  Sort: (config) =>
    nonEmptyArray(config.sortColumns) ? [] : [error('Choose at least one column to sort by.')],

  Formula: (config) => {
    const operations = Array.isArray(config.operations) ? config.operations : [];
    if (operations.length > 0) {
      const incomplete = operations.some((op) => {
        const record = asRecord(op);
        return (
          !isNonEmptyString(record.columnName ?? record.column_name) ||
          !isNonEmptyString(record.expression)
        );
      });
      return incomplete
        ? [error('Every calculation needs an output column name and an expression.')]
        : [];
    }
    if (isNonEmptyString(config.expression) && isNonEmptyString(config.column_name)) return [];
    return [error('Add at least one calculation.')];
  },

  Join: (config) => {
    if (config.joinType === 'cross') return [];
    const left = Array.isArray(config.leftKeys) ? config.leftKeys : [];
    const right = Array.isArray(config.rightKeys) ? config.rightKeys : [];
    if (left.length === 0 || right.length === 0) {
      return [error('Choose the key column(s) to join on for both inputs.')];
    }
    if (left.length !== right.length) {
      return [error('The left and right inputs need the same number of key columns.')];
    }
    return [];
  },

  Summarize: (config) => {
    const aggregations = Array.isArray(config.aggregations) ? config.aggregations : [];
    const groupBy = Array.isArray(config.groupByColumns) ? config.groupByColumns : [];
    if (aggregations.length === 0 && groupBy.length === 0) {
      return [error('Choose columns to group by or add an aggregation.')];
    }
    const incomplete = aggregations.some((agg) => {
      const record = asRecord(agg);
      return !isNonEmptyString(record.column) || !isNonEmptyString(record.operation);
    });
    return incomplete ? [error('Every aggregation needs a column and an operation.')] : [];
  },

  Pivot: (config) => {
    const issues = [];
    if (!isNonEmptyString(config.on)) issues.push(error('Choose the column whose values become new columns.'));
    if (!isNonEmptyString(config.values)) issues.push(error('Choose the column that supplies the values.'));
    return issues;
  },

  Unpivot: (config) =>
    nonEmptyArray(config.on) ? [] : [error('Choose at least one column to unpivot.')],
};

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

function socketNoun(tool: Tool, socketId: string): string {
  const socket = tool.sockets.find((s) => s.id === socketId);
  if (socket?.type === 'L') return 'left input';
  if (socket?.type === 'R') return 'right input';
  return 'input';
}

/**
 * Check a workflow and return every problem found, errors first, in a stable
 * order (workflow-level issues, then per tool in canvas order).
 */
export function validateWorkflow(
  tools: readonly Tool[],
  wires: readonly Wire[],
  options: ValidationOptions = {}
): ValidationIssue[] {
  const baseLabel = options.toolLabel ?? ((tool: Tool) => tool.type);
  const issues: ValidationIssue[] = [];
  let nextId = 0;

  // Label tools uniquely: "Filter" when alone, "Filter 1", "Filter 2" otherwise.
  const rawLabels = tools.map((tool) => baseLabel(tool));
  const labelTotals = new Map<string, number>();
  for (const label of rawLabels) labelTotals.set(label, (labelTotals.get(label) ?? 0) + 1);
  const labelSeen = new Map<string, number>();
  const labelByTool = new Map<string, string>();
  tools.forEach((tool, index) => {
    const label = rawLabels[index]!;
    const position = (labelSeen.get(label) ?? 0) + 1;
    labelSeen.set(label, position);
    labelByTool.set(tool.id, (labelTotals.get(label) ?? 0) > 1 ? `${label} ${position}` : label);
  });

  const add = (severity: IssueSeverity, message: string, tool?: Tool) => {
    issues.push({
      id: `issue-${nextId++}`,
      severity,
      message,
      ...(tool && { toolId: tool.id, toolLabel: labelByTool.get(tool.id) ?? tool.type }),
    });
  };

  if (tools.length === 0) {
    add('warning', 'The workflow is empty. Drag tools from the palette onto the canvas to get started.');
    return issues;
  }

  const toolById = new Map(tools.map((tool) => [tool.id, tool]));

  // Wires that point at tools or sockets that no longer exist
  const validWires: Wire[] = [];
  let brokenWires = 0;
  for (const wire of wires) {
    const from = toolById.get(wire.from.tool);
    const to = toolById.get(wire.to.tool);
    const fromOk = from?.sockets.some((s) => s.id === wire.from.socket && s.direction === 'output');
    const toOk = to?.sockets.some((s) => s.id === wire.to.socket && s.direction === 'input');
    if (fromOk && toOk) validWires.push(wire);
    else brokenWires++;
  }
  if (brokenWires > 0) {
    add(
      'error',
      `${brokenWires} ${brokenWires === 1 ? 'connection points' : 'connections point'} to a tool or socket that does not exist. Delete and redraw ${brokenWires === 1 ? 'it' : 'them'}.`
    );
  }

  // Workflow-level structure
  if (!tools.some((tool) => tool.type === 'Input')) {
    add('warning', 'There is no Read tool, so the workflow has no data source.');
  }
  if (!tools.some((tool) => tool.type === 'Output')) {
    add('error', 'Add a Write tool to run this workflow. Previews work without one.');
  }

  // Per-tool checks
  const incoming = new Map<string, Wire[]>();
  const outgoing = new Map<string, Wire[]>();
  for (const wire of validWires) {
    incoming.set(wire.to.tool, [...(incoming.get(wire.to.tool) ?? []), wire]);
    outgoing.set(wire.from.tool, [...(outgoing.get(wire.from.tool) ?? []), wire]);
  }

  for (const tool of tools) {
    const toolIncoming = incoming.get(tool.id) ?? [];
    const toolOutgoing = outgoing.get(tool.id) ?? [];

    // Loops: a wire is part of a loop if adding it back would close one
    const inLoop = toolOutgoing.some((wire) =>
      wouldCreateCycle(
        validWires.filter((w) => w !== wire),
        wire.from.tool,
        wire.to.tool
      )
    );
    if (inLoop) {
      add('error', 'This tool is part of a loop. Data cannot flow in a circle; remove one of the connections.', tool);
    }

    // Unconnected inputs
    for (const socket of tool.sockets.filter((s) => s.direction === 'input')) {
      const connected = toolIncoming.filter((w) => w.to.socket === socket.id).length;
      const noun = socketNoun(tool, socket.id);
      if (connected === 0) {
        add('error', `The ${noun} is not connected.`, tool);
      } else if (socket.multiple && connected < 2) {
        add('warning', `Only one dataset is connected to the ${noun}. Concatenate combines two or more.`, tool);
      }
    }

    // Required settings (skip tools that cannot be configured yet)
    const rule = CONFIG_RULES[tool.type];
    if (rule) {
      for (const found of rule(tool.config)) add(found.severity, found.message, tool);
    }

    // Results nobody uses
    const hasOutputs = tool.sockets.some((s) => s.direction === 'output');
    const hasInputs = tool.sockets.some((s) => s.direction === 'input');
    const feedsSomething = toolOutgoing.length > 0;
    if (hasOutputs && !feedsSomething && (toolIncoming.length > 0 || !hasInputs)) {
      add('warning', 'Nothing uses this tool\'s output. Connect it to another tool or a Write tool.', tool);
    }
  }

  // Two Write tools targeting one file overwrite each other
  const destinations = new Map<string, Tool[]>();
  for (const tool of tools) {
    if (tool.type !== 'Output' || !isNonEmptyString(tool.config.destination)) continue;
    const key = (tool.config.destination as string).trim();
    destinations.set(key, [...(destinations.get(key) ?? []), tool]);
  }
  for (const [destination, group] of destinations) {
    if (group.length < 2) continue;
    for (const tool of group) {
      add('warning', `Another Write tool also writes to ${destination}, so they will overwrite each other.`, tool);
    }
  }

  // Errors first; keep discovery order within a severity
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => {
      if (a.issue.severity !== b.issue.severity) return a.issue.severity === 'error' ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ issue }) => issue);
}
