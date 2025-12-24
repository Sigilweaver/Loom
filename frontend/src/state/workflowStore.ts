import {
  Tool,
  ToolConfig,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { wouldCreateCycle } from "@domain/workflow/services/loopDetection";
import { getThemeColor } from "@utils/themeColors";
import { Edge } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createLogger } from "@utils/logger";
import { useSettingsStore } from "./settingsStore";
import { invalidateTool, invalidateWireChange } from "../api/cache";

interface WorkflowState {
  // State
  tools: Tool[];
  wires: Wire[];
  edges: Edge[];
  workflowMeta: WorkflowMeta;
  selectedTool: Tool | null;

  // Internal helper for dirty state tracking
  _markDirty: () => void;

  // Legacy actions (kept for backward compatibility during migration)
  setEdges: (edges: Edge[]) => void;
  setSelectedTool: (tool: Tool | null) => void;
  updateToolPositionLocal: (toolId: string, x: number, y: number) => void;

  // NEW: Tool CRUD operations
  addTool: (tool: Tool) => void;
  removeTool: (toolId: string) => void;
  updateTool: (toolId: string, updates: Partial<Omit<Tool, "id">>) => void;
  updateToolPosition: (toolId: string, x: number, y: number) => void;
  updateToolConfiguration: (toolId: string, config: ToolConfig) => void;
  batchUpdateToolPositions: (
    updates: Array<{ id: string; x: number; y: number }>
  ) => void;

  // NEW: Wire CRUD operations
  addWire: (wire: Wire) => { success: boolean; error?: string | undefined };
  removeWire: (from: Wire["from"], to: Wire["to"]) => void;
  removeWiresByTool: (toolId: string) => void;

  // NEW: Batch operations
  batchAddToolsAndWires: (tools: Tool[], wires: Wire[]) => void;

  // NEW: Metadata operations
  updateWorkflowMeta: (
    meta: Partial<Pick<WorkflowMeta, "name" | "description" | "author">>
  ) => void;

  // NEW: Lifecycle operations
  newWorkflow: (meta?: Partial<WorkflowMeta>) => void;
  loadWorkflow: (tools: Tool[], wires: Wire[], meta: WorkflowMeta) => void;
  clear: () => void;

  // NEW: Validation
  validateWire: (wire: Wire) => { valid: boolean; error?: string };

  // NEW: Edge synchronization
  syncEdges: () => void;
}

const createDefaultMeta = (): WorkflowMeta => {
  // Use persistent author from settings store if available
  const getAuthor = () => {
    try {
      return useSettingsStore.getState().author || 'User';
    } catch {
      return 'User';
    }
  };

  return {
    name: "New Workflow",
    description: "A new workflow",
    author: getAuthor(),
    workflowId: uuidv4(),
    created: new Date().toISOString(),
  };
};

// Helper to create edge from wire
const createEdgeFromWire = (wire: Wire, tools: Tool[], wires: Wire[]): Edge => {
  // Get edge style from settings
  // Map settings value to xyflow edge type: bezier -> 'default', others map 1:1
  const edgeStyle = useSettingsStore.getState().ui.edgeStyle;
  const edgeType = edgeStyle === 'bezier' ? 'default' : edgeStyle;
  
  // For smoothstep, use increased border radius for smoother corners
  const pathOptions = edgeStyle === 'smoothstep' ? { borderRadius: 20 } : undefined;

  const existingWires = wires.filter(
    (w) =>
      !(
        w.from.tool === wire.from.tool &&
        w.from.socket === wire.from.socket &&
        w.to.tool === wire.to.tool &&
        w.to.socket === wire.to.socket
      )
  );

  const wouldLoop = wouldCreateCycle(
    tools,
    existingWires,
    wire.from.tool,
    wire.to.tool
  );
  const strokeColor = wouldLoop
    ? getThemeColor("--color-edge-invalid-stroke")
    : getThemeColor("--color-edge-default-stroke");

  return {
    id: `${encodeURIComponent(wire.from.tool)}_${wire.from.socket}_${encodeURIComponent(wire.to.tool)}_${wire.to.socket}`,
    source: wire.from.tool,
    target: wire.to.tool,
    sourceHandle: `output-${wire.from.socket}`,
    targetHandle: `input-${wire.to.socket}`,
    type: edgeType,
    ...(pathOptions && { pathOptions }),
    style: {
      stroke: strokeColor,
      strokeWidth: 2,
      strokeDasharray: wouldLoop ? "5,5" : undefined,
      cursor: "pointer",
    },
    data: { isError: wouldLoop, errorType: wouldLoop ? "cycle" : undefined },
    deletable: true,
    selectable: true,
    focusable: true,
    animated: wouldLoop,
  };
};

