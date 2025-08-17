import { useCallback, useRef } from 'react';
import type { Node } from '@xyflow/react';
import type { Tool, Wire } from '@domain/workflow/entities/workflow';
import { generateUniqueId } from '@utils/id';
import { getXMLClipboard, setXMLClipboard, getLegacyClipboard, setLegacyClipboard } from '../clipboardStore';

export interface ClipboardDeps {
  tools: Tool[];
  wires: Wire[];
  getNodes: () => Node[];
  snap: (x: number, y: number) => { x: number; y: number };
  onBuildCopyFragment?: ((selectedIds: string[]) => string) | undefined;
  onPasteXMLAt?: ((anchor: { x: number; y: number }, fragment: string) => Promise<string[]>) | undefined;
  onBatchAdd?: ((
    toolAdds: { id: string; type: string; x: number; y: number }[],
    wiresToAdd: { from: { tool: string; socket: number }; to: { tool: string; socket: number } }[]
  ) => void) | undefined;
  onAddTool: (type: string, x: number, y: number, idOverride?: string) => void;
  onAddWire: (f: { tool: string; socket: number }, t: { tool: string; socket: number }) => void;
  onRemoveTool: (id: string) => void;
  setNodes: (updater: (ns: Node[]) => Node[]) => void;
  onToolSelect?: ((tool: Tool | null) => void) | undefined;
}

