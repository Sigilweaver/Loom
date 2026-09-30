import {
  DEFAULT_ENGINE,
  Tool,
  ToolConfig,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createLogger } from "@utils/logger";
import { invalidateTool, invalidateWireChange } from "../api/cache";

/**
 * Stores workflow data and mutations. Dirty state is owned by tabStore:
 * useCanvasHandlers and LeftPane call markTabDirty for user-facing mutations.
 */
interface WorkflowState {
  // State
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
  selectedTool: Tool | null;

  // Selection and local (non-history) updates
  setSelectedTool: (tool: Tool | null) => void;
  updateToolPositionLocal: (toolId: string, x: number, y: number) => void;

  // Tool CRUD operations
  addTool: (tool: Tool) => void;
  removeTool: (toolId: string) => void;
  updateTool: (toolId: string, updates: Partial<Omit<Tool, "id">>) => void;
  updateToolPosition: (toolId: string, x: number, y: number) => void;
  updateToolConfiguration: (toolId: string, config: ToolConfig) => void;
  updateToolComment: (toolId: string, comment: string | undefined) => void;
  batchUpdateToolPositions: (
    updates: Array<{ id: string; x: number; y: number }>
  ) => void;

  // Wire CRUD operations
  addWire: (wire: Wire) => { success: boolean; error?: string | undefined };
  removeWire: (from: Wire["from"], to: Wire["to"]) => void;
  removeWiresByTool: (toolId: string) => void;

  // Batch operations
  batchAddToolsAndWires: (tools: Tool[], wires: Wire[]) => void;

  // Metadata operations
  updateWorkflowMeta: (
    meta: Partial<Pick<WorkflowMeta, "name" | "description" | "author">>
  ) => void;

  // Lifecycle operations
  newWorkflow: (meta?: Partial<WorkflowMeta>) => void;
  loadWorkflow: (tools: Tool[], wires: Wire[], meta: WorkflowMeta) => void;
  clear: () => void;

  // Validation
  validateWire: (wire: Wire) => { valid: boolean; error?: string };
}

const createDefaultMeta = (): WorkflowMeta => {
  return {
    name: "New Workflow",
    description: "A new workflow",
    // Tab creation supplies the persistent author; this store only holds data.
    author: 'User',
    workflowId: uuidv4(),
    created: new Date().toISOString(),
    defaultEngine: DEFAULT_ENGINE,
  };
};

const logger = createLogger('WorkflowStore');

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      tools: [],
      wires: [],
      workflowMeta: createDefaultMeta(),
      selectedTool: null,

      // Selection and local (non-history) updates
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

      // Tool CRUD operations
      addTool: (tool) => {
        set((state) => {
          state.tools.push(tool);
        });
      },

      removeTool: (toolId) => {
        set((state) => {
          state.tools = state.tools.filter((t) => t.id !== toolId);
          state.wires = state.wires.filter(
            (w) => w.from.tool !== toolId && w.to.tool !== toolId
          );
          if (state.selectedTool?.id === toolId) {
            state.selectedTool = null;
          }
        });
      },

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
        });
      },

      updateToolComment: (toolId, comment) => {
        set((state) => {
          const tool = state.tools.find((t) => t.id === toolId);
          if (tool) {
            if (comment === undefined) {
              delete tool.comment;
            } else {
              tool.comment = comment;
            }
            // Sync selected tool reference
            if (state.selectedTool?.id === toolId) {
              state.selectedTool = tool;
            }
          }
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

      // Wire CRUD operations
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
      },

      removeWiresByTool: (toolId) => {
        set((state) => {
          state.wires = state.wires.filter(
            (w) => w.from.tool !== toolId && w.to.tool !== toolId
          );
        });
      },

      // Batch operations
      batchAddToolsAndWires: (tools, wires) => {
        set((state) => {
          state.tools.push(...tools);
          state.wires.push(...wires);
        });
      },

      // Metadata operations
      updateWorkflowMeta: (meta) =>
        set((state) => {
          logger.debug("Updating workflow metadata:", meta.name || '(name unchanged)');
          Object.assign(state.workflowMeta, meta);
        }),

      // Lifecycle operations
      newWorkflow: (meta) => {
        set((state) => {
          state.tools = [];
          state.wires = [];
          state.workflowMeta = { ...createDefaultMeta(), ...meta };
          state.selectedTool = null;
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
      },

      clear: () =>
        set((state) => {
          state.tools = [];
          state.wires = [];
          state.selectedTool = null;
        }),

      // Validation
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
    }))
  )
);

// Selector hooks for optimized subscriptions
export const useTools = () => useWorkflowStore((state) => state.tools);
export const useWires = () => useWorkflowStore((state) => state.wires);
export const useWorkflowMeta = () =>
  useWorkflowStore((state) => state.workflowMeta);
export const useSelectedTool = () =>
  useWorkflowStore((state) => state.selectedTool);

// Per-tool atomic selectors. Components that only need a single
// tool by id should subscribe via these helpers instead of grabbing the
// entire `tools` array, so unrelated tool mutations do not trigger a
// re-render on the consumer.
export const useToolById = (toolId: string | null | undefined) =>
  useWorkflowStore((state) =>
    toolId == null ? null : (state.tools.find((t) => t.id === toolId) ?? null)
  );

export const useToolIds = () =>
  useWorkflowStore((state) => state.tools.map((t) => t.id).join("|"));

// Count-only selectors. Subscribing to a number means the
// consumer only re-renders when the count actually changes, not on
// every position/config edit.
export const useToolCount = () =>
  useWorkflowStore((state) => state.tools.length);
export const useWireCount = () =>
  useWorkflowStore((state) => state.wires.length);

// Derived "shape" selector returning a compact, primitive digest
// of tool types in their canvas order. Re-renders only when the set of
// types or their order changes - position/config mutations are ignored.
export const useToolTypesDigest = () =>
  useWorkflowStore((state) => state.tools.map((t) => t.type).join("|"));

// Returns true iff a tool with the given id currently exists.
// Avoids subscribing to the full tools array just to existence-check.
export const useToolExists = (toolId: string | null | undefined) =>
  useWorkflowStore((state) =>
    toolId == null ? false : state.tools.some((t) => t.id === toolId)
  );
