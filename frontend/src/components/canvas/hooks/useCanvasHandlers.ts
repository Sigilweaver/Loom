import { getToolDefinition } from "@data/tools";
import type { Socket, Tool, ToolConfig, Wire } from "@domain/workflow/entities/workflow";
import { useHistoryStore } from "@state/historyStore";
import { useTabStore } from "@state/tabStore";
import { useWorkflowStore } from "@state/workflowStore";
import { generateUniqueId } from "@utils/id";
import { createLogger } from "@utils/logger";
import { useCallback } from "react";

const logger = createLogger("CanvasHandlers");

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

      const newTool: Tool = {
        id: idOverride || generateUniqueId(new Set(tools.map((t) => t.id))),
        type,
        x,
        y,
        config: configOverride ?? {},
        sockets: socketsOverride ?? getToolDefinition(type)?.sockets ?? [],
      };

      pushState(tools, wires, workflowMeta);
      addTool(newTool);

      if (activeTabId) {
        markTabDirty(activeTabId);
      }
    },
    [addTool, pushState, tools, wires, workflowMeta, activeTabId, markTabDirty]
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
    },
    [updateTool]
  );

  const handleAddWire = useCallback(
    (
      from: { tool: string; socket: string },
      to: { tool: string; socket: string }
    ) => {
      logger.debug("Adding wire:", from, "->", to);
      const wire: Wire = { from, to };
      pushState(tools, wires, workflowMeta);
      addWire(wire);

      if (activeTabId) {
        markTabDirty(activeTabId);
      }
    },
    [addWire, pushState, tools, wires, workflowMeta, activeTabId, markTabDirty]
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
