import { getToolDefinition } from "@data/tools";
import type { Socket, Tool, ToolConfig, Wire } from "@domain/workflow/entities/workflow";
import { useHistoryStore } from "@state/historyStore";
import { useSettingsStore } from "@state/settingsStore";
import { useTabStore } from "@state/tabStore";
import { useWorkflowStore } from "@state/workflowStore";
import { generateUniqueId } from "@utils/id";
import { createLogger } from "@utils/logger";
import { useCallback } from "react";

const logger = createLogger("CanvasHandlers");

// --- Auto-connect geometry constants (must match WorkflowNode.tsx) ---
const NODE_SIZE = 60;
const NODE_CENTER = NODE_SIZE / 2; // 30
const SOCKET_SPACING = 18;
const SOCKET_SIZE = 14;
const SOCKET_OFFSET = -(SOCKET_SIZE / 2 + 3); // -10  (handle left/right CSS offset)
// Handle center sits 3px outside the node edge (offset + half width = -10 + 7 = -3)
const SOCKET_EDGE_INSET = SOCKET_OFFSET + SOCKET_SIZE / 2; // -3

/**
 * Compute the canvas-space (x, y) position of a socket handle on a tool.
 *
 * Input sockets sit on the left edge, output sockets on the right edge.
 * Vertical position depends on the socket's index within same-direction peers.
 */
export function getSocketWorldPosition(
  tool: Tool,
  socket: Socket,
  allSockets: Socket[],
): { x: number; y: number } {
  const peers = allSockets.filter((s) => s.direction === socket.direction);
  const index = peers.indexOf(socket);
  const total = peers.length;

  // Horizontal: input handle centre is 3px outside the left edge,
  //             output handle centre is 3px outside the right edge.
  const sx = socket.direction === "input"
    ? tool.x + SOCKET_EDGE_INSET        // tool.x - 3
    : tool.x + NODE_SIZE - SOCKET_EDGE_INSET; // tool.x + 63

  // Vertical: mirrors getSocketPosition() in WorkflowNode.tsx
  let sy: number;
  if (total === 1) {
    sy = tool.y + NODE_CENTER;
  } else if (total === 2) {
    sy = tool.y + (index === 0 ? NODE_CENTER - SOCKET_SPACING : NODE_CENTER + SOCKET_SPACING);
  } else if (total === 3) {
    const offsets = [-SOCKET_SPACING, 0, SOCKET_SPACING];
    sy = tool.y + NODE_CENTER + offsets[index];
  } else if (total === 4) {
    const offsets = [-21, -7, 7, 21];
    sy = tool.y + NODE_CENTER + offsets[index];
  } else if (total === 5) {
    const offsets = [-21, -7, 0, 7, 21];
    sy = tool.y + NODE_CENTER + offsets[index];
  } else {
    const margin = 8;
    const available = NODE_SIZE - margin * 2;
    const step = available / (total - 1);
    sy = tool.y + margin + index * step;
  }

  return { x: sx, y: sy };
}

/**
 * Find the best auto-connect wire for a newly dropped tool.
 *
 * For each nearby existing tool, considers every possible (output → input) pair
 * and measures the Euclidean distance between the two socket positions in canvas
 * space.  This means that for a Join tool (with left and right inputs) the user
 * gets the connection on whichever input side is actually closest to the source,
 * rather than always connecting to the first input.
 */
