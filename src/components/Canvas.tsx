import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  useReactFlow,
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
import { wouldCreateCycle } from '../utils/loopDetection';
import Notification from './Notification';

interface CanvasProps {
  tools: Tool[];
  wires: Wire[];
  onAddTool: (toolType: string, x: number, y: number) => void;
  onAddWire: (from: { tool: string; socket: number }, to: { tool: string; socket: number }) => void;
  onRemoveWire: (wireId: string) => void;
  onRemoveTool: (toolId: string) => void;
  onToolMove: (toolId: string, x: number, y: number) => void;
  onToolSelect?: (tool: Tool | null) => void;
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
  onRemoveTool,
  onToolMove,
  onToolSelect
}: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  
  // Notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: 'error' | 'warning' | 'success' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showNotification = (message: string, type: 'error' | 'warning' | 'success' | 'info') => {
    setNotification({
      message,
      type,
      isVisible: true
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };
  
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
        deletable: true,
        selectable: true,
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
      style: { 
        stroke: '#4f46e5', 
        strokeWidth: 2,
        cursor: 'pointer'
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#4f46e5',
      },
      deletable: true,
      selectable: true,
      focusable: true,
    })), [wires]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Update flow nodes when tools change - preserve selection state
  React.useEffect(() => {
    setNodes((currentNodes) => {
      // Create a map of current selections
      const selectionMap = new Map(currentNodes.map(node => [node.id, node.selected]));
      
      // Apply selection state to new nodes
      return nodes.map(node => ({
        ...node,
        selected: selectionMap.get(node.id) || false,
      }));
    });
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
      
      // Validate that this connection won't create a cycle
      if (wouldCreateCycle(tools, wires, connection.source, connection.target)) {
        // Get tool names for better user feedback
        const fromTool = tools.find(t => t.id === connection.source);
        const toTool = tools.find(t => t.id === connection.target);
        const fromName = fromTool ? getToolDefinition(fromTool.type)?.name || 'Unknown Tool' : 'Unknown Tool';
        const toName = toTool ? getToolDefinition(toTool.type)?.name || 'Unknown Tool' : 'Unknown Tool';
        
        showNotification(
          `Cannot connect "${fromName}" to "${toName}" - this would create a circular loop in your workflow. Workflows must flow in one direction to prevent infinite loops.`,
          'error'
        );
        
        // Visual feedback - briefly highlight the rejected connection in red
        const tempEdge = {
          id: 'temp-rejected',
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          style: { stroke: '#ef4444', strokeWidth: 3, strokeDasharray: '5,5' },
          animated: true,
          type: 'default'
        };
        
        // Show rejected connection briefly
        setEdges(prev => [...prev, tempEdge]);
        setTimeout(() => {
          setEdges(prev => prev.filter(edge => edge.id !== 'temp-rejected'));
        }, 2000);
        
        return;
      }
      
      onAddWire(
        { tool: connection.source, socket: fromSocket },
        { tool: connection.target, socket: toSocket }
      );
    }
  }, [onAddWire, tools, wires, setEdges, showNotification]);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach((edge) => {
      onRemoveWire(edge.id);
    });
  }, [onRemoveWire]);

  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    nodesToDelete.forEach((node) => {
      onRemoveTool(node.id);
    });
  }, [onRemoveTool]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Find the tool that corresponds to this node
    const tool = tools.find(t => t.id === node.id);
    if (tool && onToolSelect) {
      onToolSelect(tool);
    }
    
    // Ensure the node is selected in React Flow for deletion
    setNodes((nodes) =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === node.id,
      }))
    );
  }, [tools, onToolSelect, setNodes]);

  const onPaneClick = useCallback(() => {
    // Deselect tool when clicking on empty canvas
    if (onToolSelect) {
      onToolSelect(null);
    }
    
    // Clear React Flow selection
    setNodes((nodes) =>
      nodes.map((n) => ({
        ...n,
        selected: false,
      }))
    );
  }, [onToolSelect, setNodes]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const toolType = event.dataTransfer.getData('application/reactflow');
    if (!toolType) return;

    // Convert screen coordinates to flow coordinates (accounts for zoom/pan)
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    // Center the tool at the drop position
    const toolSize = 100; // Square tools are 100x100
    const centeredPosition = {
      x: position.x - (toolSize / 2),
      y: position.y - (toolSize / 2),
    };

    onAddTool(toolType, centeredPosition.x, centeredPosition.y);
  }, [onAddTool, screenToFlowPosition]);

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
      <style>{`
        .react-flow__edge.selected {
          stroke: #ef4444 !important;
          stroke-width: 3px !important;
        }
        .react-flow__edge.selected .react-flow__edge-path {
          stroke: #ef4444 !important;
          stroke-width: 3px !important;
        }
        .react-flow__edge:hover {
          stroke: #7c3aed !important;
          stroke-width: 3px !important;
        }
        .react-flow__edge:hover .react-flow__edge-path {
          stroke: #7c3aed !important;
          stroke-width: 3px !important;
        }
      `}</style>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode={['Meta', 'Ctrl']}
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
      
      {/* Notification System */}
      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
        duration={6000}
      />
    </div>
  );
}
