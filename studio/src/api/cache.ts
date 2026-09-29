/**
 * Workflow caching service for preview and schema requests
 *
 * Provides:
 * - Workflow normalization (strips UI-only fields)
 * - Cache key generation based on tool + upstream dependencies
 * - Automatic invalidation when dependencies change
 * - Backend cache synchronization on workflow close
 */

import type { WorkflowJSON } from '../domain/workflow/services/WorkflowSerializer';
import type { SchemaResponse, ExecuteResponse, MetadataResponse, DataSchema } from './backend';
import { closeWorkflowCacheOnBackend, closeWorkflowCachesBatchOnBackend } from './backend';
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
 * Pre-computed lookups for building many cache keys for one workflow.
 *
 * Normalizing the workflow and indexing its wires is the expensive part of
 * key computation, so bulk operations (like caching a whole "Preview All"
 * response) build this once instead of once per key.
 */
interface CacheKeyContext {
  workflowId: string;
  tools: Map<string, NormalizedTool>;
  wires: NormalizedWorkflow['wires'];
  incoming: Map<string, string[]>;
}

function createCacheKeyContext(workflow: WorkflowJSON): CacheKeyContext {
  const normalized = normalizeWorkflow(workflow);
  const incoming = new Map<string, string[]>();
  for (const wire of normalized.wires) {
    const list = incoming.get(wire.to.tool);
    if (list) list.push(wire.from.tool);
    else incoming.set(wire.to.tool, [wire.from.tool]);
  }
  return {
    workflowId: workflow.meta.workflowId,
    tools: new Map(normalized.tools.map((t) => [t.id, t])),
    wires: normalized.wires,
    incoming,
  };
}

function upstreamIdsFromContext(ctx: CacheKeyContext, toolId: string): Set<string> {
  const visited = new Set<string>();
  const stack = [toolId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const upstreamId of ctx.incoming.get(current) ?? []) {
      if (!visited.has(upstreamId)) {
        visited.add(upstreamId);
        stack.push(upstreamId);
      }
    }
  }
  return visited;
}

function buildCacheKey(
  ctx: CacheKeyContext,
  toolId: string,
  cacheType: 'schema' | 'preview' | 'metadata',
  previewLimit?: number,
  socketId?: string
): string {
  const targetTool = ctx.tools.get(toolId);
  if (!targetTool) {
    return `${cacheType}:${toolId}:invalid`;
  }

  const upstreamIds = upstreamIdsFromContext(ctx, toolId);

  // Upstream tools sorted by ID for a deterministic key
  const upstreamTools = [...upstreamIds]
    .map((id) => ctx.tools.get(id))
    .filter((t): t is NormalizedTool => t !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id));

  // Relevant wires (connecting to target or its upstream)
  const relevantToolIds = new Set([toolId, ...upstreamIds]);
  const relevantWires = ctx.wires
    .filter((w) => relevantToolIds.has(w.to.tool))
    .sort((a, b) => {
      const keyA = `${a.from.tool}:${a.from.socket}->${a.to.tool}:${a.to.socket}`;
      const keyB = `${b.from.tool}:${b.from.socket}->${b.to.tool}:${b.to.socket}`;
      return keyA.localeCompare(keyB);
    });

  const keyData = {
    workflowId: ctx.workflowId, // Namespace by workflow
    type: cacheType,
    target: {
      id: targetTool.id,
      type: targetTool.type,
      config: targetTool.config,
    },
    upstream: upstreamTools.map((t) => ({
      id: t.id,
      type: t.type,
      config: t.config,
    })),
    wires: relevantWires,
    ...(previewLimit !== undefined && { limit: previewLimit }),
    ...(socketId !== undefined && { socketId }),
  };

  // JSON stringification doubles as a cheap, collision-free hash
  return JSON.stringify(keyData);
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
  return buildCacheKey(createCacheKeyContext(workflow), toolId, cacheType, previewLimit, socketId);
}

/**
 * Get cached schema response
 */
export function getCachedSchema(
  toolId: string,
  workflow: WorkflowJSON,
  socketId: string,
  context?: RequestContext
): SchemaResponse | null {
  const key = computeCacheKey(toolId, workflow, 'schema', undefined, socketId);
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
  socketId: string,
  data: SchemaResponse
): void {
  const key = computeCacheKey(toolId, workflow, 'schema', undefined, socketId);
  cache.set(key, { type: 'schema', data });
}

/**
 * Get cached preview response
 */
