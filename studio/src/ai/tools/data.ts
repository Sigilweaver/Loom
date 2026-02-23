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
  profileColumns,
} from '@api';
import { formatPreviewResult, formatCompactProfile, type ProfileColumn } from '../format';
import { listFiles, listFileRoots, searchFiles, getSessionToken } from '@api/backend';
import { getHubClient, hasHubClient, initHubClient } from '@api/hub';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AI:DataTools');

/**
 * Find a tool by ID, returning a helpful error if not found.
 * Lists available tool IDs so the agent can self-correct.
 */
function findToolOrError(toolId: string): { tool: ReturnType<typeof useWorkflowStore.getState>['tools'][number] } | { error: string } {
  const { tools } = useWorkflowStore.getState();
  const target = tools.find((t) => t.id === toolId);
  if (target) return { tool: target };

  const available = tools.map((t) => `  ${t.type} [${t.id}]`).join('\n');
  return {
    error: `Tool not found: "${toolId}". Available tools on canvas:\n${available || '  (canvas is empty)'}`,
  };
}

/**
 * Get browse token and server URL based on the current execution mode.
 *
 * - Hub mode: requests a single-use browse token from the Hub.
 * - External mode: uses the session token + configured backend URL.
 * - Bundled mode: uses session token or empty string + backend URL.
 */
async function getBrowseAuth(): Promise<{ token: string; serverUrl: string }> {
  const { executionMode, backend, hub } = useSettingsStore.getState();

  if (executionMode === 'hub') {
    // Restore HubClient if lost (e.g. HMR reload)
    if (!hasHubClient() && hub.sessionToken && hub.url) {
      initHubClient({ url: hub.url, sessionToken: hub.sessionToken });
    }
    if (!hasHubClient()) {
      throw new Error('Hub client not available — check Hub connection in Settings');
    }
    const hubClient = getHubClient();
    const tokenResponse = await hubClient.requestToken();
    return { token: tokenResponse.token, serverUrl: tokenResponse.server_endpoint };
  }

  // External or bundled mode: use session token directly
  const token = getSessionToken() ?? '';
  return { token, serverUrl: backend.url };
}

/**
 * List available data files on the server.
 */
export const listAvailableFiles = tool({
  description: 'List data files. Omit directory to see roots, or pass a root to list its files.',
  inputSchema: z.object({
    directory: z.string().optional().describe('A directory path from the roots list. Omit to list available root directories.'),
  }),
  execute: async ({ directory }) => {
    try {
      const { token, serverUrl } = await getBrowseAuth();

      if (!directory) {
        const roots = await listFileRoots(serverUrl, token);
        return { roots, hint: 'Pass a root as "directory" to list files' };
      }
      const files = await listFiles(serverUrl, token, directory);
      return { files };
    } catch (err) {
      logger.error('listAvailableFiles failed', err);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

/**
 * Preview a tool's output data.
 * Returns compact CSV text instead of JSON to minimize token usage.
 */
export const previewToolOutput = tool({
  description: 'Execute a tool and preview its output as CSV with typed headers.',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to preview.'),
    socketId: z.string().optional().describe('Output socket ID. Defaults to the first output socket.'),
    limit: z.number().optional().describe('Max rows to return. Default 10.'),
  }),
  execute: async ({ toolId, socketId, limit }) => {
    const { tools, wires, workflowMeta } = useWorkflowStore.getState();
    const found = findToolOrError(toolId);
    if ('error' in found) return found;
    const targetTool = found.tool;

    const socket = socketId
      ?? targetTool.sockets.find((s) => s.direction === 'output')?.id
      ?? 'Output';

    try {
      const effectiveLimit = limit ?? 10;
      const workflow = { version: '1.0', tools, wires, meta: workflowMeta };
      const result = await previewTool(toolId, workflow, socket, effectiveLimit);
      const rows = result.data?.slice(0, effectiveLimit) ?? [];
      const schema = result.data_schema?.columns ?? [];
      const rowCount = result.row_count ?? rows.length;

      return { data: formatPreviewResult(rows, schema, rowCount) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

/**
 * Get column metadata for a tool's output (schema only, no data).
 */
export const getColumnMetadata = tool({
  description: 'Get column names and types for a tool\'s output without executing. Faster than preview.',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to inspect.'),
    socketId: z.string().optional().describe('Socket ID. Defaults to first output socket.'),
  }),
  execute: async ({ toolId, socketId }) => {
    const { tools, wires, workflowMeta } = useWorkflowStore.getState();
    const found = findToolOrError(toolId);
    if ('error' in found) return found;
    const targetTool = found.tool;

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

/**
 * Search for data files by name across all accessible directories.
 */
export const searchFilesTool = tool({
  description: 'Search for data files by name across all directories. Returns paths for Read tool config.',
  inputSchema: z.object({
    query: z.string().describe('Search text to match against filenames (e.g. "titanic", "sales_2024").'),
    extensions: z.string().optional().describe('Comma-separated extensions to filter (e.g. "csv,parquet"). Omit for all data formats.'),
  }),
  execute: async ({ query, extensions }) => {
    try {
      const { token, serverUrl } = await getBrowseAuth();
      const result = await searchFiles(serverUrl, token, query, extensions);
      return {
        results: result.results.map((r) => ({
          name: r.name,
          path: r.path,
          extension: r.extension,
          size: r.size,
          score: r.score,
        })),
      };
    } catch (err) {
      logger.error('searchFiles failed', err);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

/**
 * Profile a tool's output data — get statistics (min, max, mean, nulls, top values, etc.)
 * Returns compact text profile instead of JSON to minimize token usage.
 */
export const profileToolData = tool({
  description: 'Get column statistics (min, max, mean, nulls, uniques, top values) for a tool\'s output. Returns compact text.',
  inputSchema: z.object({
    toolId: z.string().describe('The ID of the tool to profile.'),
    socketId: z.string().optional().describe('Output socket ID. Defaults to the first output socket.'),
    columns: z.array(z.string()).optional().describe('Specific columns to profile. Omit to profile all columns.'),
  }),
  execute: async ({ toolId, socketId, columns }) => {
    const { tools, wires, workflowMeta } = useWorkflowStore.getState();
    const found = findToolOrError(toolId);
    if ('error' in found) return found;
    const targetTool = found.tool;

    const socket = socketId
      ?? targetTool.sockets.find((s) => s.direction === 'output')?.id
      ?? 'Output';

    try {
      const workflow = { version: '1.0', tools, wires, meta: workflowMeta };
      const result = await profileColumns(toolId, workflow, socket, columns);

      // Build compact profile columns for the formatter
      const profileCols: ProfileColumn[] = Object.entries(result.columns).map(([name, profile]) => ({
        name,
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

      return {
        data: formatCompactProfile(result.row_count, result.column_count, profileCols),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});
