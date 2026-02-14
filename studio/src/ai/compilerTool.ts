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

/**
 * Build a complete workflow from a simplified spec.
 * Replaces the current canvas contents.
 */
export const buildWorkflowTool = tool({
  description: `Build a complete workflow from a simplified specification. This replaces the current canvas contents. Use this for building workflows from scratch rather than modifying existing ones. The spec uses simple IDs for steps and connections — the compiler handles UUID generation, socket injection, and auto-layout.

Example spec:
{
  "steps": [
    { "id": "load", "type": "Input", "config": { "category": "file", "type": "csv", "source": "/data/example.csv" } },
    { "id": "filter", "type": "Filter", "config": { "expression": "pl.col('Age') > 18" } },
    { "id": "sort", "type": "Sort", "config": { "sortColumns": [{ "column": "Age", "order": "ascending" }] } }
  ],
  "connections": [
    { "from": "load", "to": "filter" },
    { "from": "filter", "to": "sort" }
  ]
}`,
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

    return {
      success: true,
      toolCount: result.tools.length,
      wireCount: result.wires.length,
      workflowName: result.meta.name,
    };
  },
});
