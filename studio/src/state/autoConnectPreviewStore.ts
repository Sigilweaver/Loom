/**
 * Auto-Connect Preview Store
 *
 * Transient state for showing a preview wire while the user is dragging
 * a tool from the palette onto the canvas.  This is intentionally kept
 * separate from the persistent settings/workflow stores because the
 * preview is ephemeral UI-only state.
 */

import { create } from 'zustand';

export interface AutoConnectPreview {
  /** Source socket position in flow coordinates */
  sourceX: number;
  sourceY: number;
  /** Target socket position in flow coordinates (follows the drag cursor) */
  targetX: number;
  targetY: number;
  /** The tool ID that would be connected */
  toolId: string;
}

interface AutoConnectPreviewState {
  preview: AutoConnectPreview | null;
  setPreview: (preview: AutoConnectPreview | null) => void;
  clear: () => void;
}

export const useAutoConnectPreviewStore = create<AutoConnectPreviewState>()(
  (set) => ({
    preview: null,
    setPreview: (preview) => set({ preview }),
    clear: () => set({ preview: null }),
  }),
);
