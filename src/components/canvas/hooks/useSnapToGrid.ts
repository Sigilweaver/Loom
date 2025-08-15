import { useCallback } from 'react';
import { useUIStore } from '@state/uiStore';

export function useSnapToGrid(grid: [number, number]) {
  const snapToGrid = useUIStore(s => s.snapToGrid);
  const toggleSnapToGrid = useUIStore(s => s.toggleSnapToGrid);
  const snap = useCallback((x: number, y: number) => {
    if (!snapToGrid) return { x, y };
    return { x: Math.round(x / grid[0]) * grid[0], y: Math.round(y / grid[1]) * grid[1] };
  }, [snapToGrid, grid]);
  return { snapToGrid, toggleSnapToGrid, snap };
}
