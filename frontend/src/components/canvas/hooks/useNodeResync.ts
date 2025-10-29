import { useEffect, useRef } from 'react';
import type { Node } from '@xyflow/react';

/**
 * Guarded, diff-aware node resync to avoid selection flicker during drags/lasso.
 * Returns a ref you can flip true/false on pointer down/up.
 */
export function useNodeResync(nodes: Node[], setNodes: (updater: (curr: Node[]) => Node[]) => void) {
  const isPointerDownRef = useRef(false);

  useEffect(() => {
    setNodes(curr => {
      if (isPointerDownRef.current) return curr;
      const sel = new Map(curr.map(n => [n.id, n.selected]));
      const currMap = new Map(curr.map(n => [n.id, n]));
      const next = nodes.map(n => {
        const prev = currMap.get(n.id);
        if (prev) {
          const selected = sel.get(n.id) || false;
          const samePos = prev.position.x === n.position.x && prev.position.y === n.position.y;
          const sameType = prev.type === n.type;
          return (samePos && sameType) ? { ...prev, data: n.data, selected } : { ...n, selected };
        }
        return { ...n, selected: false };
      });
      return next;
    });
  }, [nodes, setNodes]);

  return isPointerDownRef;
}
