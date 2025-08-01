import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  ConnectionLineType,
  PanOnScrollMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Tool, Wire } from '../types/workflow';
import { getToolDefinition } from '../data/tools';
import WorkflowNode from './WorkflowNode';

interface CanvasProps {
  tools: Tool[];
  wires: Wire[];
  onAddTool: (toolType: string, x: number, y: number) => void;
  onAddWire: (from: { tool: string; socket: number }, to: { tool: string; socket: number }) => void;
  onRemoveWire: (wireId: string) => void;
  onToolMove: (toolId: string, x: number, y: number) => void;
}

const nodeTypes = {
  workflow: WorkflowNode,
};

export default function Canvas({ 
  tools, 
  wires, 
  onAddTool, 
  onAddWire, 
  onRemoveWire,
  onToolMove 
}: CanvasProps) {
  // Convert our tools to React Flow nodes
  const nodes: Node[] = useMemo(() => 
    tools.map(tool => {
      const definition = getToolDefinition(tool.type);
      return {
        id: tool.id,
        type: 'workflow',
        position: { x: tool.x, y: tool.y },
        data: { 
          tool,
          definition,
          onToolMove 
        },
      };
    }), [tools, onToolMove]);

  // Convert our wires to React Flow edges
  const edges: Edge[] = useMemo(() => 
    wires.map((wire) => ({
      id: `${wire.from.tool}-${wire.from.socket}-${wire.to.tool}-${wire.to.socket}`,
      source: wire.from.tool,
      target: wire.to.tool,
      sourceHandle: `output-${wire.from.socket}`,
      targetHandle: `input-${wire.to.socket}`,
      type: 'default',
      style: { stroke: '#4f46e5', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#4f46e5',
      },
      deletable: true,
    })), [wires]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Update flow nodes when tools change
  React.useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);

  // Update flow edges when wires change  
  React.useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && connection.sourceHandle && connection.targetHandle) {
      // Extract socket IDs from handles
      const fromSocket = parseInt(connection.sourceHandle.replace('output-', ''));
      const toSocket = parseInt(connection.targetHandle.replace('input-', ''));
      
      onAddWire(
        { tool: connection.source, socket: fromSocket },
        { tool: connection.target, socket: toSocket }
      );
    }
  }, [onAddWire]);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach((edge) => {
      onRemoveWire(edge.id);
    });
  }, [onRemoveWire]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const toolType = event.dataTransfer.getData('application/reactflow');
    if (!toolType) return;

    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
    const toolSize = 100; // Square tools are 100x100
    
    const position = {
      x: event.clientX - reactFlowBounds.left - (toolSize / 2),
      y: event.clientY - reactFlowBounds.top - (toolSize / 2),
    };

    onAddTool(toolType, position.x, position.y);
  }, [onAddTool]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDragStop = useCallback((_event: any, node: Node) => {
    onToolMove(node.id, node.position.x, node.position.y);
  }, [onToolMove]);

  // Handle wheel events for zooming and panning
  const handleWheel = useCallback((event: React.WheelEvent) => {
    // Ctrl+wheel for zoom
    if (event.ctrlKey) {
      return; // Let React Flow handle zoom
    }
    
    // Shift+wheel for horizontal scrolling
    if (event.shiftKey) {
      return; // Let React Flow handle horizontal pan
    }
    
    // Regular wheel for vertical scrolling
    return; // Let React Flow handle vertical pan
  }, []);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStop={onNodeDragStop}
        onWheel={handleWheel}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.Bezier}
        defaultEdgeOptions={{
          type: 'default',
          style: { stroke: '#4f46e5', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' },
        }}
        panOnScroll={true}
        panOnScrollMode={PanOnScrollMode.Free}
        panOnScrollSpeed={0.8}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomActivationKeyCode="ControlLeft"
        panOnDrag={[1, 2]} // Allow panning with left and middle mouse buttons
        selectNodesOnDrag={false}
        fitView
        className="bg-gray-50"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
