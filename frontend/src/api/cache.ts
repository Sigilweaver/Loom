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
 * Maximum cache entries before LRU eviction
 */
const MAX_CACHE_SIZE = 100;

/**
 * Global cache storage
 */
const cache = new Map<string, CacheEntry>();
const accessOrder: string[] = [];

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
  previewLimit?: number
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
  };
  
  // Use JSON stringification for simple hashing
  // This is fast enough for our use case
  return JSON.stringify(keyData);
}

/**
 * Update access order for LRU eviction
 */
function touchKey(key: string): void {
  const index = accessOrder.indexOf(key);
  if (index > -1) {
    accessOrder.splice(index, 1);
  }
  accessOrder.push(key);
}

/**
 * Evict oldest entries if cache exceeds max size
 */
function evictIfNeeded(): void {
  while (cache.size > MAX_CACHE_SIZE && accessOrder.length > 0) {
    const oldestKey = accessOrder.shift();
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
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
    touchKey(key);
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
  touchKey(key);
  evictIfNeeded();
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
    touchKey(key);
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
  touchKey(key);
  evictIfNeeded();
}

/**
 * Get cached metadata response
 */
export function getCachedMetadata(
  toolId: string,
  workflow: WorkflowJSON,
  context?: RequestContext
): MetadataResponse | null {
  const key = computeCacheKey(toolId, workflow, 'metadata');
  const entry = cache.get(key);
  const endpoint = '/workflow/tool/metadata';
  const { logCacheHit, logCacheMiss } = getRuntimeLogActions();
  
  if (entry?.type === 'metadata') {
    touchKey(key);
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
  data: MetadataResponse
): void {
  const key = computeCacheKey(toolId, workflow, 'metadata');
  cache.set(key, { type: 'metadata', data });
  touchKey(key);
  evictIfNeeded();
}

/**
 * Invalidate all cache entries for a specific tool
 * Call this when a tool's config changes
 */
export function invalidateTool(toolId: string): void {
  const keysToDelete: string[] = [];
  
  for (const key of cache.keys()) {
    // Check if this key involves the tool (as target or upstream)
    if (key.includes(`"id":"${toolId}"`)) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    cache.delete(key);
    const index = accessOrder.indexOf(key);
    if (index > -1) {
      accessOrder.splice(index, 1);
    }
  }
}

/**
 * Invalidate cache entries affected by a wire change
 * Call this when wires are added or removed
 */
export function invalidateWireChange(
  affectedToolId: string,
  workflow: WorkflowJSON
): void {
  // Get all downstream tools that might be affected
  const affectedTools = new Set<string>([affectedToolId]);
  
  // Find all tools downstream of the affected tool
  let changed = true;
  while (changed) {
    changed = false;
    for (const wire of workflow.wires) {
      if (affectedTools.has(wire.from.tool) && !affectedTools.has(wire.to.tool)) {
        affectedTools.add(wire.to.tool);
        changed = true;
      }
    }
  }
  
  // Invalidate all affected tools
  for (const toolId of affectedTools) {
    invalidateTool(toolId);
  }
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  cache.clear();
  accessOrder.length = 0;
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
