import { useCallback } from 'react';
import type { Node } from '@xyflow/react';

export interface UseArrowKeyMovementParams {
  getNodes: () => Node[];
  snap: (x: number, y: number) => { x: number; y: number };
  onToolMove: (id: string, x: number, y: number) => void;
  onBeginTransaction?: (() => void) | undefined;
  onCommitTransaction?: (() => void) | undefined;
  gridSize?: [number, number];
}

/**
 * Hook for handling arrow key movement of selected nodes
 * Moves nodes by grid increments, with larger steps when Shift is held
 */
export function useArrowKeyMovement({
  getNodes,
  snap,
  onToolMove,
  onBeginTransaction,
  onCommitTransaction,
  gridSize = [20, 20]
}: UseArrowKeyMovementParams) {
  return useCallback((e: React.KeyboardEvent) => {
    const { key, shiftKey } = e;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return false;
    
    const selectedNodes = getNodes().filter(n => n.selected);
    if (selectedNodes.length === 0) return false;
    
    e.preventDefault();
    
    // Movement distance: 1 grid unit normal, 5 grid units with Shift
    const multiplier = shiftKey ? 5 : 1;
    const [gridX, gridY] = gridSize;
    
    const deltaX = key === 'ArrowLeft' ? -gridX * multiplier : 
                  key === 'ArrowRight' ? gridX * multiplier : 0;
    const deltaY = key === 'ArrowUp' ? -gridY * multiplier : 
                  key === 'ArrowDown' ? gridY * multiplier : 0;
    
    // Apply movement to all selected nodes as a group
    onBeginTransaction?.();
    selectedNodes.forEach(node => {
      const newX = node.position.x + deltaX;
      const newY = node.position.y + deltaY;
      const snapped = snap(newX, newY);
      onToolMove(node.id, snapped.x, snapped.y);
    });
    onCommitTransaction?.();
    
    return true; // Event was handled
  }, [getNodes, snap, onToolMove, onBeginTransaction, onCommitTransaction, gridSize]);
}
