import React from 'react';
import { ReactFlow, Background, BackgroundVariant, ConnectionLineType, PanOnScrollMode, type Node, type Edge, type NodeChange, type EdgeChange, type OnConnect, type OnEdgesDelete, type OnNodesDelete, type NodeTypes, type Viewport } from '@xyflow/react';
import { useSettingsStore } from '../../state/settingsStore';
import CanvasComments from './CanvasComments';

interface Props {
  nodes: Node[];
  edges: Edge[];
  snapToGrid: boolean;
  snapGrid: [number, number];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodesDelete: OnNodesDelete;
  onEdgesDelete: OnEdgesDelete;
  onConnect: OnConnect;
  onConnectStart?: (event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType: 'source' | 'target' | null }) => void;
  onConnectEnd?: (event: MouseEvent | TouchEvent) => void;
  onNodeClick: (e: React.MouseEvent, node: Node) => void;
  onNodeContextMenu?: (e: MouseEvent | React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onEdgeContextMenu?: (e: React.MouseEvent, edge: Edge) => void;
  onPaneContextMenu?: (e: MouseEvent | React.MouseEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onNodeDragStart?: (e: React.MouseEvent, node: Node) => void;
  onNodeDragStop: (e: React.MouseEvent, node: Node) => void;
  onWheel: (e: React.WheelEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMove?: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => void;
  nodeTypes: NodeTypes;
  onSelectionChange?: (sel: { nodes: Node[]; edges: Edge[] }) => void;
  children?: React.ReactNode;
}

// Map settings edge style to xyflow ConnectionLineType enum
const getConnectionLineType = (style: string): ConnectionLineType => {
  switch (style) {
    case 'straight': return ConnectionLineType.Straight;
    case 'step': return ConnectionLineType.Step;
    case 'smoothstep': return ConnectionLineType.SmoothStep;
    case 'bezier':
    default: return ConnectionLineType.Bezier;
  }
};

export const CanvasSurface: React.FC<Props> = ({ nodes, edges, snapToGrid, snapGrid, nodeTypes, children, onSelectionChange, ...handlers }) => {
  const edgeStyle = useSettingsStore((s) => s.ui.edgeStyle);
  const connectionLineType = getConnectionLineType(edgeStyle);
  // Map settings value to xyflow edge type: bezier -> 'default', others map 1:1
  const edgeType = edgeStyle === 'bezier' ? 'default' : edgeStyle;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
    onEdgeContextMenu={handlers.onEdgeContextMenu ?? (() => {})}
      connectionLineType={connectionLineType}
      defaultEdgeOptions={{
        type: edgeType,
      }}
    deleteKeyCode={['Delete', 'Backback']}
    multiSelectionKeyCode={['Meta', 'Control']}
      panOnScroll
      panOnScrollMode={PanOnScrollMode.Free}
      panOnScrollSpeed={0.8}
      zoomOnScroll
      zoomOnPinch
      zoomActivationKeyCode="ControlLeft"
    panOnDrag={[2]}
    selectNodesOnDrag
    selectionOnDrag
      snapToGrid={snapToGrid}
      snapGrid={snapGrid}
      fitView
    className="bg-theme-surface-canvas"
    {...(onSelectionChange ? { onSelectionChange } : {})}
      {...handlers}
    >
      {children}
      <CanvasComments />
      <Background
        variant={BackgroundVariant.Dots}
        gap={snapGrid[0]}
        size={snapToGrid ? 2 : 1}
        color={snapToGrid ? 'var(--color-canvas-grid-primary)' : 'var(--color-canvas-grid-secondary)'}
      />
    </ReactFlow>
  );
};