export function getCachedPreview(
  toolId: string,
  workflow: WorkflowJSON,
  limit: number,
  socketId: string,
  context?: RequestContext
): ExecuteResponse | null {
  const key = computeCacheKey(toolId, workflow, 'preview', limit, socketId);
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
  socketId: string,
  data: ExecuteResponse
): void {
  const key = computeCacheKey(toolId, workflow, 'preview', limit, socketId);
  cache.set(key, { type: 'preview', data, limit });
}

/** Shape of one tool's previews as stored by cacheAllPreviews. */
export type AllPreviews = Record<
  string,
  { outputs: Record<string, { data: unknown[]; data_schema: unknown }> }
>;

/**
 * Reduce a "Preview All" response to the entries worth caching (sockets that
 * actually carry data).
 */
export function selectCacheablePreviews(
  tools: Record<string, { outputs: Record<string, { data?: unknown[] | undefined; data_schema?: unknown }> }>
): AllPreviews {
  const result: AllPreviews = {};
  for (const [toolId, toolData] of Object.entries(tools)) {
    const outputs: AllPreviews[string]['outputs'] = {};
    for (const [socketId, socketData] of Object.entries(toolData.outputs)) {
      if (socketData.data !== undefined) {
        outputs[socketId] = { data: socketData.data, data_schema: socketData.data_schema };
      }
    }
    if (Object.keys(outputs).length > 0) {
      result[toolId] = { outputs };
    }
  }
  return result;
}

/** Longest stretch of synchronous work before handing control back to the UI. */
const CACHE_SLICE_BUDGET_MS = 12;

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Cache all previews from a "Preview All" response
 * This populates the same cache used by individual preview requests.
 *
 * preview_all returns multi-socket format, so we cache each socket separately.
 *
 * Building a key serializes the tool and its whole upstream, which adds up on
 * large workflows. The work is therefore sliced: the workflow is normalized
 * once, and control returns to the event loop whenever a slice exceeds a small
 * time budget so typing, scrolling and canvas interaction stay responsive.
 */
export async function cacheAllPreviews(
  workflow: WorkflowJSON,
  limit: number,
  allPreviews: AllPreviews
): Promise<void> {
  const ctx = createCacheKeyContext(workflow);
  let cachedCount = 0;
  let sliceStart = performance.now();

  for (const [toolId, toolData] of Object.entries(allPreviews)) {
    // Cache each socket's data separately
    for (const [socketId, socketData] of Object.entries(toolData.outputs)) {
      // Convert to single-socket ExecuteResponse format
      const executeResponse = {
        tool_id: toolId,
        socket_id: socketId,
        data: socketData.data as Record<string, unknown>[],
        data_schema: socketData.data_schema as DataSchema,
      } satisfies ExecuteResponse;
      const key = buildCacheKey(ctx, toolId, 'preview', limit, socketId);
      cache.set(key, { type: 'preview', data: executeResponse, limit });
      cachedCount++;

      if (performance.now() - sliceStart > CACHE_SLICE_BUDGET_MS) {
        await yieldToMain();
        sliceStart = performance.now();
      }
    }
  }
  logger.debug(`Cached ${cachedCount} socket previews across ${Object.keys(allPreviews).length} tools`);
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
 * 
 * This clears both:
 * 1. Frontend in-memory cache (immediate)
 * 2. Backend disk cache (async, fire-and-forget)
 */
export function clearWorkflowCache(workflowId: string): void {
  const keysToDelete: string[] = [];
  
  logger.debug('Clearing cache for workflowId:', workflowId);
  
  // Clear frontend in-memory cache
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
  
  // Also notify backend to clear disk cache (fire-and-forget)
  closeWorkflowCacheOnBackend(workflowId);
}

/**
 * Clear entire cache (all workflows)
 * Call this on app shutdown or for debugging
 */
export function clearAllCaches(): void {
  cache.clear();
}

/**
 * Close all workflow caches on app shutdown
 * 
 * This should be called when the application is closing to notify the backend
 * that all open workflows are being closed. Uses a single batch request for
 * efficiency instead of making N individual requests.
 * 
 * The backend will clear each workflow's disk cache if cache_clear_on_close
 * is enabled (default).
 * 
 * @param workflowIds - Array of workflow IDs currently open
 */
export function closeAllWorkflowCaches(workflowIds: string[]): void {
  logger.debug('Closing all workflow caches on app shutdown:', workflowIds.length, 'workflows');
  
  // Clear frontend in-memory cache
  cache.clear();
  
  // Notify backend with a single batch request (fire-and-forget)
  closeWorkflowCachesBatchOnBackend(workflowIds);
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): { size: number } {
  return {
    size: cache.size,
  };
}
