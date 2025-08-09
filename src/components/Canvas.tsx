import React, { useCallback, useMemo, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { createPortal } from 'react-dom';
import { calculateMenuPosition } from '../utils/menuPositioning';
import {
  ReactFlow,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Controls,
  ControlButton,
  Background,
  BackgroundVariant,
  MarkerType,
  ConnectionLineType,
  PanOnScrollMode,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Tool, Wire } from '../types/workflow';
import { getToolDefinition } from '../data/tools';
import WorkflowNode from './WorkflowNode';
import { wouldCreateCycle } from '../utils/loopDetection';
import Notification from './Notification';
import { useTheme } from '../contexts/ThemeContext';

export interface CanvasRef {
  fitView: () => void;
}

interface CanvasProps {
  tools: Tool[];
  wires: Wire[];
  edges: Edge[]; // Pre-computed edges from EdgeManager
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

const Canvas = forwardRef<CanvasRef, CanvasProps>(({ 
  tools, 
  wires, 
  edges,
  onAddTool, 
  onAddWire, 
  onRemoveWire,
  onRemoveTool,
  onToolMove,
  onToolSelect
}, ref) => {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { currentTheme } = useTheme();
  
  // Snap to grid state
  const [snapToGrid, setSnapToGrid] = useState(true); // Default to enabled
  const snapGrid: [number, number] = [20, 20]; // Match the background grid size

  // Minimap toggle state
  const [showMinimap, setShowMinimap] = useState(false);
  const [minimapPosition, setMinimapPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [showPositionMenu, setShowPositionMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  
  // Ref for the minimap button to calculate menu position
  const minimapButtonRef = useRef<HTMLDivElement>(null);

  // Utility function to snap coordinates to grid
  const snapToGridCoords = (x: number, y: number): { x: number, y: number } => {
    if (!snapToGrid) return { x, y };
    
    return {
      x: Math.round(x / snapGrid[0]) * snapGrid[0],
      y: Math.round(y / snapGrid[1]) * snapGrid[1],
    };
  };

  // Function to get node color based on tool category for the minimap
  const getMinimapNodeColor = useCallback((node: Node) => {
    const tool = tools.find(t => t.id === node.id);
    if (!tool) return currentTheme.colors.canvas.minimap.viewport;
    
    const definition = getToolDefinition(tool.type);
    if (!definition) return currentTheme.colors.canvas.minimap.viewport;
    
    // Get the category color from the theme's tool colors
    switch (definition.category) {
      case 'inout':
        return currentTheme.colors.palette.tools.inout[500];
      case 'preparation':
        return currentTheme.colors.palette.tools.preparation[500];
      case 'join':
        return currentTheme.colors.palette.tools.join[500];
      case 'aggregate':
        return currentTheme.colors.palette.tools.aggregate[500];
      default:
        return currentTheme.colors.canvas.minimap.viewport;
    }
  }, [tools, currentTheme]);

  // Handle minimap position change
  const handlePositionChange = useCallback((position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    setMinimapPosition(position);
    setShowPositionMenu(false);
  }, []);

  // Handle minimap button context menu
    const handleMinimapButtonContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    
    if (minimapButtonRef.current && !showPositionMenu) {
      const rect = minimapButtonRef.current.getBoundingClientRect();
      
      // Use the reusable smart positioning utility - automatically avoids screen edges
      const position = calculateMenuPosition(
        rect,
        { width: 100, height: 160 }, // Menu dimensions - compact width for content
        4, // Offset
        'bottom' // Preferred placement
      );
      
      setMenuPosition({ x: position.x, y: position.y });
    }
    
    setShowPositionMenu(!showPositionMenu);
  }, [showPositionMenu]);

  // Calculate minimap offset to avoid overlapping with controls
  const getMinimapStyle = useCallback(() => {
    const baseStyle = {
      borderRadius: 6,
      boxShadow: 'var(--color-canvas-controls-shadow)',
      background: 'var(--color-canvas-minimap-bg)',
      border: '1px solid var(--color-canvas-minimap-border)',
      width: 180,
      height: 120,
    };

    // Controls are vertical, so we need horizontal offset
    // Controls are typically about 40px wide, so we offset by 50px to give some spacing
    const controlsOffset = 50;
    
    switch (minimapPosition) {
      case 'top-left':
        return { ...baseStyle, marginLeft: controlsOffset };
      case 'bottom-left':
        return { ...baseStyle, marginLeft: controlsOffset };
      case 'top-right':
        return { ...baseStyle, marginRight: controlsOffset };
      case 'bottom-right':
        return { ...baseStyle, marginRight: controlsOffset };
      default:
        return baseStyle;
    }
  }, [minimapPosition]);

  // Expose fitView function to parent component
  useImperativeHandle(ref, () => ({
    fitView: () => {
      fitView({ duration: 800, padding: 0.1 });
    }
  }), [fitView]);
  
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

  // Sync edges prop with React Flow edges state
  React.useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && connection.sourceHandle && connection.targetHandle) {
      // Extract socket IDs from handles
      const fromSocket = parseInt(connection.sourceHandle.replace('output-', ''));
      const toSocket = parseInt(connection.targetHandle.replace('input-', ''));
      
      // Check if this connection would create a cycle
      const wouldLoop = wouldCreateCycle(tools, wires, connection.source, connection.target);
      
      if (wouldLoop) {
        // Get tool names for better user feedback
        const fromTool = tools.find(t => t.id === connection.source);
        const toTool = tools.find(t => t.id === connection.target);
        const fromName = fromTool ? getToolDefinition(fromTool.type)?.name || 'Unknown Tool' : 'Unknown Tool';
        const toName = toTool ? getToolDefinition(toTool.type)?.name || 'Unknown Tool' : 'Unknown Tool';
        
        showNotification(
          `Connection "${fromName}" to "${toName}" creates a loop - displayed in red. Remove to fix workflow.`,
          'warning'
        );
        
        // Create the wire temporarily, then remove it after 3 seconds
        const tempWire = { tool: connection.source, socket: fromSocket };
        const tempTarget = { tool: connection.target, socket: toSocket };
        
        onAddWire(tempWire, tempTarget);
        
        // Auto-remove the error connection after 3 seconds
        setTimeout(() => {
          // Create the edge ID to remove
          const edgeId = `${encodeURIComponent(connection.source)}_${fromSocket}_${encodeURIComponent(connection.target)}_${toSocket}`;
          onRemoveWire(edgeId);
        }, 3000);
      } else {
        // Normal connection - create normally
        onAddWire(
          { tool: connection.source, socket: fromSocket },
          { tool: connection.target, socket: toSocket }
        );
      }
    }
  }, [onAddWire, onRemoveWire, tools, wires, showNotification]);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach((edge) => {
      onRemoveWire(edge.id);
    });
  }, [onRemoveWire]);

  const onNodesDelete = useCallback((nodesToDelete: Node[]) => {
    nodesToDelete.forEach((node) => {
      onRemoveTool(node.id);
    });
    // Clear selected tool and return to workflow configuration
    if (onToolSelect) {
      onToolSelect(null);
    }
  }, [onRemoveTool, onToolSelect]);

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
    // Close position menu when clicking elsewhere
    setShowPositionMenu(false);
    
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

    // Apply snap to grid if enabled
    const snappedPosition = snapToGridCoords(centeredPosition.x, centeredPosition.y);

    onAddTool(toolType, snappedPosition.x, snappedPosition.y);
  }, [onAddTool, screenToFlowPosition, snapToGridCoords]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDragStop = useCallback((_event: React.MouseEvent | React.TouchEvent, node: Node) => {
    // Apply snap to grid if enabled
    const snappedPosition = snapToGridCoords(node.position.x, node.position.y);
    
    // Update the tool position with snapped coordinates
    onToolMove(node.id, snappedPosition.x, snappedPosition.y);
  }, [onToolMove, snapToGridCoords]);

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
    <div className="flex-1 h-full relative">
      <style>{`
        /* React Flow Node Selection Override - Remove purple selection */
        .react-flow__node.selected {
          outline: none !important;
          box-shadow: none !important;
        }
        .react-flow__node.selected .react-flow__node-default {
          outline: none !important;
          box-shadow: none !important;
        }
        .react-flow__node.dragging {
          opacity: 0.8 !important;
        }
        
        /* Hide React Flow attribution */
        .react-flow__attribution {
          display: none !important;
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
          style: { 
            stroke: 'var(--color-edge-default-stroke)', 
            strokeWidth: 2,
          },
          markerEnd: { 
            type: MarkerType.ArrowClosed, 
            color: 'var(--color-edge-default-stroke)' 
          },
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
        snapToGrid={snapToGrid}
        snapGrid={snapGrid}
        fitView
        className="bg-theme-surface-canvas"
      >
        <Controls showInteractive={false} position={minimapPosition}>
          {/* Minimap toggle button with position menu */}
          <div ref={minimapButtonRef}>
            <ControlButton
              onClick={() => setShowMinimap((v) => !v)}
              onContextMenu={handleMinimapButtonContextMenu}
              title={showMinimap ? 'Hide minimap (Right-click for position)' : 'Show minimap (Right-click for position)'}
              style={{
                backgroundColor: showMinimap ? 'var(--color-canvas-controls-btn-bg-active)' : undefined,
                color: showMinimap ? 'var(--color-canvas-controls-btn-text-active)' : undefined,
              }}
            >
              {/* Minimap icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/>
                <rect x="7" y="7" width="4" height="4" fill="currentColor"/>
                <rect x="13" y="13" width="4" height="4" fill="currentColor"/>
              </svg>
            </ControlButton>
          </div>
          {/* Snap to grid button */}
          <ControlButton
            onClick={() => setSnapToGrid(!snapToGrid)}
            title={snapToGrid ? 'Disable snap to grid' : 'Enable snap to grid'}
            style={{
              backgroundColor: snapToGrid ? 'var(--color-canvas-controls-btn-bg-active)' : undefined,
              color: snapToGrid ? 'var(--color-canvas-controls-btn-text-active)' : undefined,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h2v2H3V3zm4 0h2v2H7V3zm4 0h2v2h-2V3zm4 0h2v2h-2V3zm4 0h2v2h-2V3zM3 7h2v2H3V7zm4 0h2v2H7V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zM3 11h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM3 15h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM3 19h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
            </svg>
          </ControlButton>
        </Controls>
        {/* MiniMap component, conditionally rendered */}
        {showMinimap && (
          <MiniMap
            position={minimapPosition}
            nodeColor={getMinimapNodeColor}
            maskColor="var(--color-canvas-minimap-mask)"
            style={getMinimapStyle()}
            pannable
            zoomable
          />
        )}
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={snapGrid[0]} 
          size={snapToGrid ? 2 : 1}
          color={snapToGrid ? 'var(--color-canvas-grid-primary)' : 'var(--color-canvas-grid-secondary)'}
        />
      </ReactFlow>
      
      {/* Notification System */}
      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
        duration={6000}
      />

      {/* Position selection menu portal */}
      {showPositionMenu && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${menuPosition.x}px`,
            top: `${menuPosition.y}px`,
            background: 'var(--color-canvas-controls-bg)',
            border: '1px solid var(--color-canvas-controls-border)',
            borderRadius: '6px',
            boxShadow: 'var(--color-canvas-controls-shadow)',
            zIndex: 10000,
            width: '100px', // Fixed width to fit content better
            overflow: 'hidden',
          }}
        >
          {[
            { value: 'top-left', label: 'Top Left' },
            { value: 'top-right', label: 'Top Right' },
            { value: 'bottom-left', label: 'Bottom Left' },
            { value: 'bottom-right', label: 'Bottom Right' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handlePositionChange(option.value as any)}
              style={{
                width: '100%',
                padding: '6px 8px', // Reduced padding for more compact feel
                border: 'none',
                background: minimapPosition === option.value 
                  ? 'var(--color-canvas-controls-btn-bg-active)' 
                  : 'transparent',
                color: minimapPosition === option.value 
                  ? 'var(--color-canvas-controls-btn-text-active)' 
                  : 'var(--color-canvas-controls-btn-text)',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'background-color 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (minimapPosition !== option.value) {
                  e.currentTarget.style.background = 'var(--color-canvas-controls-btn-bg-hover)';
                  e.currentTarget.style.color = 'var(--color-canvas-controls-btn-text-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (minimapPosition !== option.value) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-canvas-controls-btn-text)';
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;
