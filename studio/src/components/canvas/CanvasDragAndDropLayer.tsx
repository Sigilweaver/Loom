import React, { useCallback, useEffect, useRef } from 'react';
import { TOOL_TOUCH_DROP_EVENT, type ToolTouchDropDetail } from '@components/shell/ToolPalette';

interface Props {
  onAddTool: (type: string, x: number, y: number, idOverride?: string) => void;
  snap: (x: number, y: number) => { x: number; y: number };
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number };
  children: React.ReactNode;
}

export const CanvasDragAndDropLayer: React.FC<Props> = ({ onAddTool, snap, screenToFlowPosition, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const toolType = event.dataTransfer.getData('application/reactflow');
    if (!toolType) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const size = 100;
    const centered = { x: position.x - size / 2, y: position.y - size / 2 };
    const snapped = snap(centered.x, centered.y);
    onAddTool(toolType, snapped.x, snapped.y);
  }, [onAddTool, snap, screenToFlowPosition]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle touch drop events from ToolPalette
  useEffect(() => {
    const handleTouchDrop = (event: Event) => {
      const customEvent = event as CustomEvent<ToolTouchDropDetail>;
      const { toolType, clientX, clientY } = customEvent.detail;

      // Check if the drop is within the canvas area
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return; // Drop outside canvas, ignore
      }

      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const size = 100;
      const centered = { x: position.x - size / 2, y: position.y - size / 2 };
      const snapped = snap(centered.x, centered.y);
      onAddTool(toolType, snapped.x, snapped.y);
    };

    document.addEventListener(TOOL_TOUCH_DROP_EVENT, handleTouchDrop);
    return () => {
      document.removeEventListener(TOOL_TOUCH_DROP_EVENT, handleTouchDrop);
    };
  }, [onAddTool, snap, screenToFlowPosition]);

  return (
    <div ref={containerRef} className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
      {children}
    </div>
  );
};
