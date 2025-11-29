/**
 * clipboardStore - Clipboard state management for canvas operations
 *
 * Manages copy/paste operations for tools and wires on the canvas.
 * Replaces legacy getter/setter functions with a full Zustand store.
 *
 * Key Features:
 * - Copy tools and their internal wires
 * - Paste with position offset
 * - Generate new IDs for pasted tools
 * - Remap wires to new tool IDs
 * - Integration with workflowStore
 */

import { Tool, Wire } from "@domain/workflow/entities/workflow";
import { generateUniqueId } from "@utils/id";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useWorkflowStore } from "./workflowStore";

/**
 * Clipboard data structure
 */
export interface ClipboardData {
  tools: { id: string; type: string; x: number; y: number }[];
  wires: {
    from: { tool: string; socket: string };
    to: { tool: string; socket: string };
  }[];
  minX: number;
  minY: number;
}

/**
 * Clipboard store state
 */
interface ClipboardState {
  // Current clipboard data
  clipboard: ClipboardData | null;

  // Actions
  setClipboard: (data: ClipboardData | null) => void;
  clearClipboard: () => void;

  // High-level operations
  copyTools: (toolIds: string[]) => void;
  pasteToolsAt: (anchor: { x: number; y: number }) => string[];
}

/**
 * Clipboard store
 *
 * @example
 * // Copy selected tools
 * const copyTools = useClipboardStore(s => s.copyTools);
 * copyTools(['tool_001', 'tool_002']);
 *
 * // Paste at position
 * const pasteToolsAt = useClipboardStore(s => s.pasteToolsAt);
 * const newToolIds = pasteToolsAt({ x: 300, y: 400 });
 */
export const useClipboardStore = create<ClipboardState>()(
  devtools(
    (set, get) => ({
      clipboard: null,

      /**
       * Set clipboard data
       */
      setClipboard: (data) =>
        set({
          clipboard: data,
        }),

      /**
       * Clear clipboard
       */
      clearClipboard: () =>
        set({
          clipboard: null,
        }),

      /**
       * Copy tools to clipboard
       *
       * Extracts selected tools and their internal wires (wires that connect
       * tools within the selection). Calculates bounding box for positioning.
       *
       * @param toolIds - IDs of tools to copy
       */
      copyTools: (toolIds) => {
        const workflowState = useWorkflowStore.getState();
        const { tools, wires } = workflowState;

        // Filter selected tools
        const selectedTools = tools.filter((t) => toolIds.includes(t.id));
        if (selectedTools.length === 0) {
          set({ clipboard: null });
          return;
        }

        // Find internal wires (both tools in selection)
        const internalWires = wires.filter(
          (w) => toolIds.includes(w.from.tool) && toolIds.includes(w.to.tool)
        );

        // Calculate bounding box
        const xs = selectedTools.map((t) => t.x);
        const ys = selectedTools.map((t) => t.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);

        // Create clipboard data (simplified tool format)
        const clipboardData: ClipboardData = {
          tools: selectedTools.map((t) => ({
            id: t.id,
            type: t.type,
            x: t.x,
            y: t.y,
          })),
          wires: internalWires.map((w) => ({
            from: { tool: w.from.tool, socket: w.from.socket },
            to: { tool: w.to.tool, socket: w.to.socket },
          })),
          minX,
          minY,
        };

        set({ clipboard: clipboardData });
      },

      /**
       * Paste tools at a specific position
       *
       * Creates new tools with new IDs, offset from the original positions.
       * Remaps wires to use the new tool IDs.
       *
       * @param anchor - Position to paste at (will be top-left of pasted content)
       * @returns Array of new tool IDs
       */
      pasteToolsAt: (anchor) => {
        const clipboard = get().clipboard;
        if (!clipboard) {
          return [];
        }

        const workflowState = useWorkflowStore.getState();
        const { tools } = workflowState;

        // Build set of existing tool IDs
        const existingIds = new Set(tools.map((t) => t.id));

        // Generate new IDs and create ID mapping
        const oldToNewId = new Map<string, string>();
        clipboard.tools.forEach((t) => {
          const newId = generateUniqueId(existingIds);
          oldToNewId.set(t.id, newId);
          existingIds.add(newId); // Prevent duplicate IDs within pasted tools
        });

        // Calculate offset from clipboard origin to anchor
        const offsetX = anchor.x - clipboard.minX;
        const offsetY = anchor.y - clipboard.minY;

        // Create new tools with new IDs and positions
        const newTools: Tool[] = clipboard.tools.map((clipTool) => {
          const newId = oldToNewId.get(clipTool.id)!;

          // Find original tool to get full config and sockets
          const originalTool = tools.find((t) => t.id === clipTool.id);
          if (!originalTool) {
            // Fallback if original tool not found (shouldn't happen in normal flow)
            return {
              id: newId,
              type: clipTool.type,
              x: clipTool.x + offsetX,
              y: clipTool.y + offsetY,
              config: {},
              sockets: [],
            } as Tool;
          }

          return {
            ...originalTool,
            id: newId,
            x: clipTool.x + offsetX,
            y: clipTool.y + offsetY,
          };
        });

        // Create new wires with remapped tool IDs
        const newWires: Wire[] = clipboard.wires
          .map((clipWire) => {
            const fromId = oldToNewId.get(clipWire.from.tool);
            const toId = oldToNewId.get(clipWire.to.tool);

            if (!fromId || !toId) {
              return null; // Skip wire if tool mapping failed
            }

            return {
              from: { tool: fromId, socket: clipWire.from.socket },
              to: { tool: toId, socket: clipWire.to.socket },
            };
          })
          .filter((w): w is Wire => w !== null);

        // Add new tools and wires to workflow
        // Note: This should be called with a history snapshot from the caller
        const { batchAddToolsAndWires } = useWorkflowStore.getState();
        batchAddToolsAndWires(newTools, newWires);

        return Array.from(oldToNewId.values());
      },
    }),
    { name: "ClipboardStore" }
  )
);

// Selector hooks for optimized subscriptions
export const useClipboard = () => useClipboardStore((state) => state.clipboard);
export const useHasClipboard = () =>
  useClipboardStore((state) => state.clipboard !== null);
