/**
 * Reference Tools
 *
 * Vercel AI SDK tool definitions for querying tool type information
 * and configuration schemas. Helps the agent know what's available.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { listToolTypes, getToolConfigSchema } from '@data/toolConfigSchemas';

/**
 * List all available tool types with descriptions.
 */
export const listToolTypesTool = tool({
  description: 'List all available tool types in Sigilweaver with their descriptions. Use this to discover what tools you can add to the canvas.',
  inputSchema: z.object({}),
  execute: async () => {
    return { toolTypes: listToolTypes() };
  },
});

/**
 * Get the config schema for a specific tool type.
 */
export const getToolSchemaTool = tool({
  description: 'Get the configuration schema for a specific tool type. Shows what fields are available, their types, defaults, and valid values. Use this before configuring a tool.',
  inputSchema: z.object({
    toolType: z.string().describe('The tool type to get the schema for (e.g. "Filter", "Input", "Formula").'),
  }),
  execute: async ({ toolType }) => {
    const schema = getToolConfigSchema(toolType);
    if (!schema) {
      return { error: `No schema found for tool type: ${toolType}. Use list_tool_types to see available types.` };
    }
    return { schema };
  },
});
