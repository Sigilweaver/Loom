/**
 * AutoConnectPreviewEdge
 *
 * Renders a dashed preview wire on the canvas while the user drags a tool
 * from the palette.  It shows which existing tool/socket would be
 * auto-connected on drop.
 *
 * Rendered as a child of <ReactFlow> in the panel layer (screen space),
 * so flow coordinates must be transformed by the viewport.
 */

import React from 'react';
import { useAutoConnectPreviewStore } from '@state/autoConnectPreviewStore';
import { useViewport } from '@xyflow/react';

const AutoConnectPreviewEdge: React.FC = () => {
  const preview = useAutoConnectPreviewStore((s) => s.preview);
  const { x: vpX, y: vpY, zoom } = useViewport();

  if (!preview) return null;

  const { sourceX, sourceY, targetX, targetY } = preview;

  // Transform flow coordinates to screen-space SVG coordinates
  const sx = sourceX * zoom + vpX;
  const sy = sourceY * zoom + vpY;
  const tx = targetX * zoom + vpX;
  const ty = targetY * zoom + vpY;

  // Bezier control points — horizontal offset for a natural curve
  const dx = Math.abs(tx - sx) * 0.5;
  const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;

  return (
    <svg
      className="pointer-events-none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      <path
        d={path}
        fill="none"
        stroke="var(--color-edge-default-stroke, #94a3b8)"
        strokeWidth={2}
        strokeDasharray="6 4"
        opacity={0.6}
      />
      {/* Small dot at the source socket */}
      <circle
        cx={sx}
        cy={sy}
        r={4}
        fill="var(--color-edge-default-stroke, #94a3b8)"
        opacity={0.6}
      />
    </svg>
  );
};

export default AutoConnectPreviewEdge;