export function useCanvasClipboard({ tools, wires, getNodes, snap, onBuildCopyFragment, onPasteXMLAt, onBatchAdd, onAddTool, onAddWire, onRemoveTool, setNodes, onToolSelect }: ClipboardDeps) {
  const latestToolsRef = useRef<Tool[]>(tools);
  const lastMouseFlowPosRef = useRef<{ x: number; y: number } | null>(null);

  const getSelectedIds = useCallback(() => {
    const rfNodes = getNodes();
    return new Set(rfNodes.filter(n => n.selected).map(n => n.id));
  }, [getNodes]);

  const setPasteAnchor = useCallback((x: number, y: number) => {
    lastMouseFlowPosRef.current = { x, y };
  }, []);

  const doCopy = useCallback(() => {
    const selectedIds = getSelectedIds();
    if (selectedIds.size === 0) return;
    const ids = tools.filter(t => selectedIds.has(t.id)).map(t => t.id);
    if (ids.length === 0) return;

    if (onBuildCopyFragment) {
      const fragment = onBuildCopyFragment(ids);
      if (fragment) {
        setXMLClipboard(fragment);
        if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(fragment).catch(() => {});
      }
      return;
    }

    // Legacy clipboard
    type ToolSnapshot = { id: string; type: string; x: number; y: number };
    const selectedTools = tools.filter(t => selectedIds.has(t.id));
    if (selectedTools.length === 0) return;
    const minX = Math.min(...selectedTools.map(t => t.x));
    const minY = Math.min(...selectedTools.map(t => t.y));
    const toolSnaps: ToolSnapshot[] = selectedTools.map(t => ({ id: t.id, type: t.type, x: t.x, y: t.y }));
    const selSet = new Set(selectedTools.map(t => t.id));
    const innerWires = wires.filter(w => selSet.has(w.from.tool) && selSet.has(w.to.tool));
    setLegacyClipboard({ tools: toolSnaps, wires: innerWires, minX, minY });
  }, [getSelectedIds, tools, wires, onBuildCopyFragment]);

  const doCut = useCallback(() => {
    doCopy();
    const selectedIds = getSelectedIds();
    if (selectedIds.size === 0) return;
    selectedIds.forEach(id => onRemoveTool(id));
    setNodes(ns => ns.map(n => ({ ...n, selected: false })));
    onToolSelect?.(null);
  }, [doCopy, getSelectedIds, onRemoveTool, setNodes, onToolSelect]);

  const doDelete = useCallback(() => {
    const selectedIds = getSelectedIds();
    if (selectedIds.size === 0) return;
    selectedIds.forEach(id => onRemoveTool(id));
    setNodes(ns => ns.map(n => ({ ...n, selected: false })));
    onToolSelect?.(null);
  }, [getSelectedIds, onRemoveTool, setNodes, onToolSelect]);

  const doPaste = useCallback(() => {
    const useFragment = (fragment: string) => {
      if (!onPasteXMLAt) return false;
      if (fragment && fragment.includes('<WorkflowFragment')) {
        const lastPos = lastMouseFlowPosRef.current;
        const anchor = lastPos ?? { x: 20, y: 20 };
        onPasteXMLAt(anchor, fragment).then(newIds => {
          if (Array.isArray(newIds) && newIds.length > 0) {
            setTimeout(() => {
              setNodes(ns => ns.map(n => ({ ...n, selected: newIds.includes(n.id) })));
            }, 0);
          }
        }).catch(() => {});
        return true;
      }
      return false;
    };

    if (onPasteXMLAt && navigator?.clipboard?.readText) {
      navigator.clipboard.readText().then(txt => {
        if (!useFragment(txt || '')) {
          const local = getXMLClipboard();
          if (!useFragment(local)) legacyPaste();
        }
      }).catch(() => {
        const local = getXMLClipboard();
        if (!useFragment(local)) legacyPaste();
      });
      return;
    }

  const legacyPaste = () => {
      const cb = getLegacyClipboard();
      if (!cb) return;
      const existingIds = new Set(tools.map(t => t.id));
      const idMap = new Map<string, string>();
      const lastPos = lastMouseFlowPosRef.current;
      const baseX = lastPos ? lastPos.x : cb.minX + 20;
      const baseY = lastPos ? lastPos.y : cb.minY + 20;
      const newIds: string[] = [];
      const toolAdds: { id: string; type: string; x: number; y: number }[] = [];
      cb.tools.forEach(ts => {
        const newId = generateUniqueId(existingIds, 8);
        existingIds.add(newId);
        idMap.set(ts.id, newId);
        newIds.push(newId);
        const nx = ts.x - cb.minX + baseX;
        const ny = ts.y - cb.minY + baseY;
        const snapped = snap(nx, ny);
        toolAdds.push({ id: newId, type: ts.type, x: snapped.x, y: snapped.y });
      });
      const remappedWires: { from: { tool: string; socket: number }; to: { tool: string; socket: number } }[] = [];
      cb.wires.forEach(w => {
        const fromId = idMap.get(w.from.tool);
        const toId = idMap.get(w.to.tool);
        if (fromId && toId) remappedWires.push({ from: { tool: fromId, socket: w.from.socket }, to: { tool: toId, socket: w.to.socket } });
      });
      if (typeof onBatchAdd === 'function') {
        onBatchAdd(toolAdds, remappedWires);
      } else {
        toolAdds.forEach(t => onAddTool(t.type, t.x, t.y, t.id));
        const addWiresWhenReady = (retries = 0) => {
          const presentInRF = newIds.every(id => !!getNodes().find(n => n.id === id));
          const presentInStore = newIds.every(id => latestToolsRef.current.some(tt => tt.id === id));
          if (!(presentInRF && presentInStore) && retries < 40) {
            setTimeout(() => addWiresWhenReady(retries + 1), 25);
            return;
          }
          remappedWires.forEach(w => onAddWire(w.from, w.to));
        };
        addWiresWhenReady();
      }
      setTimeout(() => {
        setNodes(ns => ns.map(n => ({ ...n, selected: newIds.includes(n.id) })));
      }, 0);
    };

    legacyPaste();
  }, [onPasteXMLAt, onBatchAdd, onAddTool, onAddWire, getNodes, snap, tools, setNodes]);

  return {
    doCopy,
    doCut,
    doDelete,
    doPaste,
    setPasteAnchor,
    lastMouseFlowPosRef,
  } as const;
}
