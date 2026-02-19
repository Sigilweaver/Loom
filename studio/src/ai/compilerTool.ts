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
import { getToolSchema, profileColumns } from '@api';
import { formatCompactProfile, type ProfileColumn } from './format';
import { createLogger } from '../utils/logger';

const logger = createLogger('AI:CompilerTool');

/**
 * Build a complete workflow from a simplified spec.
 * Replaces the current canvas contents.
 * Returns an inline data profile for the first Input tool so the agent
 * immediately understands the dataset (column types, ranges, nulls, top values).
 */
export const buildWorkflowTool = tool({
  description: 'Build a complete workflow from a simplified specification. Replaces the current canvas. Returns idMap (step IDs to canvas UUIDs) and a compact data profile for the first Input tool.',
  // Cache breakpoint: placed on the last tool so Anthropic caches the full
  // tool-definition block (all 11 tools). Other providers ignore this.
  providerOptions: {
    anthropic: { cacheControl: { type: 'ephemeral' } },
  },
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

    // Proactively fetch a data profile for the first Input tool so the agent
    // immediately understands the dataset — column types, ranges, nulls,
    // unique counts, and top values for string columns.
    let inputProfile: string | undefined;
    const firstInput = result.tools.find((t) => t.type === 'Input');
    if (firstInput) {
      try {
        const workflow = { version: '1.0' as const, tools: result.tools, wires: result.wires, meta: result.meta };
        const socket = firstInput.sockets.find((s) => s.direction === 'output')?.id ?? 'output';

        // Try profile first (richer info), fall back to schema-only
        try {
          const profileResult = await profileColumns(firstInput.id, workflow, socket);
          const profileCols: ProfileColumn[] = Object.entries(profileResult.columns).map(([colName, profile]) => ({
            name: colName,
            dtype: profile.dtype,
            count: profile.count,
            nulls: profile.null_count != null && profile.null_count > 0 ? profile.null_count : undefined,
            null_pct: profile.null_percent != null && profile.null_count != null && profile.null_count > 0
              ? Math.round(profile.null_percent * 10) / 10
              : undefined,
            unique: profile.unique_count,
            min: profile.min,
            max: profile.max,
            mean: profile.mean != null ? Math.round((profile.mean as number) * 100) / 100 : undefined,
            top_values: profile.top_values?.slice(0, 5).map((tv) => ({
              value: String(tv.value),
              count: tv.count,
            })),
          }));
          inputProfile = formatCompactProfile(profileResult.row_count, profileResult.column_count, profileCols);
        } catch {
          // Profile failed — fall back to schema only
          const schemaResult = await getToolSchema(firstInput.id, workflow, socket);
          const cols = schemaResult.data_schema?.columns;
          if (cols) {
            inputProfile = `Schema: ${cols.map((c) => `${c.name}:${c.dtype}`).join(', ')}`;
          }
        }
      } catch (err) {
        // Non-fatal — agent can still call get_column_metadata or profile_tool_data manually
        logger.warn('Failed to fetch input profile for build_workflow', err);
      }
    }

    // Build compact text result
    const idMapStr = Object.entries(idMap)
      .map(([stepId, uuid]) => `  ${stepId} → ${uuid}`)
      .join('\n');

    const parts: string[] = [];
    parts.push(`Built "${result.meta.name}": ${result.tools.length} tools, ${result.wires.length} wires`);
    parts.push(`ID map:\n${idMapStr}`);
    if (inputProfile) {
      parts.push(`Input data profile:\n${inputProfile}`);
    }

    return { data: parts.join('\n\n') };
  },
});
