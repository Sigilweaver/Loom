import React from 'react';
import { MiniMap, type Node } from '@xyflow/react';

interface Props {
  visible: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  nodeColor: (n: Node) => string;
  style: React.CSSProperties;
}

export const CanvasMinimap: React.FC<Props> = ({ visible, position, nodeColor, style }) => visible ? (
  <MiniMap
    position={position}
    nodeColor={nodeColor}
    maskColor="var(--color-canvas-minimap-mask)"
    style={style}
    pannable
    zoomable
  />
) : null;