export function findAutoConnectWire(
  newTool: Tool,
  existingTools: Tool[],
  existingWires: Wire[],
  radius: number,
): Wire | null {
  // Build a set of occupied single-input sockets for quick lookup
  const occupiedInputs = new Set(
    existingWires.map((w) => `${w.to.tool}::${w.to.socket}`),
  );

  const newInputs = newTool.sockets.filter((s) => s.direction === "input");
  const newOutputs = newTool.sockets.filter((s) => s.direction === "output");

  type Candidate = { distance: number; wire: Wire };
  const candidates: Candidate[] = [];

  for (const other of existingTools) {
    if (other.id === newTool.id) continue;

    // Quick bounding-box rejection using tool centres
    const roughDx = Math.abs(other.x - newTool.x);
    const roughDy = Math.abs(other.y - newTool.y);
    if (roughDx > radius + NODE_SIZE || roughDy > radius + NODE_SIZE) continue;

    const otherOutputs = other.sockets.filter((s) => s.direction === "output");
    const otherInputs = other.sockets.filter((s) => s.direction === "input");

    // Case 1: wire from other's output → new tool's input (most common)
    for (const otherOut of otherOutputs) {
      const outPos = getSocketWorldPosition(other, otherOut, other.sockets);
      for (const newIn of newInputs) {
        const inKey = `${newTool.id}::${newIn.id}`;
        if (!newIn.multiple && occupiedInputs.has(inKey)) continue;

        const inPos = getSocketWorldPosition(newTool, newIn, newTool.sockets);
        const dx = outPos.x - inPos.x;
        const dy = outPos.y - inPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;

        candidates.push({
          distance: dist,
          wire: {
            from: { tool: other.id, socket: otherOut.id },
            to: { tool: newTool.id, socket: newIn.id },
          },
        });
      }
    }

    // Case 2: wire from new tool's output → other's input (e.g. an Input Data tool)
    if (newInputs.length === 0) {
      for (const newOut of newOutputs) {
        const outPos = getSocketWorldPosition(newTool, newOut, newTool.sockets);
        for (const otherIn of otherInputs) {
          const inKey = `${other.id}::${otherIn.id}`;
          if (!otherIn.multiple && occupiedInputs.has(inKey)) continue;

          const inPos = getSocketWorldPosition(other, otherIn, other.sockets);
          const dx = outPos.x - inPos.x;
          const dy = outPos.y - inPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue;

          candidates.push({
            distance: dist,
            wire: {
              from: { tool: newTool.id, socket: newOut.id },
              to: { tool: other.id, socket: otherIn.id },
            },
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pick closest socket pair
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0].wire;
}

/**
 * Hook that provides all tool and wire manipulation handlers.
 * Encapsulates state management, history tracking, and tab dirty marking.
 */
export function useCanvasHandlers() {
  // Workflow store selectors
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const addTool = useWorkflowStore((s) => s.addTool);
  const removeTool = useWorkflowStore((s) => s.removeTool);
  const updateTool = useWorkflowStore((s) => s.updateTool);
  const addWire = useWorkflowStore((s) => s.addWire);
  const removeWire = useWorkflowStore((s) => s.removeWire);
  const batchAddToolsAndWires = useWorkflowStore((s) => s.batchAddToolsAndWires);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);

  // History store
  const pushState = useHistoryStore((s) => s.pushState);

  // Tab store
  const activeTabId = useTabStore((s) => s.activeTabId);
  const markTabDirty = useTabStore((s) => s.markTabDirty);

  // Settings store
  const autoConnect = useSettingsStore((s) => s.behavior.autoConnect);
  const autoConnectRadius = useSettingsStore((s) => s.behavior.autoConnectRadius);

  const handleAddTool = useCallback(
    (
      type: string,
      x: number,
      y: number,
      idOverride?: string,
      configOverride?: ToolConfig,
      socketsOverride?: Socket[]
    ) => {
      logger.debug("Adding tool:", type, "at", x, y);

      const toolDef = getToolDefinition(type);
      const newTool: Tool = {
        id: idOverride || generateUniqueId(new Set(tools.map((t) => t.id))),
        type,
        x,
        y,
        config: configOverride ?? toolDef?.defaultConfig ?? {},
        sockets: socketsOverride ?? toolDef?.sockets ?? [],
      };

      pushState(tools, wires, workflowMeta);
      addTool(newTool);

      // Auto-connect to nearest compatible tool when enabled
      if (autoConnect) {
        const autoWire = findAutoConnectWire(newTool, tools, wires, autoConnectRadius);
        if (autoWire) {
          const result = addWire(autoWire);
          if (result.success) {
            logger.debug("Auto-connected:", autoWire.from.tool, "→", autoWire.to.tool);
          }
        }
      }

      if (activeTabId) {
        markTabDirty(activeTabId);
      }
    },
    [addTool, addWire, pushState, tools, wires, workflowMeta, activeTabId, markTabDirty, autoConnect, autoConnectRadius]
  );

  const handleRemoveTool = useCallback(
    (id: string) => {
      logger.debug("Removing tool:", id);
      pushState(tools, wires, workflowMeta);
      removeTool(id);

      if (activeTabId) {
        markTabDirty(activeTabId);
      }
    },
    [removeTool, pushState, tools, wires, workflowMeta, activeTabId, markTabDirty]
  );

  const handleToolMove = useCallback(
    (id: string, x: number, y: number) => {
      // Note: No snapshot for moves - too frequent. Snapshot saved on drag end.
      logger.debug("Moving tool:", id, "to", x, y);
      updateTool(id, { x, y });

      if (activeTabId) {
        markTabDirty(activeTabId);
      }
    },
    [updateTool, activeTabId, markTabDirty]
  );

  const handleAddWire = useCallback(
    (
      from: { tool: string; socket: string },
      to: { tool: string; socket: string }
    ) => {
      logger.debug("Adding wire:", from, "->", to);
      const wire: Wire = { from, to };

      // Find target tool and socket to check if it's a multiple socket
      const targetTool = tools.find((t) => t.id === to.tool);
      const targetSocket = targetTool?.sockets.find((s) => s.id === to.socket);

      // Check if there's an existing wire to this input socket
      const existingWire = wires.find(
        (w) => w.to.tool === to.tool && w.to.socket === to.socket
      );

      // If socket doesn't support multiple connections and there's an existing wire,
      // remove it first (separate undo step), then add the new wire (second undo step)
      if (existingWire && targetSocket && !targetSocket.multiple) {
        // Check this isn't the exact same wire (duplicate)
        const isDuplicate =
          existingWire.from.tool === from.tool &&
          existingWire.from.socket === from.socket;

        if (!isDuplicate) {
          logger.debug("Replacing existing wire:", existingWire, "with:", wire);

          // Step 1: Remove existing wire (first undo step)
          pushState(tools, wires, workflowMeta);
          removeWire(existingWire.from, existingWire.to);

          // Step 2: Add new wire (second undo step)
          // Get fresh state after removal
          const currentWires = useWorkflowStore.getState().wires;
          const currentTools = useWorkflowStore.getState().tools;
          pushState(currentTools, currentWires, workflowMeta);
          addWire(wire);

          if (activeTabId) {
            markTabDirty(activeTabId);
          }
          return;
        }
      }

      // Normal case: just add the wire
      pushState(tools, wires, workflowMeta);
      addWire(wire);

      if (activeTabId) {
        markTabDirty(activeTabId);
      }
    },
    [addWire, removeWire, pushState, tools, wires, workflowMeta, activeTabId, markTabDirty]
  );

  const handleRemoveWire = useCallback(
    (id: string) => {
      logger.debug("Removing wire:", id);
      // Parse wire ID to extract from/to info
      // Format: "encodeURIComponent(from.tool)_from.socket_encodeURIComponent(to.tool)_to.socket"
      const parts = id.split("_");
      if (parts.length >= 4 && parts[0] && parts[1] && parts[2] && parts[3]) {
        const from = {
          tool: decodeURIComponent(parts[0]),
          socket: parts[1],
        };
        const to = {
          tool: decodeURIComponent(parts[2]),
          socket: parts.slice(3).join("_"), // Socket IDs may contain underscores
        };
        pushState(tools, wires, workflowMeta);
        removeWire(from, to);

        if (activeTabId) {
          markTabDirty(activeTabId);
        }
      } else {
        logger.warn("Invalid wire ID format:", id);
      }
    },
    [removeWire, pushState, tools, wires, workflowMeta, activeTabId, markTabDirty]
  );

  const handleBatchAdd = useCallback(
    (
      toolAdds: {
        id: string;
        type: string;
        x: number;
        y: number;
        config: ToolConfig;
        sockets: Socket[];
      }[],
      wiresToAdd: {
        from: { tool: string; socket: string };
        to: { tool: string; socket: string };
      }[]
    ) => {
      logger.debug(
        "Batch adding:",
        toolAdds.length,
        "tools,",
        wiresToAdd.length,
        "wires"
      );

      const fullTools: Tool[] = toolAdds.map((t) => ({
        id: t.id,
        type: t.type,
        x: t.x,
        y: t.y,
        config: t.config,
        sockets: t.sockets,
      }));

      const fullWires: Wire[] = wiresToAdd.map((w) => ({
        from: w.from,
        to: w.to,
      }));

      pushState(tools, wires, workflowMeta);
      batchAddToolsAndWires(fullTools, fullWires);

      if (activeTabId) {
        markTabDirty(activeTabId);
      }
    },
    [batchAddToolsAndWires, pushState, tools, wires, workflowMeta, activeTabId, markTabDirty]
  );

  const handleBeginTransaction = useCallback(() => {
    logger.debug("Begin transaction (drag start)");
    // Optional: Could set a flag here if needed for transaction tracking
  }, []);

  const handleCommitTransaction = useCallback(() => {
    logger.debug("Commit transaction (drag end)");
    pushState(tools, wires, workflowMeta);
  }, [pushState, tools, wires, workflowMeta]);

  const handleToolSelect = useCallback(
    (tool: Tool | null) => {
      logger.debug("Tool selected:", tool?.id || "none");
      setSelectedTool(tool);
    },
    [setSelectedTool]
  );

  return {
    // State
    tools,
    wires,
    workflowMeta,
    // Tool handlers
    handleAddTool,
    handleRemoveTool,
    handleToolMove,
    handleToolSelect,
    // Wire handlers
    handleAddWire,
    handleRemoveWire,
    // Batch operations
    handleBatchAdd,
    // Transaction handlers
    handleBeginTransaction,
    handleCommitTransaction,
  } as const;
}
