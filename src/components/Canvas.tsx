import React, { useRef, useState } from 'react';
import { Tool, Edge } from '../types/workflow';
import { getToolDefinition } from '../data/tools';

interface CanvasProps {
  tools: Tool[];
  edges: Edge[];
  onAddTool: (toolType: string, x: number, y: number) => void;
  onAddEdge: (from: { tool: string; port: number }, to: { tool: string; port: number }) => void;
  onToolMove: (toolId: string, x: number, y: number) => void;
}

interface DraggedTool {
  id: string;
  offsetX: number;
  offsetY: number;
}

export default function Canvas({ tools, edges, onAddTool, onAddEdge, onToolMove }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedTool, setDraggedTool] = useState<DraggedTool | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const toolType = e.dataTransfer.getData('text/plain');
    
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      onAddTool(toolType, x, y);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleToolMouseDown = (e: React.MouseEvent, toolId: string) => {
    e.preventDefault();
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDraggedTool({ id: toolId, offsetX, offsetY });

    const handleMouseMove = (e: MouseEvent) => {
      if (canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const newX = e.clientX - canvasRect.left - offsetX;
        const newY = e.clientY - canvasRect.top - offsetY;
        onToolMove(toolId, newX, newY);
      }
    };

    const handleMouseUp = () => {
      setDraggedTool(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex-1 relative overflow-hidden">
      <div
        ref={canvasRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="w-full h-full bg-gray-50 relative"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      >
        {/* Render edges */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        >
          {edges.map((edge, index) => {
            const fromTool = tools.find(t => t.id === edge.from.tool);
            const toTool = tools.find(t => t.id === edge.to.tool);
            
            if (!fromTool || !toTool) return null;

            return (
              <line
                key={index}
                x1={fromTool.x + 60}
                y1={fromTool.y + 30}
                x2={toTool.x}
                y2={toTool.y + 30}
                stroke="#6b7280"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
          
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6b7280"
              />
            </marker>
          </defs>
        </svg>

        {/* Render tools */}
        {tools.map((tool) => {
          const definition = getToolDefinition(tool.type);
          if (!definition) return null;

          return (
            <div
              key={tool.id}
              onMouseDown={(e) => handleToolMouseDown(e, tool.id)}
              className={`absolute cursor-move select-none border-2 rounded-lg p-3 bg-white shadow-lg transition-transform hover:scale-105 ${
                draggedTool?.id === tool.id ? 'scale-105 shadow-xl' : ''
              }`}
              style={{
                left: tool.x,
                top: tool.y,
                width: '120px',
                height: '60px',
                borderColor: 
                  definition.category === 'inout' ? '#10b981' :
                  definition.category === 'preparation' ? '#3b82f6' :
                  definition.category === 'join' ? '#8b5cf6' : '#6b7280',
                zIndex: draggedTool?.id === tool.id ? 10 : 2
              }}
            >
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-xl mb-1">{definition.icon}</div>
                  <div className="text-xs font-medium text-gray-700">
                    {definition.name}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
