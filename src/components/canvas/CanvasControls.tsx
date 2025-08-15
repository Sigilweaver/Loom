import React from 'react';
import { Controls, ControlButton } from '@xyflow/react';

interface Props {
  minimapVisible: boolean;
  minimapPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  snapToGrid: boolean;
  onToggleMinimap: () => void;
  onToggleSnap: () => void;
  onContextMenuMinimap: (e: React.MouseEvent) => void;
  minimapButtonRef: React.RefObject<HTMLDivElement>;
  children?: React.ReactNode;
}

export const CanvasControls: React.FC<Props> = ({ minimapVisible, minimapPosition, snapToGrid, onToggleMinimap, onToggleSnap, onContextMenuMinimap, minimapButtonRef, children }) => (
  <Controls showInteractive={false} position={minimapPosition}>
    <div ref={minimapButtonRef}>
      <ControlButton
        onClick={onToggleMinimap}
        onContextMenu={onContextMenuMinimap}
        title={minimapVisible ? 'Hide minimap (Right-click for position)' : 'Show minimap (Right-click for position)'}
        style={{
          backgroundColor: minimapVisible ? 'var(--color-canvas-controls-btn-bg-active)' : undefined,
          color: minimapVisible ? 'var(--color-canvas-controls-btn-text-active)' : undefined,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="7" y="7" width="4" height="4" fill="currentColor" />
          <rect x="13" y="13" width="4" height="4" fill="currentColor" />
        </svg>
      </ControlButton>
    </div>
    <ControlButton
      onClick={onToggleSnap}
      title={snapToGrid ? 'Disable snap to grid' : 'Enable snap to grid'}
      style={{
        backgroundColor: snapToGrid ? 'var(--color-canvas-controls-btn-bg-active)' : undefined,
        color: snapToGrid ? 'var(--color-canvas-controls-btn-text-active)' : undefined,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 3h2v2H3V3zm4 0h2v2H7V3zm4 0h2v2h-2V3zm4 0h2v2h-2V3zm4 0h2v2h-2V3zM3 7h2v2H3V7zm4 0h2v2H7V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zM3 11h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM3 15h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM3 19h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" />
      </svg>
    </ControlButton>
    {children}
  </Controls>
);
