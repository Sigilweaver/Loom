import React from 'react';
import { ReactFlow, Background, BackgroundVariant, ConnectionLineType, MarkerType, PanOnScrollMode, type Node, type Edge, type NodeChange, type EdgeChange, type OnConnect, type OnEdgesDelete, type OnNodesDelete, type NodeTypes } from '@xyflow/react';

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
  onNodeClick: (e: React.MouseEvent, node: Node) => void;
  onNodeContextMenu?: (e: MouseEvent | React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onPaneContextMenu?: (e: MouseEvent | React.MouseEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onNodeDragStart?: (e: React.MouseEvent, node: Node) => void;
  onNodeDragStop: (e: React.MouseEvent, node: Node) => void;
  onWheel: (e: React.WheelEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  nodeTypes: NodeTypes;
  onSelectionChange?: (sel: { nodes: Node[]; edges: Edge[] }) => void;
  children?: React.ReactNode;
}

export const CanvasSurface: React.FC<Props> = ({ nodes, edges, snapToGrid, snapGrid, nodeTypes, children, onSelectionChange, ...handlers }) => (
  <ReactFlow
    nodes={nodes}
    edges={edges}
    nodeTypes={nodeTypes}
    connectionLineType={ConnectionLineType.Bezier}
    defaultEdgeOptions={{
      type: 'default',
      markerEnd: { type: MarkerType.ArrowClosed, color: 'currentColor' },
    }}
  deleteKeyCode={['Delete', 'Backspace']}
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
    <Background
      variant={BackgroundVariant.Dots}
      gap={snapGrid[0]}
      size={snapToGrid ? 2 : 1}
      color={snapToGrid ? 'var(--color-canvas-grid-primary)' : 'var(--color-canvas-grid-secondary)'}
    />
  </ReactFlow>
);
