/**
 * Reference Tools
 *
 * Lets the agent look up the full config schema of a tool type on demand,
 * so the system prompt only needs a compact example per tool.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { listToolTypes, getToolConfigSchema } from '@data/toolConfigSchemas';
import { resolveToolType } from './toolTypes';

/**
 * Get the config schema for a specific tool type.
 */
export const getToolSchemaTool = tool({
  description: 'Get the full configuration schema for a tool type: every field, its type, default, allowed values and description. Use it before configuring a field that the Tool Config Reference does not show.',
  inputSchema: z.object({
    toolType: z.string().describe('Tool type, e.g. "Filter", "Input", "Summarize". Display names such as "Aggregate" also work.'),
  }),
  execute: async ({ toolType }) => {
    const resolved = resolveToolType(toolType);
    const schema = resolved ? getToolConfigSchema(resolved) : undefined;
    if (!schema) {
      const available = listToolTypes().map((t) => t.type).join(', ');
      return { error: `No schema for tool type "${toolType}". Available types: ${available}` };
    }
    return { data: JSON.stringify(schema) };
  },
});
