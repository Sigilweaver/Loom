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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = e.clientX;
    const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
    setWidth(constrainedWidth);
  }, [isResizing, minWidth, maxWidth]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isResizing) return;

    const touch = e.touches[0];
    if (touch) {
      const newWidth = touch.clientX;
      const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      setWidth(constrainedWidth);
    }
  }, [isResizing, minWidth, maxWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={panelRef}
      className={`relative ${className}`}
      style={{ width: `${width}px` }}
    >
      {children}
      
      {/* Resize Handle */}
      <div
        className={`absolute top-0 right-0 w-2 h-full cursor-col-resize transition-colors border-r-2 border-transparent hover:border-theme-border-primary ${
          isResizing ? 'border-theme-border-primary' : 'border-theme-border-secondary'
        }`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        title="Drag to resize panel"
      >
        {/* Visual indicator */}
        <div className="absolute top-1/2 right-0.5 transform -translate-y-1/2 w-1 h-6 flex items-center justify-center">
          <div className="w-px h-4 bg-theme-border-primary rounded opacity-60"></div>
        </div>
      </div>

    </div>
  );
}
