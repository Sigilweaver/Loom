/**
 * Simplified Spec Compiler
 *
 * Compiles a simplified workflow specification (produced by the AI agent)
 * into the full Sigilweaver workflow format. This is more token-efficient
 * than having the agent produce full Tool objects with IDs and sockets.
 *
 * The compiler handles:
 * - Socket injection per tool type
 * - Connection resolution (simple {from, to} into proper Wire format)
 * - Config normalization
 * - Auto-layout (topological sort, position assignment)
 * - Metadata generation (IDs, timestamps)
 */

import { getToolDefinition } from '@data/tools';
import { generateUniqueId } from '@utils/id';
import { autoLayout } from '@domain/workflow/services/autoLayout';
import { enrichToolConfig } from './tools/canvas';
import { generateComment } from '@domain/workflow/services/commentGenerator';
import type { Tool, Wire, WorkflowMeta, ToolConfig } from '@domain/workflow/entities/workflow';
import { DEFAULT_ENGINE } from '@domain/workflow/entities/workflow';

// ---------------------------------------------------------------------------
// Simplified spec types (what the agent produces)
// ---------------------------------------------------------------------------

export interface SimplifiedStep {
  /** Agent-assigned ID for referencing in connections (e.g. "load", "filter1") */
  id: string;
  /** Tool type (e.g. "Input", "Filter", "Formula") — uses internal type identifiers */
  type: string;
  /** Tool configuration */
  config?: Record<string, unknown> | undefined;
  /** Brief human-readable comment explaining what this step does */
  comment?: string | undefined;
}

export interface SimplifiedConnection {
  /** Source step ID */
  from: string;
  /** Target step ID */
  to: string;
  /** Source socket name (defaults to "Output") — socket ID, not tool name */
  fromSocket?: string | undefined;
  /** Target socket name (defaults to "Input") — socket ID, not tool name */
  toSocket?: string | undefined;
}

export interface SimplifiedSpec {
  /** Workflow steps */
  steps: SimplifiedStep[];
  /** Connections between steps */
  connections: SimplifiedConnection[];
  /** Optional workflow name */
  name?: string | undefined;
  /** Optional workflow description */
  description?: string | undefined;
}

// ---------------------------------------------------------------------------
// Compilation result
// ---------------------------------------------------------------------------

export interface CompileResult {
  success: boolean;
  tools?: Tool[];
  wires?: Wire[];
  meta?: WorkflowMeta;
  errors?: string[];
}

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

/**
 * Compile a simplified spec into a full workflow.
 */
export function compileSpec(spec: SimplifiedSpec, author?: string): CompileResult {
  const errors: string[] = [];
  const idMap = new Map<string, string>(); // simplified ID -> generated ID
  const existingIds = new Set<string>();

  // 1. Validate and create tools
  const tools: Tool[] = [];
  for (const step of spec.steps) {
    const def = getToolDefinition(step.type);
    if (!def) {
      errors.push(`Unknown tool type: "${step.type}" (step "${step.id}")`);
      continue;
    }

    if (idMap.has(step.id)) {
      errors.push(`Duplicate step ID: "${step.id}"`);
      continue;
    }

    const toolId = generateUniqueId(existingIds);
    existingIds.add(toolId);
    idMap.set(step.id, toolId);

    const config: ToolConfig = { ...def.defaultConfig };
    if (step.config) {
      // Run enrichment for tool types that need config normalization
      const enriched = enrichToolConfig(step.type, step.config);
      for (const [key, value] of Object.entries(enriched)) {
        config[key] = value as ToolConfig[string];
      }
    }

    // Resolve comment: use agent-provided, or auto-generate from config
    const resolvedComment = step.comment || generateComment(def.type, config) || undefined;

    tools.push({
      id: toolId,
      type: def.type,
      x: 0,
      y: 0,
      config,
      sockets: [...def.sockets],
      ...(resolvedComment ? { comment: resolvedComment } : {}),
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 2. Resolve connections into wires
  const wires: Wire[] = [];
  for (const conn of spec.connections) {
    const fromId = idMap.get(conn.from);
    const toId = idMap.get(conn.to);

    if (!fromId) {
      errors.push(`Connection references unknown step: "${conn.from}"`);
      continue;
    }
    if (!toId) {
      errors.push(`Connection references unknown step: "${conn.to}"`);
      continue;
    }

    const fromTool = tools.find((t) => t.id === fromId);
    const toTool = tools.find((t) => t.id === toId);

    if (!fromTool || !toTool) continue;

    // Resolve socket IDs
    const fromSocket = conn.fromSocket
      ?? fromTool.sockets.find((s) => s.direction === 'output')?.id
      ?? 'Output';
    const toSocket = conn.toSocket
      ?? toTool.sockets.find((s) => s.direction === 'input')?.id
      ?? 'Input';

    wires.push({
      from: { tool: fromId, socket: fromSocket },
      to: { tool: toId, socket: toSocket },
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 3. Auto-layout
  const layout = autoLayout(tools, wires);
  for (const pos of layout.positions) {
    const t = tools.find((tool) => tool.id === pos.id);
    if (t) {
      t.x = pos.x;
      t.y = pos.y;
    }
  }

  // 4. Generate metadata
  const meta: WorkflowMeta = {
    name: spec.name || 'AI-Generated Workflow',
    description: spec.description || 'Workflow created by AI assistant',
    author: author || 'AI Assistant',
    workflowId: crypto.randomUUID(),
    created: new Date().toISOString(),
    defaultEngine: DEFAULT_ENGINE,
  };

  return { success: true, tools, wires, meta };
}
