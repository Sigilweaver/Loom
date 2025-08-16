import React, { useCallback } from 'react';

interface Props {
  onAddTool: (type: string, x: number, y: number, idOverride?: string) => void;
  snap: (x: number, y: number) => { x: number; y: number };
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number };
  children: React.ReactNode;
}

export const CanvasDragAndDropLayer: React.FC<Props> = ({ onAddTool, snap, screenToFlowPosition, children }) => {
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

  return (
    <div className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
      {children}
    </div>
  );
};
