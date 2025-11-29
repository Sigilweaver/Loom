/**
 * previewCacheStore - Stores cached preview data from "Preview All" requests
 *
 * When user clicks "Preview All", we execute the entire workflow once and cache
 * the preview data for all tools. This is more efficient than fetching each
 * tool individually, especially for workflows with SQL queries or other
 * expensive data sources.
 */

import { create } from "zustand";
import type { ToolOutput } from "../api/backend";

interface PreviewCacheState {
  /**
   * Cached preview data from the last "Preview All" request
   * Maps tool_id -> socket_id -> ToolOutput
   */
  cachedPreviews: Record<string, Record<string, ToolOutput>>;

  /**
   * Whether a preview all request is currently in progress
   */
  isLoading: boolean;

  /**
   * Error message from the last preview all request (if any)
   */
  error: string | null;

  /**
   * Timestamp of when the cache was last populated
   */
  lastUpdated: number | null;

  // Actions
  setCachedPreviews: (previews: Record<string, Record<string, ToolOutput>>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getCachedPreview: (toolId: string, socketId: string) => ToolOutput | null;
  clearCache: () => void;
}

export const usePreviewCacheStore = create<PreviewCacheState>((set, get) => ({
  cachedPreviews: {},
  isLoading: false,
  error: null,
  lastUpdated: null,

  setCachedPreviews: (previews) =>
    set({
      cachedPreviews: previews,
      lastUpdated: Date.now(),
      error: null,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  getCachedPreview: (toolId, socketId) => {
    const state = get();
    return state.cachedPreviews[toolId]?.[socketId] ?? null;
  },

  clearCache: () =>
    set({
      cachedPreviews: {},
      lastUpdated: null,
      error: null,
    }),
}));
