import React from 'react';
import { createPortal } from 'react-dom';

export interface ActionItem {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}

interface Props {
  open: boolean;
  coords: { x: number; y: number } | null;
  items: ActionItem[];
  onClose: () => void;
}

export const CanvasActionMenu: React.FC<Props> = ({ open, coords, items, onClose }) => {
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('contextmenu', handlePointerDown, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('contextmenu', handlePointerDown, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open || !coords || !items || items.length === 0) return null;
  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: coords.x,
        top: coords.y,
        background: 'var(--color-canvas-controls-bg)',
        border: '1px solid var(--color-canvas-controls-border)',
        borderRadius: 6,
        boxShadow: 'var(--color-canvas-controls-shadow)',
        zIndex: 10000,
        width: 140,
        overflow: 'hidden',
      }}
      onMouseLeave={onClose}
    >
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => { if (!it.disabled) { it.onClick(); } onClose(); }}
          disabled={it.disabled}
          onMouseEnter={() => setHoveredKey(it.key)}
          onMouseLeave={() => setHoveredKey(prev => (prev === it.key ? null : prev))}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: 'none',
            background: 'transparent',
            color: it.disabled ? 'var(--color-muted-7)' : 'var(--color-canvas-controls-btn-text)',
            textAlign: 'left',
            cursor: it.disabled ? 'not-allowed' : 'pointer',
            fontSize: 13,
            opacity: it.disabled ? 0.6 : 1,
          }}
        >
          <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>{it.label}</span>
            {it.hint ? (
              <span style={{ opacity: hoveredKey === it.key ? 0.75 : 0, transition: 'opacity 120ms', fontSize: 12, color: 'var(--color-muted-7)' }}>
                {it.hint}
              </span>
            ) : null}
          </div>
        </button>
      ))}
    </div>,
    document.body
  );
};
