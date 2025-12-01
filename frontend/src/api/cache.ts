/**
 * Workflow caching service for preview and schema requests
 *
 * Provides:
 * - Workflow normalization (strips UI-only fields)
 * - Cache key generation based on tool + upstream dependencies
 * - Automatic invalidation when dependencies change
 */

import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import type { SchemaResponse, ExecuteResponse, MetadataResponse } from './backend';
import { getRuntimeLogActions, type RequestContext } from '../state/runtimeLogStore';
import { createLogger } from '@utils/logger';

const logger = createLogger('Cache');

/**
 * Normalized tool representation for cache key computation
 * Excludes UI-only fields (x, y, socket type labels)
 */
interface NormalizedTool {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

/**
 * Normalized workflow for cache key computation
 */
interface NormalizedWorkflow {
  tools: NormalizedTool[];
  wires: Array<{
    from: { tool: string; socket: string };
    to: { tool: string; socket: string };
  }>;
}

/**
 * Cache entry types
 */
interface SchemaCacheEntry {
  type: 'schema';
  data: SchemaResponse;
}

interface PreviewCacheEntry {
  type: 'preview';
  data: ExecuteResponse;
  limit: number;
}

interface MetadataCacheEntry {
  type: 'metadata';
  data: MetadataResponse;
}

type CacheEntry = SchemaCacheEntry | PreviewCacheEntry | MetadataCacheEntry;

/**
 * Global cache storage
 * No size limit - entries are only removed via explicit invalidation or workflow closure
 * Cache keys are computed from tool config + upstream dependencies, so configuration
 * changes automatically invalidate affected entries.
 */
const cache = new Map<string, CacheEntry>();

/**
 * Strip UI-only fields from a tool for normalization
 */
function normalizeTool(tool: WorkflowJSON['tools'][0]): NormalizedTool {
  // Strip _emit from config as it's not relevant for execution
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _emit, ...configWithoutEmit } = tool.config as Record<string, unknown>;
  
  return {
    id: tool.id,
    type: tool.type,
    config: configWithoutEmit,
  };
}

/**
 * Normalize workflow by stripping UI-only fields
 * This creates a representation suitable for cache key computation
 */
export function normalizeWorkflow(workflow: WorkflowJSON): NormalizedWorkflow {
  return {
    tools: workflow.tools.map(normalizeTool),
    wires: workflow.wires.map(wire => ({
      from: { tool: wire.from.tool, socket: wire.from.socket },
      to: { tool: wire.to.tool, socket: wire.to.socket },
    })),
  };
}

/**
 * Get all upstream tool IDs for a given tool (recursive)
 */
export function getUpstreamToolIds(
  toolId: string,
  wires: WorkflowJSON['wires'],
  visited: Set<string> = new Set()
): Set<string> {
  // Find all wires that connect TO this tool
  const incomingWires = wires.filter(w => w.to.tool === toolId);
  
  for (const wire of incomingWires) {
    const upstreamToolId = wire.from.tool;
    if (!visited.has(upstreamToolId)) {
      visited.add(upstreamToolId);
      // Recursively get upstream of the upstream tool
      getUpstreamToolIds(upstreamToolId, wires, visited);
    }
  }
  
  return visited;
}

/**
 * Compute a cache key for a tool based on its config and all upstream dependencies
 */
