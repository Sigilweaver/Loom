import React, { useRef, useMemo, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import '@xyflow/react/dist/style.css';
import { useReactFlow, useNodesState, useEdgesState, type Node, type Edge, type Connection } from '@xyflow/react';
import { Tool, Wire } from '@domain/workflow/entities/workflow';
import WorkflowNode from '../WorkflowNode';
import { getToolDefinition } from '@data/tools';
import { calculateMenuPosition } from '@utils/menuPositioning';
import { useUIStore } from '@state/uiStore';
import { useSnapToGrid } from './hooks/useSnapToGrid';
import { useCanvasPaste } from './hooks/useCanvasPaste';
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard';
import { useCanvasClipboard } from './hooks/useCanvasClipboard';
import { useNodeResync } from './hooks/useNodeResync';
import { useMinimapStyle } from './hooks/useMinimapStyle';
import { useNodeColor } from './hooks/useNodeColor';
import { CanvasControls } from './CanvasControls';
import { CanvasMinimap } from './CanvasMinimap';
import { CanvasPositionMenu } from './CanvasPositionMenu';
import { CanvasMenus } from './CanvasMenus';
import { CanvasSurface } from './CanvasSurface';
import { CanvasDragAndDropLayer } from './CanvasDragAndDropLayer';
import { alignHorizontally as doAlignH, alignVertically as doAlignV, distributeHorizontally as doDistH, distributeVertically as doDistV, type PositionUpdate } from '@utils/alignDistribute';
import { getXMLClipboard, getLegacyClipboard } from './clipboardStore';

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
  onBeginTransaction?: () => void;
  onCommitTransaction?: () => void;
  // XML clipboard integration from App
  onBuildCopyFragment?: (selectedIds: string[]) => string;
  onPasteXMLAt?: (anchor: { x: number; y: number }, fragment: string) => Promise<string[]>;
}
const nodeTypes = { workflow: WorkflowNode };
export const CanvasShell = forwardRef<CanvasRef, Props>(({ tools, wires, edges, onAddTool, onAddWire, onRemoveWire, onRemoveTool, onToolMove, onToolSelect, onBatchAdd, onBeginTransaction, onCommitTransaction, onBuildCopyFragment, onPasteXMLAt }, ref) => {
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();
  // Keyboard scope: only active when this wrapper has focus
  const keyScopeRef = useRef<HTMLDivElement>(null);
  // Track pointer state via hook (for guarded resync)
  // Initialized after useNodesState below
  const isFirefox = useMemo(() => typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent), []);
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
  const isPointerDownRef = useNodeResync(nodes, setNodes);
  // resync handled by useNodeResync
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
  const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
  setPasteAnchor(flowPos.x, flowPos.y);
  setActionsCoords({ x: clientX, y: clientY });
    setActionsOpen(true);
  }, [setNodes, screenToFlowPosition]);
  const onPaneClick = useCallback(()=>{ closePositionMenu(); onToolSelect?.(null); setNodes(ns=>ns.map(n=>({...n, selected:false}))); }, [closePositionMenu, onToolSelect, setNodes]);
  const onPaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault();
  // Update last mouse flow position to this point so Paste uses it
  const clientX = (e as MouseEvent).clientX ?? (e as React.MouseEvent).clientX;
  const clientY = (e as MouseEvent).clientY ?? (e as React.MouseEvent).clientY;
  const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
  setPasteAnchor(flowPos.x, flowPos.y);
  // Build a paste-only menu if clipboard exists
  const hasClipboard = !!getXMLClipboard() || !!getLegacyClipboard();
    if (!hasClipboard) return;
    setActionsCoords({ x: clientX, y: clientY });
    setActionsOpen(true);
  }, [screenToFlowPosition]);
  const onNodeDragStart = useCallback((_e: React.MouseEvent, _n: Node) => {
    onBeginTransaction?.();
  }, [onBeginTransaction]);
  const onNodeDragStop = useCallback((_e:React.MouseEvent, _n:Node)=>{
    // Persist positions for all selected nodes (group move)
    const current = getNodes();
    current.filter(nd => nd.selected).forEach(nd => {
      const s = snap(nd.position.x, nd.position.y);
      onToolMove(nd.id, s.x, s.y);
    });
    onCommitTransaction?.();
  }, [getNodes, onToolMove, snap, onCommitTransaction]);
  const handleMinimapButtonContextMenu = useCallback((e:React.MouseEvent)=>{ e.preventDefault(); if(minimapButtonRef.current && !positionMenuOpen){ const rect = minimapButtonRef.current.getBoundingClientRect(); const pos = calculateMenuPosition(rect, { width:100, height:160 }, 4, 'bottom'); openPositionMenu({ x: pos.x, y: pos.y }); } else if(positionMenuOpen) { closePositionMenu(); } }, [positionMenuOpen, openPositionMenu, closePositionMenu]);
  const handlePositionSelect = useCallback((p:'top-left'|'top-right'|'bottom-left'|'bottom-right')=>setMinimapPosition(p), [setMinimapPosition]);
  const handleWheel = useCallback((_e:React.WheelEvent)=>{}, []);
  // Actions menu (left-click)
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [actionsCoords, setActionsCoords] = React.useState<{ x: number; y: number } | null>(null);
  // Edge context menu state
  const [edgeMenuOpen, setEdgeMenuOpen] = React.useState(false);
  const [edgeMenuCoords, setEdgeMenuCoords] = React.useState<{ x: number; y: number } | null>(null);
  const [edgeMenuEdge, setEdgeMenuEdge] = React.useState<Edge | null>(null);
  const openActionsMenu = useCallback(() => {
    if (!actionsButtonRef.current) return;
    const rect = actionsButtonRef.current.getBoundingClientRect();
    const pos = calculateMenuPosition(rect, { width: 140, height: 160 }, 4, 'bottom');
    setActionsCoords({ x: pos.x, y: pos.y });
    setActionsOpen(true);
  }, []);
  const closeActionsMenu = useCallback(() => setActionsOpen(false), []);
  // Clipboard hook (copy/cut/delete/paste + anchor)
  const { doCopy, doCut, doDelete, doPaste, setPasteAnchor, lastMouseFlowPosRef } = useCanvasClipboard({
    tools,
    wires,
    getNodes,
    snap,
    onBuildCopyFragment,
    onPasteXMLAt: onPasteXMLAt as any,
    onBatchAdd,
    onAddTool,
    onAddWire,
    onRemoveTool,
    setNodes: (updater) => setNodes((ns:any) => updater(ns)),
    onToolSelect,
  });
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setPasteAnchor(pos.x, pos.y);
  }, [screenToFlowPosition, setPasteAnchor]);
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
  // Clipboard hook now provides selection-aware actions; keep CanvasShell free of selection helpers
  // Alignment & distribution helpers
  const applyPositions = useCallback((updates: PositionUpdate[]) => {
    if (!updates.length) return;
    onBeginTransaction?.();
    updates.forEach(u => onToolMove(u.id, u.x, u.y));
    onCommitTransaction?.();
  }, [onBeginTransaction, onCommitTransaction, onToolMove]);
  const alignHorizontally = useCallback(() => {
    const updates = doAlignH(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);
  const alignVertically = useCallback(() => {
    const updates = doAlignV(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);
  const distributeHorizontally = useCallback(() => {
    const updates = doDistH(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);
  const distributeVertically = useCallback(() => {
    const updates = doDistV(getNodes(), snap);
    applyPositions(updates);
  }, [getNodes, snap, applyPositions]);

  // Handle native paste event (works in Firefox). Prefer event.clipboardData over async clipboard.
  const onPaste = useCanvasPaste({
    onPasteXMLAt: onPasteXMLAt as any,
    setNodes,
    doPaste,
  getAnchor: () => lastMouseFlowPosRef.current ?? { x: 20, y: 20 },
  });
  

  // Esc clears selection; Ctrl/Cmd+C/X/V handle only when canvas wrapper has focus
  const onKeyDown = useCanvasKeyboard({ isFirefox, setNodes, setEdges, onToolSelect: onToolSelect as any, doCopy, doCut, doPaste });
  const getNodeColor = useNodeColor(tools); const getMinimapStyle = useMinimapStyle(minimapPosition);
  // Edge menu items now built in CanvasMenus
  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setEdgeMenuEdge(edge);
    setEdgeMenuCoords({ x: e.clientX, y: e.clientY });
    setEdgeMenuOpen(true);
  }, []);
  return (
    <div
      ref={keyScopeRef}
      tabIndex={0}
  onPaste={onPaste}
  onKeyDown={onKeyDown}
  onMouseDown={(e) => { if (e.button === 0) { isPointerDownRef.current = true; const onUp = () => { isPointerDownRef.current = false; window.removeEventListener('mouseup', onUp); }; window.addEventListener('mouseup', onUp); } keyScopeRef.current?.focus(); }}
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
  <CanvasSurface nodes={flowNodes} edges={flowEdges} snapToGrid={snapToGrid} snapGrid={snapGrid} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete} onConnect={onConnect} onNodeClick={onNodeClick} onNodeContextMenu={onNodeContextMenu} onPaneClick={onPaneClick} onEdgeContextMenu={onEdgeContextMenu} onPaneContextMenu={onPaneContextMenu} onDrop={()=>{}} onDragOver={()=>{}} onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop} onWheel={handleWheel} onMouseMove={onMouseMove} onSelectionChange={onSelectionChange} nodeTypes={nodeTypes}>
        <CanvasControls minimapVisible={minimapVisible} minimapPosition={minimapPosition} snapToGrid={snapToGrid} onToggleMinimap={toggleMinimap} onToggleSnap={toggleSnapToGrid} onContextMenuMinimap={handleMinimapButtonContextMenu} minimapButtonRef={minimapButtonRef} actionsButtonRef={actionsButtonRef} onActionsClick={openActionsMenu} />
        <CanvasMinimap visible={minimapVisible} position={minimapPosition} nodeColor={getNodeColor} style={getMinimapStyle()} />
  </CanvasSurface>
  </div>
      <CanvasPositionMenu open={positionMenuOpen} coords={positionMenuCoords} currentPosition={minimapPosition} onSelect={handlePositionSelect} onClose={closePositionMenu} />
      <CanvasMenus
        actionsOpen={actionsOpen}
        actionsCoords={actionsCoords}
        onCloseActions={closeActionsMenu}
        hasSelection={getNodes().some(n => n.selected)}
        multiSelection={getNodes().filter(n => n.selected).length > 1}
  hasClipboard={!!getXMLClipboard() || !!getLegacyClipboard()}
        onCopy={doCopy}
        onCut={doCut}
        onPaste={doPaste}
        onDelete={doDelete}
        onAlignH={alignHorizontally}
        onAlignV={alignVertically}
        onDistH={distributeHorizontally}
        onDistV={distributeVertically}
        edgeMenuOpen={edgeMenuOpen && !!edgeMenuEdge}
        edgeMenuCoords={edgeMenuCoords}
        onCloseEdgeMenu={() => setEdgeMenuOpen(false)}
        edge={edgeMenuEdge}
        tools={tools}
        wires={wires}
        onAddWire={onAddWire}
        onRemoveWire={onRemoveWire}
        onBeginTransaction={onBeginTransaction}
        onCommitTransaction={onCommitTransaction}
      />
  </CanvasDragAndDropLayer>
  </div>
  );
});
CanvasShell.displayName = 'CanvasShell';
