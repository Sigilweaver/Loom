/**
 * useToolConfiguration - Unified hook for tool configuration components.
 *
 * Extracts common patterns:
 * - Wire connection tracking
 * - Upstream metadata fetching
 * - Emission map management
 * - Config field updates
 *
 * Usage:
 * ```tsx
 * const { columns, loading, updateField, hasInput } = useToolConfiguration({
 *   toolId,
 *   socketId: CommonSockets.INPUT,
 *   tools,
 *   wires,
 *   workflowMeta,
 *   config,
 *   onChange,
 * });
 * ```
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMetadata } from "../api/hooks";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { mergeEmitPatch } from "@components/primitives/hooks";
import type {
  Tool,
  Wire,
  WorkflowMeta,
  ToolConfig,
  EmissionMap,
} from "@domain/workflow/entities/workflow";
import type { ColumnSchema } from "../api/backend";

export interface UseToolConfigurationOptions {
  /** ID of the tool being configured */
  toolId: string;
  /** Socket ID to fetch metadata for */
  socketId: string;
  /** All tools in the workflow */
  tools: Tool[];
  /** All wires in the workflow */
  wires: Wire[];
  /** Workflow metadata */
  workflowMeta: WorkflowMeta;
  /** Current tool configuration */
  config: ToolConfig;
  /** Callback to update configuration */
  onChange: (config: ToolConfig) => void;
}

export interface UseToolConfigurationResult {
  /** Columns available from upstream tool output */
  columns: ColumnSchema[];
  /** Whether metadata is being fetched */
  loading: boolean;
  /** Error message if metadata fetch failed */
  error: string | null;
  /** Whether the specified socket has an incoming connection */
  hasInput: boolean;
  /** Connection info string (for dependency tracking) */
  connectionKey: string;
  /**
   * Update a config field with automatic emission tracking
   * @param key - Configuration key to update
   * @param value - New value
   * @param options - Optional settings for emission behavior
   */
  updateField: <K extends keyof ToolConfig>(
    key: K,
    value: ToolConfig[K],
    options?: { emit?: boolean; emitKey?: string }
  ) => void;
  /**
   * Update multiple config fields at once
   * @param updates - Object with fields to update
   * @param emitKeys - Optional array of keys to mark for emission
   */
  updateFields: (updates: Partial<ToolConfig>, emitKeys?: string[]) => void;
  /** Refresh metadata (force re-fetch) */
  refreshMetadata: () => void;
}

/**
 * Hook for common tool configuration patterns.
 *
 * Handles wire connection tracking, metadata fetching, and emission map updates
 * in a unified way across all configuration components.
 */
