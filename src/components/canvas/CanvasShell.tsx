import React, { useRef, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
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
import { CanvasSurface } from './CanvasSurface';
import { CanvasDragAndDropLayer } from './CanvasDragAndDropLayer';

export interface CanvasRef { fitView: () => void; }
interface Props { tools: Tool[]; wires: Wire[]; edges: Edge[]; onAddTool:(type:string,x:number,y:number)=>void; onAddWire:(f:{tool:string;socket:number}, t:{tool:string;socket:number})=>void; onRemoveWire:(id:string)=>void; onRemoveTool:(id:string)=>void; onToolMove:(id:string,x:number,y:number)=>void; onToolSelect?: (tool:Tool|null)=>void; }
const nodeTypes = { workflow: WorkflowNode };
export const CanvasShell = forwardRef<CanvasRef, Props>(({ tools, wires: _wires, edges, onAddTool, onAddWire, onRemoveWire, onRemoveTool, onToolMove, onToolSelect }, ref) => {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const minimapButtonRef = useRef<HTMLDivElement>(null);
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
  const onNodeClick = useCallback((_e:React.MouseEvent, n:Node)=>{ const tool=tools.find(t=>t.id===n.id); if(tool) onToolSelect?.(tool); setNodes(ns=>ns.map(x=>({...x, selected:x.id===n.id}))); }, [tools, onToolSelect, setNodes]);
  const onPaneClick = useCallback(()=>{ closePositionMenu(); onToolSelect?.(null); setNodes(ns=>ns.map(n=>({...n, selected:false}))); }, [closePositionMenu, onToolSelect, setNodes]);
  const onNodeDragStop = useCallback((_e:React.MouseEvent, n:Node)=>{ const s = snap(n.position.x, n.position.y); onToolMove(n.id, s.x, s.y); }, [onToolMove, snap]);
  const handleMinimapButtonContextMenu = useCallback((e:React.MouseEvent)=>{ e.preventDefault(); if(minimapButtonRef.current && !positionMenuOpen){ const rect = minimapButtonRef.current.getBoundingClientRect(); const pos = calculateMenuPosition(rect, { width:100, height:160 }, 4, 'bottom'); openPositionMenu({ x: pos.x, y: pos.y }); } else if(positionMenuOpen) { closePositionMenu(); } }, [positionMenuOpen, openPositionMenu, closePositionMenu]);
  const handlePositionSelect = useCallback((p:'top-left'|'top-right'|'bottom-left'|'bottom-right')=>setMinimapPosition(p), [setMinimapPosition]);
  const handleWheel = useCallback((_e:React.WheelEvent)=>{}, []);
  const getNodeColor = useNodeColor(tools); const getMinimapStyle = useMinimapStyle(minimapPosition);
  return (
    <CanvasDragAndDropLayer onAddTool={onAddTool} snap={snap} screenToFlowPosition={screenToFlowPosition}>
  <style>{`
  .react-flow__node.selected,.react-flow__node.selected .react-flow__node-default{outline:none!important;box-shadow:none!important}
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
      <CanvasSurface nodes={flowNodes} edges={flowEdges} snapToGrid={snapToGrid} snapGrid={snapGrid} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete} onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick} onDrop={()=>{}} onDragOver={()=>{}} onNodeDragStop={onNodeDragStop} onWheel={handleWheel} nodeTypes={nodeTypes}>
        <CanvasControls minimapVisible={minimapVisible} minimapPosition={minimapPosition} snapToGrid={snapToGrid} onToggleMinimap={toggleMinimap} onToggleSnap={toggleSnapToGrid} onContextMenuMinimap={handleMinimapButtonContextMenu} minimapButtonRef={minimapButtonRef} />
        <CanvasMinimap visible={minimapVisible} position={minimapPosition} nodeColor={getNodeColor} style={getMinimapStyle()} />
      </CanvasSurface>
      <CanvasPositionMenu open={positionMenuOpen} coords={positionMenuCoords} currentPosition={minimapPosition} onSelect={handlePositionSelect} onClose={closePositionMenu} />
    </CanvasDragAndDropLayer>
  );
});
CanvasShell.displayName = 'CanvasShell';
