/**
 * Data Inspection Tools
 *
 * Vercel AI SDK tool definitions for inspecting data — previews,
 * schemas, column metadata, file browsing.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { useWorkflowStore } from '@state/workflowStore';
import { useSettingsStore } from '@state/settingsStore';
import {
  previewTool,
  getToolSchema,
} from '@api';
import { listFiles, listFileRoots } from '@api/backend';

/**
 * List available data files on the server.
 */
export const listAvailableFiles = tool({
  description: 'List available data files on the server. Optionally specify a directory to browse. Returns file names, types, and sizes.',
  inputSchema: z.object({
    directory: z.string().optional().describe('Directory path to browse. Omit to list root directories.'),
  }),
  execute: async ({ directory }) => {
    const settings = useSettingsStore.getState();
    const serverUrl = settings.backend.url;
    // Browse token is typically the auth token — use empty string if none
    const browseToken = '';

    try {
      if (!directory) {
        const roots = await listFileRoots(serverUrl, browseToken);
        return { roots, type: 'roots' };
      }
      const files = await listFiles(serverUrl, browseToken, directory);
      return { files, directory, type: 'listing' };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

/**
 * Preview a tool's output data.
 */
export const previewToolOutput = tool({
  description: 'Execute a tool and preview its output data. Returns sample rows and schema. Use this to verify that a tool produces correct results.',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to preview.'),
    socketId: z.string().optional().describe('Output socket ID. Defaults to the first output socket.'),
    limit: z.number().optional().describe('Max rows to return. Default 20.'),
  }),
  execute: async ({ toolId, socketId, limit }) => {
    const { tools, wires, workflowMeta } = useWorkflowStore.getState();
    const targetTool = tools.find((t) => t.id === toolId);
    if (!targetTool) {
      return { error: `Tool not found: ${toolId}` };
    }

    const socket = socketId
      ?? targetTool.sockets.find((s) => s.direction === 'output')?.id
      ?? 'Output';

    try {
      const workflow = { version: '1.0', tools, wires, meta: workflowMeta };
      const result = await previewTool(toolId, workflow, socket, limit ?? 20);
      const rows = result.data?.slice(0, limit ?? 20) ?? [];
      return {
        rows,
        schema: result.data_schema?.columns ?? [],
        rowCount: result.row_count ?? rows.length,
        truncated: rows.length > (limit ?? 20),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

/**
 * Get column metadata for a tool's output.
 */
export const getColumnMetadata = tool({
  description: 'Get column names and data types for a tool\'s output without executing it. Faster than preview — use this to understand the data shape.',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to inspect.'),
    socketId: z.string().optional().describe('Socket ID. Defaults to first output socket.'),
  }),
  execute: async ({ toolId, socketId }) => {
    const { tools, wires, workflowMeta } = useWorkflowStore.getState();
    const targetTool = tools.find((t) => t.id === toolId);
    if (!targetTool) {
      return { error: `Tool not found: ${toolId}` };
    }

    const socket = socketId
      ?? targetTool.sockets.find((s) => s.direction === 'output')?.id
      ?? 'Output';

    try {
      const workflow = { version: '1.0', tools, wires, meta: workflowMeta };
      const result = await getToolSchema(toolId, workflow, socket);
      return {
        columns: result.data_schema?.columns?.map((c) => ({
          name: c.name,
          dtype: c.dtype,
          nullable: c.nullable ?? false,
        })) ?? [],
        toolType: targetTool.type,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});