export function computeCacheKey(
  toolId: string,
  workflow: WorkflowJSON,
  cacheType: 'schema' | 'preview' | 'metadata',
  previewLimit?: number,
  socketId?: string
): string {
  const normalized = normalizeWorkflow(workflow);
  
  // Get the target tool
  const targetTool = normalized.tools.find(t => t.id === toolId);
  if (!targetTool) {
    return `${cacheType}:${toolId}:invalid`;
  }
  
  // Get all upstream tool IDs
  const upstreamIds = getUpstreamToolIds(toolId, workflow.wires);
  
  // Get upstream tools sorted by ID for deterministic key
  const upstreamTools = normalized.tools
    .filter(t => upstreamIds.has(t.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  
  // Get relevant wires (connecting to target or its upstream)
  const relevantToolIds = new Set([toolId, ...upstreamIds]);
  const relevantWires = normalized.wires
    .filter(w => relevantToolIds.has(w.to.tool))
    .sort((a, b) => {
      const keyA = `${a.from.tool}:${a.from.socket}->${a.to.tool}:${a.to.socket}`;
      const keyB = `${b.from.tool}:${b.from.socket}->${b.to.tool}:${b.to.socket}`;
      return keyA.localeCompare(keyB);
    });
  
  // Build cache key components
  const keyData = {
    workflowId: workflow.meta.workflowId, // Namespace by workflow
    type: cacheType,
    target: {
      id: targetTool.id,
      type: targetTool.type,
      config: targetTool.config,
    },
    upstream: upstreamTools.map(t => ({
      id: t.id,
      type: t.type,
      config: t.config,
    })),
    wires: relevantWires,
    ...(previewLimit !== undefined && { limit: previewLimit }),
    ...(socketId !== undefined && { socketId }),
  };
  
  // Use JSON stringification for simple hashing
  // This is fast enough for our use case
  return JSON.stringify(keyData);
}

/**
 * Get cached schema response
 */
export function getCachedSchema(
  toolId: string,
  workflow: WorkflowJSON,
  context?: RequestContext
): SchemaResponse | null {
  const key = computeCacheKey(toolId, workflow, 'schema');
  const entry = cache.get(key);
  const endpoint = '/workflow/tool/schema';
  const { logCacheHit, logCacheMiss } = getRuntimeLogActions();
  
  if (entry?.type === 'schema') {
    logCacheHit(endpoint, { ...context, toolId });
    return entry.data;
  }
  
  logCacheMiss(endpoint, { ...context, toolId });
  return null;
}

/**
 * Cache a schema response
 */
export function cacheSchema(
  toolId: string,
  workflow: WorkflowJSON,
  data: SchemaResponse
): void {
  const key = computeCacheKey(toolId, workflow, 'schema');
  cache.set(key, { type: 'schema', data });
}

/**
 * Get cached preview response
 */
export function getCachedPreview(
  toolId: string,
  workflow: WorkflowJSON,
  limit: number,
  context?: RequestContext
): ExecuteResponse | null {
  const key = computeCacheKey(toolId, workflow, 'preview', limit);
  const entry = cache.get(key);
  const endpoint = '/workflow/tool/execute';
  const { logCacheHit, logCacheMiss } = getRuntimeLogActions();
  
  if (entry?.type === 'preview' && entry.limit === limit) {
    logCacheHit(endpoint, { ...context, toolId });
    return entry.data;
  }
  
  logCacheMiss(endpoint, { ...context, toolId });
  return null;
}

/**
 * Cache a preview response
 */
export function cachePreview(
  toolId: string,
  workflow: WorkflowJSON,
  limit: number,
  data: ExecuteResponse
): void {
  const key = computeCacheKey(toolId, workflow, 'preview', limit);
  cache.set(key, { type: 'preview', data, limit });
}

/**
 * Cache all previews from a "Preview All" response
 * This populates the same cache used by individual preview requests.
 */
export function cacheAllPreviews(
  workflow: WorkflowJSON,
  limit: number,
  allPreviews: Record<string, { outputs: Record<string, unknown> }>
): void {
  for (const [toolId, toolData] of Object.entries(allPreviews)) {
    // Convert to ExecuteResponse format
    const executeResponse: ExecuteResponse = {
      tool_id: toolId,
      outputs: toolData.outputs as ExecuteResponse['outputs'],
    };
    cachePreview(toolId, workflow, limit, executeResponse);
  }
  logger.debug(`Cached previews for ${Object.keys(allPreviews).length} tools`);
}

/**
 * Get cached metadata response
 */
export function getCachedMetadata(
  toolId: string,
  workflow: WorkflowJSON,
  socketId?: string,
  context?: RequestContext
): MetadataResponse | null {
  const key = computeCacheKey(toolId, workflow, 'metadata', undefined, socketId);
  const entry = cache.get(key);
  const endpoint = '/workflow/tool/metadata';
  const { logCacheHit, logCacheMiss } = getRuntimeLogActions();
  
  if (entry?.type === 'metadata') {
    logCacheHit(endpoint, { ...context, toolId });
    return entry.data;
  }
  
  logCacheMiss(endpoint, { ...context, toolId });
  return null;
}

/**
 * Cache a metadata response
 */
export function cacheMetadata(
  toolId: string,
  workflow: WorkflowJSON,
  data: MetadataResponse,
  socketId?: string
): void {
  const key = computeCacheKey(toolId, workflow, 'metadata', undefined, socketId);
  cache.set(key, { type: 'metadata', data });
}

/**
 * Invalidate all cache entries for a specific tool in a specific workflow
 * Call this when a tool's config changes
 */
export function invalidateTool(toolId: string, workflowId?: string): void {
  const keysToDelete: string[] = [];
  
  for (const key of cache.keys()) {
    // Check if this key involves the tool (as target or upstream)
    const matchesTool = key.includes(`"id":"${toolId}"`);
    const matchesWorkflow = !workflowId || key.includes(`"workflowId":"${workflowId}"`);
    
    if (matchesTool && matchesWorkflow) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    cache.delete(key);
  }
}

/**
 * Invalidate cache entries affected by a wire change
 * Call this when wires are added or removed
 */
export function invalidateWireChange(
  affectedToolId: string,
  wires: WorkflowJSON['wires'],
  workflowId?: string
): void {
  // Get all downstream tools that might be affected
  const affectedTools = new Set<string>([affectedToolId]);
  
  // Find all tools downstream of the affected tool
  let changed = true;
  while (changed) {
    changed = false;
    for (const wire of wires) {
      if (affectedTools.has(wire.from.tool) && !affectedTools.has(wire.to.tool)) {
        affectedTools.add(wire.to.tool);
        changed = true;
      }
    }
  }
  
  // Invalidate all affected tools
  for (const toolId of affectedTools) {
    invalidateTool(toolId, workflowId);
  }
}

/**
 * Clear cache entries for a specific workflow
 * Call this when closing a workflow tab
 */
export function clearWorkflowCache(workflowId: string): void {
  const keysToDelete: string[] = [];
  
  logger.debug('Clearing cache for workflowId:', workflowId);
  
  for (const key of cache.keys()) {
    if (key.includes(`"workflowId":"${workflowId}"`)) {
      keysToDelete.push(key);
    }
  }
  
  logger.debug(`Found ${keysToDelete.length} cache entries to delete for workflow ${workflowId}`);
  
  for (const key of keysToDelete) {
    cache.delete(key);
  }
  
  logger.debug(`Cache size after clear: ${cache.size}`);
}

/**
 * Clear entire cache (all workflows)
 * Call this on app shutdown or for debugging
 */
export function clearAllCaches(): void {
  cache.clear();
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): { size: number } {
  return {
    size: cache.size,
  };
}