const logger = createLogger('WorkflowStore');

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      tools: [],
      wires: [],
      edges: [],
      workflowMeta: createDefaultMeta(),
      selectedTool: null,

      // Internal helper to mark active tab as dirty
      _markDirty: () => {
        // Note: This is called internally but the actual tab dirty marking
        // is handled by components or the tab store itself when workflows change
        // This avoids circular dependencies between stores
      },

      // Legacy actions (kept for backward compatibility)
      setEdges: (edges) =>
        set((state) => {
          state.edges = edges;
        }),

      setSelectedTool: (selectedTool) =>
        set((state) => {
          state.selectedTool = selectedTool;
        }),

      updateToolPositionLocal: (toolId, x, y) =>
        set((state) => {
          const tool = state.tools.find((t) => t.id === toolId);
          if (tool) {
            tool.x = x;
            tool.y = y;
          }
        }),

      // NEW: Tool CRUD operations
      addTool: (tool) =>
        set((state) => {
          state.tools.push(tool);
          get().syncEdges();
          get()._markDirty();
        }),

      removeTool: (toolId) =>
        set((state) => {
          state.tools = state.tools.filter((t) => t.id !== toolId);
          state.wires = state.wires.filter(
            (w) => w.from.tool !== toolId && w.to.tool !== toolId
          );
          if (state.selectedTool?.id === toolId) {
            state.selectedTool = null;
          }
          get().syncEdges();
          get()._markDirty();
        }),

      updateTool: (toolId, updates) =>
        set((state) => {
          const tool = state.tools.find((t) => t.id === toolId);
          if (tool) {
            Object.assign(tool, updates);
          }
        }),

      updateToolPosition: (toolId, x, y) =>
        set((state) => {
          const tool = state.tools.find((t) => t.id === toolId);
          if (tool) {
            tool.x = x;
            tool.y = y;
          }
        }),

      updateToolConfiguration: (toolId, config) => {
        const workflowId = get().workflowMeta.workflowId;
        invalidateTool(toolId, workflowId); // Invalidate cache for this tool in this workflow
        set((state) => {
          const tool = state.tools.find((t) => t.id === toolId);
          if (tool) {
            tool.config = config;
            // If this is the selected tool, update the reference so selectors detect the change
            if (state.selectedTool?.id === toolId) {
              state.selectedTool = tool;
            }
          }
          get()._markDirty();
        });
      },

      batchUpdateToolPositions: (updates) =>
        set((state) => {
          const updateMap = new Map(updates.map((u) => [u.id, u]));
          state.tools.forEach((tool) => {
            const update = updateMap.get(tool.id);
            if (update) {
              tool.x = update.x;
              tool.y = update.y;
            }
          });
        }),

      // NEW: Wire CRUD operations
      addWire: (wire) => {
        const validation = get().validateWire(wire);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }

        set((state) => {
          state.wires.push(wire);
        });
        
        // Invalidate cache for affected tool and downstream in this workflow
        const workflowId = get().workflowMeta.workflowId;
        invalidateWireChange(wire.to.tool, get().wires, workflowId);
        
        get().syncEdges();
        get()._markDirty();
        return { success: true };
      },

      removeWire: (from, to) => {
        // Find the wire being removed to get the target tool
        const wireToRemove = get().wires.find(
          (w) =>
            w.from.tool === from.tool &&
            w.from.socket === from.socket &&
            w.to.tool === to.tool &&
            w.to.socket === to.socket
        );
        
        set((state) => {
          state.wires = state.wires.filter(
            (w) =>
              !(
                w.from.tool === from.tool &&
                w.from.socket === from.socket &&
                w.to.tool === to.tool &&
                w.to.socket === to.socket
              )
          );
        });
        
        // Invalidate cache for affected tool and downstream in this workflow
        if (wireToRemove) {
          const workflowId = get().workflowMeta.workflowId;
          invalidateWireChange(wireToRemove.to.tool, get().wires, workflowId);
        }
        
        get().syncEdges();
        get()._markDirty();
      },

      removeWiresByTool: (toolId) => {
        set((state) => {
          state.wires = state.wires.filter(
            (w) => w.from.tool !== toolId && w.to.tool !== toolId
          );
        });
        get().syncEdges();
      },

      // NEW: Batch operations
      batchAddToolsAndWires: (tools, wires) => {
        set((state) => {
          state.tools.push(...tools);
          state.wires.push(...wires);
        });
        get().syncEdges();
        get()._markDirty();
      },

      // NEW: Metadata operations
      updateWorkflowMeta: (meta) =>
        set((state) => {
          logger.debug("Updating workflow metadata:", meta.name || '(name unchanged)');
          Object.assign(state.workflowMeta, meta);
          get()._markDirty();
        }),

      // NEW: Lifecycle operations
      newWorkflow: (meta) => {
        set((state) => {
          state.tools = [];
          state.wires = [];
          state.workflowMeta = { ...createDefaultMeta(), ...meta };
          state.selectedTool = null;
          state.edges = [];
        });
      },

      loadWorkflow: (tools, wires, meta) => {
        logger.info("Loading workflow:", meta.name, `(${tools.length} tools, ${wires.length} wires)`);
        set((state) => {
          state.tools = tools;
          state.wires = wires;
          state.workflowMeta = meta;
          state.selectedTool = null;
        });
        get().syncEdges();
      },

      clear: () =>
        set((state) => {
          state.tools = [];
          state.wires = [];
          state.selectedTool = null;
          state.edges = [];
        }),

      // NEW: Validation
      validateWire: (wire) => {
        const { tools, wires } = get();

        // Check if tools exist
        const fromTool = tools.find((t) => t.id === wire.from.tool);
        const toTool = tools.find((t) => t.id === wire.to.tool);
        if (!fromTool || !toTool) {
          return { valid: false, error: "Tool not found" };
        }

        // Check if sockets exist and have correct direction
        const fromSocket = fromTool.sockets.find(
          (s) => s.id === wire.from.socket
        );
        const toSocket = toTool.sockets.find((s) => s.id === wire.to.socket);
        if (!fromSocket || !toSocket) {
          return { valid: false, error: "Socket not found" };
        }
        if (fromSocket.direction !== "output") {
          return { valid: false, error: "Source must be an output socket" };
        }
        if (toSocket.direction !== "input") {
          return { valid: false, error: "Target must be an input socket" };
        }

        // Check if exact duplicate wire already exists
        const duplicateWire = wires.find(
          (w) =>
            w.from.tool === wire.from.tool &&
            w.from.socket === wire.from.socket &&
            w.to.tool === wire.to.tool &&
            w.to.socket === wire.to.socket
        );
        if (duplicateWire) {
          return { valid: false, error: "Connection already exists" };
        }

        // Check if target input already connected (if not multiple)
        if (!toSocket.multiple) {
          const existingConnection = wires.find(
            (w) => w.to.tool === wire.to.tool && w.to.socket === wire.to.socket
          );
          if (existingConnection) {
            return { valid: false, error: "Input already connected" };
          }
        }

        return { valid: true };
      },

      // NEW: Edge synchronization
      syncEdges: () =>
        set((state) => {
          const { tools, wires } = get();
          state.edges = wires.map((wire) =>
            createEdgeFromWire(wire, tools, wires)
          );
        }),
    }))
  )
);

// Selector hooks for optimized subscriptions
export const useTools = () => useWorkflowStore((state) => state.tools);
export const useWires = () => useWorkflowStore((state) => state.wires);
export const useEdges = () => useWorkflowStore((state) => state.edges);
export const useWorkflowMeta = () =>
  useWorkflowStore((state) => state.workflowMeta);
export const useSelectedTool = () =>
  useWorkflowStore((state) => state.selectedTool);
