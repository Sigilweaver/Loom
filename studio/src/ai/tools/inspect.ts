/**
 * Workflow inspection tools.
 *
 * Let the agent check its own edits: read a tool's full config (the canvas
 * summary in the system prompt truncates long values), and validate the
 * whole workflow the way the user would, with Studio's structural checks and
 * a Server run of every tool except Output writers.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { useWorkflowStore } from '@state/workflowStore';
import { previewAllTools } from '@api';
import { validateWorkflow } from '@domain/workflow/services/workflowValidation';
import type { Tool } from '@domain/workflow/entities/workflow';
import { stripInternalIds } from '../prompts/system';
import { formatTypedHeader } from '../format';

function toolLabel(t: Tool): string {
  return `${t.type} [${t.id}]`;
}

/**
 * Return a tool's complete config plus its connections.
 */
export const getToolConfig = tool({
  description: 'Read the complete config, comment and connections of one tool. The canvas summary truncates long values; use this before patching a field you cannot see in full.',
  inputSchema: z.object({
    toolId: z.string().describe('ID of the tool on the canvas.'),
  }),
  execute: async ({ toolId }) => {
    const { tools, wires } = useWorkflowStore.getState();
    const target = tools.find((t) => t.id === toolId);
    if (!target) {
      return { error: `Tool not found: "${toolId}". Tools on canvas: ${tools.map(toolLabel).join(', ') || '(none)'}` };
    }
    const label = (id: string) => {
      const t = tools.find((x) => x.id === id);
      return t ? toolLabel(t) : id;
    };
    const inputs = wires.filter((w) => w.to.tool === toolId)
      .map((w) => `${label(w.from.tool)}.${w.from.socket} -> ${w.to.socket}`);
    const outputs = wires.filter((w) => w.from.tool === toolId)
      .map((w) => `${w.from.socket} -> ${label(w.to.tool)}.${w.to.socket}`);
    const lines = [
      `${toolLabel(target)}${target.comment ? ` // ${target.comment}` : ''}`,
      `Config: ${JSON.stringify(stripInternalIds(target.config))}`,
      `Inputs: ${inputs.join('; ') || '(none)'}`,
      `Outputs: ${outputs.join('; ') || '(none)'}`,
    ];
    return { data: lines.join('\n') };
  },
});

/**
 * Validate the workflow structurally and by running it on the Server.
 */
export const validateWorkflowTool = tool({
  description: 'Check the whole workflow after editing: structural problems (unconnected inputs, loops, missing settings) and a Server run of every tool except Output writers, reporting each tool\'s row count and columns or the error. Call this before telling the user the workflow is done.',
  inputSchema: z.object({}),
  execute: async () => {
    const { tools, wires, workflowMeta } = useWorkflowStore.getState();
    if (tools.length === 0) return { data: 'Canvas is empty - nothing to validate.' };

    const lines: string[] = [];
    const issues = validateWorkflow(tools, wires, { toolLabel: (t) => toolLabel(t) });
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    if (issues.length === 0) {
      lines.push('Structure: OK');
    } else {
      lines.push(`Structure: ${errors.length} error(s), ${warnings.length} warning(s)`);
      for (const i of issues) {
        lines.push(`  ${i.severity}: ${i.toolLabel ? `${i.toolLabel}: ` : ''}${i.message}`);
      }
    }

    // A tool-level structural error (unconnected input, loop) makes the
    // Server run fail with a less specific message; report it and stop.
    // Workflow-level errors (such as "no Output tool") do not stop previews.
    if (errors.some((i) => i.toolId)) {
      lines.push('Run: skipped until the structural errors are fixed.');
      return { data: lines.join('\n') };
    }

    try {
      const workflow = { version: '1.0' as const, tools, wires, meta: workflowMeta };
      const result = await previewAllTools(workflow, 1);
      lines.push('Run: OK');
      for (const t of tools) {
        const outputs = result.tools?.[t.id]?.outputs;
        if (!outputs) {
          lines.push(`  ${toolLabel(t)}: no output (writers are not run during validation)`);
          continue;
        }
        for (const [socket, out] of Object.entries(outputs)) {
          const cols = out.data_schema?.columns ?? [];
          lines.push(`  ${toolLabel(t)}.${socket}: ${out.row_count ?? '?'} rows, ${formatTypedHeader(cols)}`);
        }
      }
    } catch (err) {
      lines.push(`Run: FAILED - ${err instanceof Error ? err.message : String(err)}`);
    }
    return { data: lines.join('\n') };
  },
});