export function useToolConfiguration({
  toolId,
  socketId,
  tools,
  wires,
  workflowMeta,
  config,
  onChange,
}: UseToolConfigurationOptions): UseToolConfigurationResult {
  const { columns, loading, error, fetchMetadata } = useMetadata();

  // Track wire connections to this specific socket
  const connectionKey = useMemo(() => {
    return wires
      .filter((w) => w.to.tool === toolId && w.to.socket === socketId)
      .map((w) => `${w.from.tool}-${w.from.socket}`)
      .sort()
      .join(",");
  }, [wires, toolId, socketId]);

  const hasInput = connectionKey !== "";

  // Use refs for values needed in the effect but that shouldn't trigger re-execution
  // This ensures we only refetch when connectionKey actually changes
  const toolsRef = useRef(tools);
  const wiresRef = useRef(wires);
  const workflowMetaRef = useRef(workflowMeta);
  const fetchMetadataRef = useRef(fetchMetadata);

  // Keep refs up to date
  useEffect(() => {
    toolsRef.current = tools;
    wiresRef.current = wires;
    workflowMetaRef.current = workflowMeta;
    fetchMetadataRef.current = fetchMetadata;
  });

  // Fetch metadata when connections change
  useEffect(() => {
    if (!hasInput) return;

    const { tools: upstreamTools, wires: upstreamWires } =
      WorkflowSerializer.extractUpstreamSubgraph(
        toolsRef.current,
        wiresRef.current,
        toolId
      );
    const workflow = WorkflowSerializer.toJSON(
      upstreamTools,
      upstreamWires,
      workflowMetaRef.current
    );
    fetchMetadataRef.current(toolId, JSON.parse(workflow), socketId);
  }, [toolId, socketId, hasInput, connectionKey]);

  // Create a stable callback for manual refresh
  const refreshMetadata = useCallback(() => {
    if (!hasInput) return;

    const { tools: upstreamTools, wires: upstreamWires } =
      WorkflowSerializer.extractUpstreamSubgraph(tools, wires, toolId);
    const workflow = WorkflowSerializer.toJSON(
      upstreamTools,
      upstreamWires,
      workflowMeta
    );
    fetchMetadata(toolId, JSON.parse(workflow), socketId);
  }, [toolId, socketId, hasInput, tools, wires, workflowMeta, fetchMetadata]);

  // Update single field with emission tracking
  const updateField = useCallback(
    <K extends keyof ToolConfig>(
      key: K,
      value: ToolConfig[K],
      options: { emit?: boolean; emitKey?: string } = {}
    ) => {
      const { emit = true, emitKey = String(key) } = options;

      const emitPatch: EmissionMap = emit ? { [emitKey]: true } : {};
      const newEmit = mergeEmitPatch(
        config._emit as EmissionMap | undefined,
        emitPatch
      );

      onChange({
        ...config,
        [key]: value,
        _emit: newEmit,
      });
    },
    [config, onChange]
  );

  // Update multiple fields
  const updateFields = useCallback(
    (updates: Partial<ToolConfig>, emitKeys?: string[]) => {
      const emitPatch: EmissionMap = {};

      if (emitKeys) {
        for (const key of emitKeys) {
          emitPatch[key] = true;
        }
      } else {
        // Default: emit all updated keys
        for (const key of Object.keys(updates)) {
          if (key !== "_emit") {
            emitPatch[key] = true;
          }
        }
      }

      const newEmit = mergeEmitPatch(
        config._emit as EmissionMap | undefined,
        emitPatch
      );

      onChange({
        ...config,
        ...updates,
        _emit: newEmit,
      });
    },
    [config, onChange]
  );

  return {
    columns: columns ?? [],
    loading,
    error,
    hasInput,
    connectionKey,
    updateField,
    updateFields,
    refreshMetadata,
  };
}

/**
 * Hook variant for tools with multiple input sockets (e.g., Join).
 *
 * Returns separate metadata for each socket.
 *
 * Usage:
 * ```tsx
 * const { left, right } = useMultiSocketConfiguration({
 *   toolId,
 *   sockets: [
 *     { id: JoinSockets.INPUT_LEFT, name: 'left' },
 *     { id: JoinSockets.INPUT_RIGHT, name: 'right' },
 *   ],
 *   tools,
 *   wires,
 *   workflowMeta,
 * });
 * ```
 */
export interface SocketConfig {
  /** Socket ID */
  id: string;
  /** Key name for the result object */
  name: string;
}

export interface SocketMetadata {
  /** Columns available from this socket's upstream connection */
  columns: ColumnSchema[];
  /** Whether metadata is being fetched */
  loading: boolean;
  /** Error message if metadata fetch failed */
  error: string | null;
  /** Whether the socket has an incoming connection */
  hasInput: boolean;
  /** Connection info string */
  connectionKey: string;
  /** Refresh metadata for this socket */
  refreshMetadata: () => void;
}

export interface UseMultiSocketConfigurationOptions {
  /** ID of the tool being configured */
  toolId: string;
  /** Array of socket configurations */
  sockets: SocketConfig[];
  /** All tools in the workflow */
  tools: Tool[];
  /** All wires in the workflow */
  wires: Wire[];
  /** Workflow metadata */
  workflowMeta: WorkflowMeta;
}

export type UseMultiSocketConfigurationResult = Record<string, SocketMetadata>;

/**
 * Hook for tools with multiple input sockets.
 *
 * Each socket gets its own metadata tracking and fetch function.
 */
