import { useState, useCallback, useRef, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  className?: string;
}

export default function ResizablePanel({ 
  children, 
  defaultWidth, 
  minWidth, 
  maxWidth, 
  className = '' 
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = e.clientX;
    const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
    setWidth(constrainedWidth);
  }, [isResizing, minWidth, maxWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={panelRef}
      className={`relative ${className}`}
      style={{ width: `${width}px` }}
    >
      {children}
      
      {/* Resize Handle */}
      <div
        className={`absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-500 transition-colors border-r-2 border-transparent hover:border-blue-500 ${
          isResizing ? 'bg-blue-500 border-blue-500' : 'bg-gray-200'
        }`}
        onMouseDown={handleMouseDown}
        title="Drag to resize panel"
      >
        {/* Visual indicator */}
        <div className="absolute top-1/2 right-0.5 transform -translate-y-1/2 w-1 h-6 flex items-center justify-center">
          <div className="w-px h-4 bg-gray-400 rounded opacity-60"></div>
        </div>
      </div>
      
      {/* Resize overlay when resizing */}
      {isResizing && (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-10 pointer-events-none z-10">
          <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
            {width}px
          </div>
        </div>
      )}
    </div>
  );
}
