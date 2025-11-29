import type { Tool, Wire } from "@domain/workflow/entities/workflow";
import { useClipboardStore } from "@state/clipboardStore";
import { generateUniqueId } from "@utils/id";
import { createLogger } from "@utils/logger";
import type { Node } from "@xyflow/react";
import { useCallback, useRef } from "react";

export interface ClipboardDeps {
  tools: Tool[];
  wires: Wire[];
  getNodes: () => Node[];
  snap: (x: number, y: number) => { x: number; y: number };
  onBatchAdd?:
    | ((
        toolAdds: { id: string; type: string; x: number; y: number }[],
        wiresToAdd: {
          from: { tool: string; socket: string };
          to: { tool: string; socket: string };
        }[]
      ) => void)
    | undefined;
  onAddTool: (type: string, x: number, y: number, idOverride?: string) => void;
  onAddWire: (
    f: { tool: string; socket: string },
    t: { tool: string; socket: string }
  ) => void;
  onRemoveTool: (id: string) => void;
  setNodes: (updater: (ns: Node[]) => Node[]) => void;
  onToolSelect?: ((tool: Tool | null) => void) | undefined;
}

export function useCanvasClipboard({
  tools,
  wires,
  getNodes,
  snap,
  onBatchAdd,
  onAddTool,
  onAddWire,
  onRemoveTool,
  setNodes,
  onToolSelect,
}: ClipboardDeps) {
  const logger = createLogger('Clipboard');
  const latestToolsRef = useRef<Tool[]>(tools);
  const lastMouseFlowPosRef = useRef<{ x: number; y: number } | null>(null);

  const getSelectedIds = useCallback(() => {
    const rfNodes = getNodes();
    return new Set(rfNodes.filter((n) => n.selected).map((n) => n.id));
  }, [getNodes]);

  const setPasteAnchor = useCallback((x: number, y: number) => {
    lastMouseFlowPosRef.current = { x, y };
  }, []);

  const doCopy = useCallback(() => {
    logger.debug("Starting copy operation");
    const selectedIds = getSelectedIds();
    logger.debug("Selected IDs:", Array.from(selectedIds));

    if (selectedIds.size === 0) {
      logger.debug("No tools selected");
      return;
    }

    const ids = tools.filter((t) => selectedIds.has(t.id)).map((t) => t.id);
    if (ids.length === 0) {
      logger.debug("No matching tools found");
      return;
    }

    // Build clipboard data
    type ToolSnapshot = { id: string; type: string; x: number; y: number };
    const selectedTools = tools.filter((t) => selectedIds.has(t.id));
    if (selectedTools.length === 0) return;

    const minX = Math.min(...selectedTools.map((t) => t.x));
    const minY = Math.min(...selectedTools.map((t) => t.y));
    const toolSnaps: ToolSnapshot[] = selectedTools.map((t) => ({
      id: t.id,
      type: t.type,
      x: t.x,
      y: t.y,
    }));

    const selSet = new Set(selectedTools.map((t) => t.id));
    const innerWires = wires.filter(
      (w) => selSet.has(w.from.tool) && selSet.has(w.to.tool)
    );

    const clipboardData = { tools: toolSnaps, wires: innerWires, minX, minY };
    logger.debug("Clipboard data prepared:", clipboardData);

    // Update store directly using getState
    useClipboardStore.getState().setClipboard(clipboardData);
    logger.debug("Clipboard updated in store");
  }, [getSelectedIds, tools, wires]);

  const doCut = useCallback(() => {
    doCopy();
    const selectedIds = getSelectedIds();
    if (selectedIds.size === 0) return;
    selectedIds.forEach((id) => onRemoveTool(id));
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
    onToolSelect?.(null);
  }, [doCopy, getSelectedIds, onRemoveTool, setNodes, onToolSelect]);

  const doDelete = useCallback(() => {
    const selectedIds = getSelectedIds();
    if (selectedIds.size === 0) return;
    selectedIds.forEach((id) => onRemoveTool(id));
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
    onToolSelect?.(null);
  }, [getSelectedIds, onRemoveTool, setNodes, onToolSelect]);

  const doPaste = useCallback(() => {
    logger.debug("Starting paste operation");

    const cb = useClipboardStore.getState().clipboard;
    logger.debug("Clipboard contents:", cb);

    if (!cb) {
      logger.debug("No clipboard data available");
      return;
    }

    const existingIds = new Set(tools.map((t) => t.id));
    const idMap = new Map<string, string>();
    const lastPos = lastMouseFlowPosRef.current;
    const baseX = lastPos ? lastPos.x : cb.minX + 20;
    const baseY = lastPos ? lastPos.y : cb.minY + 20;
    const newIds: string[] = [];
    const toolAdds: { id: string; type: string; x: number; y: number }[] = [];

    cb.tools.forEach(
      (ts: { id: string; type: string; x: number; y: number }) => {
        const newId = generateUniqueId(existingIds, 8);
        existingIds.add(newId);
        idMap.set(ts.id, newId);
        newIds.push(newId);
        const nx = ts.x - cb.minX + baseX;
        const ny = ts.y - cb.minY + baseY;
        const snapped = snap(nx, ny);
        toolAdds.push({
          id: newId,
          type: ts.type,
          x: snapped.x,
          y: snapped.y,
        });
      }
    );

    const remappedWires: {
      from: { tool: string; socket: string };
      to: { tool: string; socket: string };
    }[] = [];
    cb.wires.forEach(
      (w: {
        from: { tool: string; socket: string };
        to: { tool: string; socket: string };
      }) => {
        const fromId = idMap.get(w.from.tool);
        const toId = idMap.get(w.to.tool);
        if (fromId && toId)
          remappedWires.push({
            from: { tool: fromId, socket: w.from.socket },
            to: { tool: toId, socket: w.to.socket },
          });
      }
    );

    logger.debug(
      "About to add tools:",
      toolAdds.length,
      "wires:",
      remappedWires.length
    );

    if (typeof onBatchAdd === "function") {
      logger.debug("Using onBatchAdd");
      onBatchAdd(toolAdds, remappedWires);
    } else {
      logger.debug("Using individual onAddTool");
      toolAdds.forEach((t) => onAddTool(t.type, t.x, t.y, t.id));

      const addWiresWhenReady = (retries = 0) => {
        const presentInRF = newIds.every(
          (id) => !!getNodes().find((n) => n.id === id)
        );
        const presentInStore = newIds.every((id) =>
          latestToolsRef.current.some((tt) => tt.id === id)
        );
        if (!(presentInRF && presentInStore) && retries < 40) {
          setTimeout(() => addWiresWhenReady(retries + 1), 25);
          return;
        }
        remappedWires.forEach((w) => onAddWire(w.from, w.to));
      };
      addWiresWhenReady();
    }

    setTimeout(() => {
      setNodes((ns) =>
        ns.map((n) => ({ ...n, selected: newIds.includes(n.id) }))
      );
    }, 0);
  }, [onBatchAdd, onAddTool, onAddWire, getNodes, snap, tools, setNodes]);

  return {
    doCopy,
    doCut,
    doDelete,
    doPaste,
    setPasteAnchor,
    lastMouseFlowPosRef,
  } as const;
}
