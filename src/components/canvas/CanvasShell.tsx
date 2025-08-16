import React, { useRef, useMemo, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import '@xyflow/react/dist/style.css';
import { useReactFlow, useNodesState, useEdgesState, type Node, type Edge, type Connection } from '@xyflow/react';
import { Tool, Wire } from '@domain/workflow/entities/workflow';
import WorkflowNode from '../WorkflowNode';
import { getToolDefinition } from '@data/tools';
import { calculateMenuPosition } from '@utils/menuPositioning';
import { useUIStore } from '@state/uiStore';
import { useSnapToGrid } from './hooks/useSnapToGrid';
import { useMinimapStyle } from './hooks/useMinimapStyle';
import { useNodeColor } from './hooks/useNodeColor';
import { CanvasControls } from './CanvasControls';
import { CanvasMinimap } from './CanvasMinimap';
import { CanvasPositionMenu } from './CanvasPositionMenu';
import { CanvasActionMenu, type ActionItem } from './CanvasActionMenu';
import { CanvasSurface } from './CanvasSurface';
import { CanvasDragAndDropLayer } from './CanvasDragAndDropLayer';
import { generateUniqueId } from '@utils/id';

export interface CanvasRef { fitView: () => void; }
interface Props {
  tools: Tool[];
  wires: Wire[];
  edges: Edge[];
  onAddTool: (type: string, x: number, y: number, idOverride?: string) => void;
  onAddWire: (f: { tool: string; socket: number }, t: { tool: string; socket: number }) => void;
  onRemoveWire: (id: string) => void;
  onRemoveTool: (id: string) => void;
  onToolMove: (id: string, x: number, y: number) => void;
  onToolSelect?: (tool: Tool | null) => void;
  onBatchAdd?: (
    toolAdds: { id: string; type: string; x: number; y: number }[],
    wiresToAdd: { from: { tool: string; socket: number }; to: { tool: string; socket: number } }[]
  ) => void;
}
const nodeTypes = { workflow: WorkflowNode };
export const CanvasShell = forwardRef<CanvasRef, Props>(({ tools, wires, edges, onAddTool, onAddWire, onRemoveWire, onRemoveTool, onToolMove, onToolSelect, onBatchAdd }, ref) => {
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();
  // Keyboard scope: only active when this wrapper has focus
  const keyScopeRef = useRef<HTMLDivElement>(null);
  // Track latest tools from store to avoid races when wiring after paste
  const latestToolsRef = useRef<Tool[]>(tools);
  useEffect(() => { latestToolsRef.current = tools; }, [tools]);
  const minimapButtonRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLDivElement>(null);
  const minimapVisible = useUIStore(s=>s.minimapVisible); const minimapPosition = useUIStore(s=>s.minimapPosition); const positionMenuOpen = useUIStore(s=>s.positionMenuOpen); const positionMenuCoords = useUIStore(s=>s.positionMenuCoords); const toggleMinimap = useUIStore(s=>s.toggleMinimap); const setMinimapPosition = useUIStore(s=>s.setMinimapPosition); const openPositionMenu = useUIStore(s=>s.openPositionMenu); const closePositionMenu = useUIStore(s=>s.closePositionMenu);
  const snapGrid:[number,number] = [20,20];
  const { snapToGrid, toggleSnapToGrid, snap } = useSnapToGrid(snapGrid);
  useImperativeHandle(ref, () => ({ fitView: () => fitView({ duration:800, padding:0.1 }) }), [fitView]);
  const nodes: Node[] = useMemo(() => tools.map(tool => ({ id: tool.id, type:'workflow', position:{ x: tool.x, y: tool.y }, data:{ tool, definition:getToolDefinition(tool.type), onToolMove }, deletable:true, selectable:true })), [tools, onToolMove]);
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes); const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  React.useEffect(()=>{ setNodes(curr=>{ const sel=new Map(curr.map(n=>[n.id,n.selected])); return nodes.map(n=>({...n, selected: sel.get(n.id)||false})); }); }, [nodes, setNodes]);
  React.useEffect(()=>{ setEdges(edges); }, [edges, setEdges]);
  const onConnect = useCallback((c:Connection)=>{ if(c.source&&c.target&&c.sourceHandle&&c.targetHandle){ const fromSocket=parseInt(c.sourceHandle.replace('output-','')); const toSocket=parseInt(c.targetHandle.replace('input-','')); onAddWire({ tool:c.source, socket:fromSocket }, { tool:c.target, socket:toSocket }); } }, [onAddWire]);
  const onEdgesDelete = useCallback((es:Edge[])=>{ es.forEach(e=>onRemoveWire(e.id)); }, [onRemoveWire]);
  const onNodesDelete = useCallback((ns:Node[])=>{ ns.forEach(n=>onRemoveTool(n.id)); onToolSelect?.(null); }, [onRemoveTool, onToolSelect]);
  const onNodeClick = useCallback((_e:React.MouseEvent, n:Node)=>{ const tool=tools.find(t=>t.id===n.id); if(tool) onToolSelect?.(tool); }, [tools, onToolSelect]);
  const onNodeContextMenu = useCallback((e: MouseEvent | React.MouseEvent, n: Node) => {
    e.preventDefault();
    // Select only this node if it's not already part of a selection
    setNodes(ns => {
      const alreadySelected = ns.find(nd => nd.id === n.id)?.selected;
      if (alreadySelected) return ns; // keep multi-selection
      return ns.map(nd => ({ ...nd, selected: nd.id === n.id }));
    });
    // Position menu at mouse cursor and set paste anchor
    const clientX = (e as MouseEvent).clientX ?? (e as React.MouseEvent).clientX;
    const clientY = (e as MouseEvent).clientY ?? (e as React.MouseEvent).clientY;
    lastMouseFlowPosRef.current = screenToFlowPosition({ x: clientX, y: clientY });
    setActionsCoords({ x: clientX, y: clientY });
    setActionsOpen(true);
  }, [setNodes, screenToFlowPosition]);
  const onPaneClick = useCallback(()=>{ closePositionMenu(); onToolSelect?.(null); setNodes(ns=>ns.map(n=>({...n, selected:false}))); }, [closePositionMenu, onToolSelect, setNodes]);
  const onPaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault();
    // Update last mouse flow position to this point so Paste uses it
    const clientX = (e as MouseEvent).clientX ?? (e as React.MouseEvent).clientX;
    const clientY = (e as MouseEvent).clientY ?? (e as React.MouseEvent).clientY;
    lastMouseFlowPosRef.current = screenToFlowPosition({ x: clientX, y: clientY });
    // Build a paste-only menu if clipboard exists
    const hasClipboard = !!(CanvasShell as any)._clipboard;
    if (!hasClipboard) return;
    setActionsCoords({ x: clientX, y: clientY });
    setActionsOpen(true);
  }, [screenToFlowPosition]);
  const onNodeDragStop = useCallback((_e:React.MouseEvent, _n:Node)=>{
    // Persist positions for all selected nodes (group move)
    const current = getNodes();
    current.filter(nd => nd.selected).forEach(nd => {
      const s = snap(nd.position.x, nd.position.y);
      onToolMove(nd.id, s.x, s.y);
    });
  }, [getNodes, onToolMove, snap]);
  const handleMinimapButtonContextMenu = useCallback((e:React.MouseEvent)=>{ e.preventDefault(); if(minimapButtonRef.current && !positionMenuOpen){ const rect = minimapButtonRef.current.getBoundingClientRect(); const pos = calculateMenuPosition(rect, { width:100, height:160 }, 4, 'bottom'); openPositionMenu({ x: pos.x, y: pos.y }); } else if(positionMenuOpen) { closePositionMenu(); } }, [positionMenuOpen, openPositionMenu, closePositionMenu]);
  const handlePositionSelect = useCallback((p:'top-left'|'top-right'|'bottom-left'|'bottom-right')=>setMinimapPosition(p), [setMinimapPosition]);
  const handleWheel = useCallback((_e:React.WheelEvent)=>{}, []);
  // Actions menu (left-click)
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [actionsCoords, setActionsCoords] = React.useState<{ x: number; y: number } | null>(null);
  const openActionsMenu = useCallback(() => {
    if (!actionsButtonRef.current) return;
    const rect = actionsButtonRef.current.getBoundingClientRect();
    const pos = calculateMenuPosition(rect, { width: 140, height: 160 }, 4, 'bottom');
    setActionsCoords({ x: pos.x, y: pos.y });
    setActionsOpen(true);
  }, []);
  const closeActionsMenu = useCallback(() => setActionsOpen(false), []);
  // Track last mouse position over the canvas in flow coordinates
  const lastMouseFlowPosRef = useRef<{ x: number; y: number } | null>(null);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    lastMouseFlowPosRef.current = screenToFlowPosition({ x: e.clientX, y: e.clientY });
  }, [screenToFlowPosition]);
  // Keep UI selection state in sync with app selection
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[]; edges: Edge[] }) => {
    if (selectedNodes.length === 1) {
      const first = selectedNodes[0];
      const tool = first ? (tools.find(t => t.id === first.id) ?? null) : null;
      onToolSelect?.(tool);
    } else {
      onToolSelect?.(null);
    }
  }, [tools, onToolSelect]);
  // Show marquee only while actively dragging a selection
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        document.body.classList.add('sig-lasso-active');
      }
    };
    const onMouseUp = () => {
      document.body.classList.remove('sig-lasso-active');
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);
  // Helpers shared by keyboard and menu
  const getSelectedIds = useCallback(() => {
    const rfNodes = getNodes();
    return new Set(rfNodes.filter(n => n.selected).map(n => n.id));
  }, [getNodes]);
  const doCopy = useCallback(() => {
    const selectedIds = getSelectedIds();
    if (selectedIds.size === 0) return;
    type ToolSnapshot = { id: string; type: string; x: number; y: number };
    const setClipboard = (data: { tools: ToolSnapshot[]; wires: Wire[]; minX: number; minY: number }) => { (CanvasShell as any)._clipboard = data; };
    const selectedTools = tools.filter(t => selectedIds.has(t.id));
    if (selectedTools.length === 0) return;
    const minX = Math.min(...selectedTools.map(t => t.x));
    const minY = Math.min(...selectedTools.map(t => t.y));
    const toolSnaps: ToolSnapshot[] = selectedTools.map(t => ({ id: t.id, type: t.type, x: t.x, y: t.y }));
    const selSet = new Set(selectedTools.map(t => t.id));
    const innerWires = wires.filter(w => selSet.has(w.from.tool) && selSet.has(w.to.tool));
    setClipboard({ tools: toolSnaps, wires: innerWires, minX, minY });
  }, [getSelectedIds, tools, wires]);
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
    type ToolSnapshot = { id: string; type: string; x: number; y: number };
    const getClipboard = () => (CanvasShell as any)._clipboard as { tools: ToolSnapshot[]; wires: Wire[]; minX: number; minY: number } | undefined;
    const cb = getClipboard();
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
      if (fromId && toId) {
        remappedWires.push({ from: { tool: fromId, socket: w.from.socket }, to: { tool: toId, socket: w.to.socket } });
      }
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
  }, [onBatchAdd, onAddTool, onAddWire, getNodes, snap, tools]);

  // Esc clears selection; Ctrl/Cmd+C/X/V handle only when canvas wrapper has focus
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (isTyping) return;
    if (e.key === 'Escape') {
      setNodes(ns => ns.map(n => ({ ...n, selected: false })));
      setEdges(es => es.map(edge => ({ ...edge, selected: false })));
      onToolSelect?.(null);
      return;
    }
    const isCopy = (e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey);
    const isCut = (e.key === 'x' || e.key === 'X') && (e.ctrlKey || e.metaKey);
    const isPaste = (e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey);
    if (!(isCopy || isCut || isPaste)) return;
    e.preventDefault();
    if (isCopy) doCopy();
    if (isCut) doCut();
    if (isPaste) doPaste();
  }, [setNodes, setEdges, onToolSelect, getNodes, tools, wires, onRemoveTool, onAddTool, onAddWire, snap]);
  const getNodeColor = useNodeColor(tools); const getMinimapStyle = useMinimapStyle(minimapPosition);
  return (
    <div
      ref={keyScopeRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseDown={() => keyScopeRef.current?.focus()}
      className="flex-1 h-full min-h-0"
      style={{ outline: 'none' }}
    >
    <CanvasDragAndDropLayer onAddTool={onAddTool} snap={snap} screenToFlowPosition={screenToFlowPosition}>
      <div className="flex-1 h-full min-h-0">
  <style>{`
  /* keep React Flow default selected styles visible */
  .react-flow__node.dragging{opacity:.8!important}
  .react-flow__attribution{display:none!important}
  /* Edge color states override */
  .react-flow__edge .react-flow__edge-path{stroke:var(--color-edge-default-stroke)!important}
  .react-flow__edge:hover .react-flow__edge-path,.react-flow__edge .react-flow__edge-path:hover{stroke:var(--color-edge-default-stroke-hover)!important}
  .react-flow__edge.selected .react-flow__edge-path{stroke:var(--color-edge-selected-stroke)!important}
  .react-flow__edge.selected:hover .react-flow__edge-path,.react-flow__edge.selected .react-flow__edge-path:hover{stroke:var(--color-edge-selected-stroke-hover)!important}
  .react-flow__edge.animated .react-flow__edge-path{stroke:var(--color-edge-animated-stroke)!important}
  .react-flow__edge.animated:hover .react-flow__edge-path,.react-flow__edge.animated .react-flow__edge-path:hover{stroke:var(--color-edge-animated-stroke-hover)!important}
  `}</style>
  <CanvasSurface nodes={flowNodes} edges={flowEdges} snapToGrid={snapToGrid} snapGrid={snapGrid} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete} onConnect={onConnect} onNodeClick={onNodeClick} onNodeContextMenu={onNodeContextMenu} onPaneClick={onPaneClick} onPaneContextMenu={onPaneContextMenu} onDrop={()=>{}} onDragOver={()=>{}} onNodeDragStop={onNodeDragStop} onWheel={handleWheel} onMouseMove={onMouseMove} onSelectionChange={onSelectionChange} nodeTypes={nodeTypes}>
        <CanvasControls minimapVisible={minimapVisible} minimapPosition={minimapPosition} snapToGrid={snapToGrid} onToggleMinimap={toggleMinimap} onToggleSnap={toggleSnapToGrid} onContextMenuMinimap={handleMinimapButtonContextMenu} minimapButtonRef={minimapButtonRef} actionsButtonRef={actionsButtonRef} onActionsClick={openActionsMenu} />
        <CanvasMinimap visible={minimapVisible} position={minimapPosition} nodeColor={getNodeColor} style={getMinimapStyle()} />
  </CanvasSurface>
  </div>
      <CanvasPositionMenu open={positionMenuOpen} coords={positionMenuCoords} currentPosition={minimapPosition} onSelect={handlePositionSelect} onClose={closePositionMenu} />
      <CanvasActionMenu
        open={actionsOpen}
        coords={actionsCoords}
        onClose={closeActionsMenu}
        items={(() => {
          const selectedIds = getNodes().filter(n => n.selected).map(n => n.id);
          const hasSelection = selectedIds.length > 0;
          const hasClipboard = !!(CanvasShell as any)._clipboard;
          const items: ActionItem[] = [];
          // If there's a selection, show full set. If invoked on empty pane, show Paste only.
          const mod = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
          if (hasSelection) {
            items.push({ key: 'copy', label: 'Copy', onClick: doCopy, hint: `${mod}+C` });
            items.push({ key: 'cut', label: 'Cut', onClick: doCut, hint: `${mod}+X` });
            if (hasClipboard) items.push({ key: 'paste', label: 'Paste', onClick: doPaste, hint: `${mod}+V` });
            items.push({ key: 'delete', label: 'Delete', onClick: doDelete, hint: 'Del' });
          } else if (hasClipboard) {
            items.push({ key: 'paste', label: 'Paste', onClick: doPaste, hint: `${mod}+V` });
          }
          return items;
        })()}
      />
  </CanvasDragAndDropLayer>
  </div>
  );
});
CanvasShell.displayName = 'CanvasShell';