export function useMultiSocketConfiguration({
  toolId,
  sockets,
  tools,
  wires,
  workflowMeta,
}: UseMultiSocketConfigurationOptions): UseMultiSocketConfigurationResult {
  // Create metadata hooks for each socket
  // Note: This hook creates a fixed number of useMetadata calls based on sockets array length
  // The sockets array should be stable across renders

  // For the first socket
  const meta0 = useMetadata();
  // For the second socket (if exists)
  const meta1 = useMetadata();

  // Build connection keys for each socket
  const connectionKeys = useMemo(() => {
    return sockets.map((socket) =>
      wires
        .filter((w) => w.to.tool === toolId && w.to.socket === socket.id)
        .map((w) => `${w.from.tool}-${w.from.socket}`)
        .sort()
        .join(",")
    );
  }, [wires, toolId, sockets]);

  // Use refs for values needed in effects but that shouldn't trigger re-execution
  const toolsRef = useRef(tools);
  const wiresRef = useRef(wires);
  const workflowMetaRef = useRef(workflowMeta);
  const socketsRef = useRef(sockets);
  const meta0Ref = useRef(meta0);
  const meta1Ref = useRef(meta1);

  // Keep refs up to date
  useEffect(() => {
    toolsRef.current = tools;
    wiresRef.current = wires;
    workflowMetaRef.current = workflowMeta;
    socketsRef.current = sockets;
    meta0Ref.current = meta0;
    meta1Ref.current = meta1;
  });

  // Fetch metadata when connections change - socket 0
  const connectionKey0 = connectionKeys[0];
  useEffect(() => {
    const connectionKey = connectionKey0;
    if (!connectionKey) return;

    const socket = socketsRef.current[0];
    if (!socket) return;

    const { tools: upstreamTools, wires: upstreamWires } =
      WorkflowSerializer.extractUpstreamSubgraph(
        toolsRef.current,
        wiresRef.current,
        toolId
      );
    const workflow = WorkflowSerializer.toJSON(
      upstreamTools,
      upstreamWires,
      workflowMetaRef.current
    );
    meta0Ref.current.fetchMetadata(toolId, JSON.parse(workflow), socket.id);
  }, [connectionKey0, toolId]);

  // Fetch metadata when connections change - socket 1
  const connectionKey1 = connectionKeys[1];
  useEffect(() => {
    const connectionKey = connectionKey1;
    if (!connectionKey) return;

    const socket = socketsRef.current[1];
    if (!socket) return;

    const { tools: upstreamTools, wires: upstreamWires } =
      WorkflowSerializer.extractUpstreamSubgraph(
        toolsRef.current,
        wiresRef.current,
        toolId
      );
    const workflow = WorkflowSerializer.toJSON(
      upstreamTools,
      upstreamWires,
      workflowMetaRef.current
    );
    meta1Ref.current.fetchMetadata(toolId, JSON.parse(workflow), socket.id);
  }, [connectionKey1, toolId]);

  // Create stable refresh callbacks
  const refreshSocket0 = useCallback(() => {
    const socket = sockets[0];
    if (!socket || !connectionKeys[0]) return;

    const { tools: upstreamTools, wires: upstreamWires } =
      WorkflowSerializer.extractUpstreamSubgraph(tools, wires, toolId);
    const workflow = WorkflowSerializer.toJSON(
      upstreamTools,
      upstreamWires,
      workflowMeta
    );
    meta0.fetchMetadata(toolId, JSON.parse(workflow), socket.id);
  }, [sockets, connectionKeys, tools, wires, toolId, workflowMeta, meta0]);

  const refreshSocket1 = useCallback(() => {
    const socket = sockets[1];
    if (!socket || !connectionKeys[1]) return;

    const { tools: upstreamTools, wires: upstreamWires } =
      WorkflowSerializer.extractUpstreamSubgraph(tools, wires, toolId);
    const workflow = WorkflowSerializer.toJSON(
      upstreamTools,
      upstreamWires,
      workflowMeta
    );
    meta1.fetchMetadata(toolId, JSON.parse(workflow), socket.id);
  }, [sockets, connectionKeys, tools, wires, toolId, workflowMeta, meta1]);

  // Build result object
  const result: UseMultiSocketConfigurationResult = {};

  sockets.forEach((socket, index) => {
    const meta = index === 0 ? meta0 : meta1;
    const connectionKey = connectionKeys[index] ?? "";
    const refreshFn = index === 0 ? refreshSocket0 : refreshSocket1;

    result[socket.name] = {
      columns: meta.columns ?? [],
      loading: meta.loading,
      error: meta.error,
      hasInput: connectionKey !== "",
      connectionKey,
      refreshMetadata: refreshFn,
    };
  });

  return result;
}
