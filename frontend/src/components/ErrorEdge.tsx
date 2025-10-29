import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath, MarkerType } from '@xyflow/react';

// Custom error edge component for loop detection visualization
const ErrorEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: 'var(--color-edge-invalid-stroke)',
        strokeWidth: 2,
        strokeDasharray: '5,5',
      }}
      markerEnd={MarkerType.ArrowClosed}
    />
  );
};

export default ErrorEdge;
