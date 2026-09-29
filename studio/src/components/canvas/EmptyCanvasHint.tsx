interface EmptyCanvasHintProps {
  /** Number of tools on the active workflow. The hint shows only when zero. */
  toolCount: number;
}

/**
 * Subtle, non-interactive guidance shown over an empty canvas.
 */
export function EmptyCanvasHint({ toolCount }: EmptyCanvasHintProps) {
  if (toolCount > 0) return null;

  return (
    <div
      data-testid="empty-canvas-hint"
      className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none select-none"
    >
      <p className="max-w-xs px-4 text-sm text-center text-theme-text-tertiary">
        Drag a tool from the palette to start, or open a workflow (Ctrl+O)
      </p>
    </div>
  );
}
