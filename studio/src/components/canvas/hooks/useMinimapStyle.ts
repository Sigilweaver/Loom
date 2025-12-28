import { useCallback } from 'react';

export function useMinimapStyle(position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') {
  return useCallback(() => {
    const base: React.CSSProperties = {
      borderRadius: 6,
      boxShadow: 'var(--color-canvas-controls-shadow)',
      background: 'var(--color-canvas-minimap-bg)',
      border: '1px solid var(--color-canvas-minimap-border)',
      width: 180,
      height: 120,
    };
    const offset = 50;
    switch (position) {
      case 'top-left':
      case 'bottom-left':
        return { ...base, marginLeft: offset };
      case 'top-right':
      case 'bottom-right':
        return { ...base, marginRight: offset };
      default:
        return base;
    }
  }, [position]);
}
