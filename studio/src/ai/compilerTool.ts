/**
 * Compiler Tool
 *
 * Vercel AI SDK tool definition that wraps the spec compiler,
 * allowing the agent to build an entire workflow from a simplified spec.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { compileSpec, type SimplifiedSpec } from './compiler';
import { useWorkflowStore } from '@state/workflowStore';
import { useSettingsStore } from '@state/settingsStore';
import { getToolSchema } from '@api';
import { createLogger } from '../utils/logger';

const logger = createLogger('AI:CompilerTool');

/**
 * Build a complete workflow from a simplified spec.
 * Replaces the current canvas contents.
 */
export const buildWorkflowTool = tool({
  description: 'Build a complete workflow from a simplified specification. Replaces the current canvas. Returns idMap (step IDs to canvas UUIDs) and inputColumns (first Input tool columns).',
  inputSchema: z.object({
    steps: z.array(z.object({
      id: z.string().describe('Simple ID for referencing in connections'),
      type: z.string().describe('Tool type (e.g. "Input", "Filter")'),
      config: z.record(z.string(), z.unknown()).optional().describe('Tool configuration'),
    })).describe('Workflow steps'),
    connections: z.array(z.object({
      from: z.string().describe('Source step ID'),
      to: z.string().describe('Target step ID'),
      fromSocket: z.string().optional().describe('Source socket (default: "Output")'),
      toSocket: z.string().optional().describe('Target socket (default: "Input")'),
    })).describe('Connections between steps'),
    name: z.string().optional().describe('Workflow name'),
    description: z.string().optional().describe('Workflow description'),
  }),
  execute: async ({ steps, connections, name, description }) => {
    const spec: SimplifiedSpec = { steps, connections, name, description };
    const author = useSettingsStore.getState().author;
    const result = compileSpec(spec, author);

    if (!result.success || !result.tools || !result.wires || !result.meta) {
      return { success: false, errors: result.errors };
    }

    // Load the compiled workflow onto the canvas
    useWorkflowStore.getState().loadWorkflow(result.tools, result.wires, result.meta);

    // Return the simple-ID → UUID mapping so the agent can reference tools
    // by their canvas IDs (e.g. for preview_tool_output) without needing
    // to call get_canvas_state first.
    const idMap: Record<string, string> = {};
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const compiled = result.tools[i];
      if (compiled) {
        idMap[step.id] = compiled.id;
      }
    }

    // Proactively fetch column metadata for Input tools so the agent
    // knows what columns are available without a separate tool call.
    let inputColumns: Array<{ name: string; dtype: string }> | undefined;
    const firstInput = result.tools.find((t) => t.type === 'Input');
    if (firstInput) {
      try {
        const workflow = { version: '1.0' as const, tools: result.tools, wires: result.wires, meta: result.meta };
        const socket = firstInput.sockets.find((s) => s.direction === 'output')?.id ?? 'output';
        const schemaResult = await getToolSchema(firstInput.id, workflow, socket);
        inputColumns = schemaResult.data_schema?.columns?.map((c) => ({
          name: c.name,
          dtype: c.dtype,
        }));
      } catch (err) {
        // Non-fatal — agent can still call get_column_metadata manually
        logger.warn('Failed to fetch input columns for build_workflow', err);
      }
    }

    return {
      success: true,
      toolCount: result.tools.length,
      wireCount: result.wires.length,
      workflowName: result.meta.name,
      idMap,
      ...(inputColumns ? { inputColumns } : {}),
    };
  },
});
