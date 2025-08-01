import React, { useRef, useState, useCallback } from 'react';
import { Tool, Wire, ConnectionState } from '../types/workflow';
import { getToolDefinition } from '../data/tools';

interface CanvasProps {
  tools: Tool[];
  wires: Wire[];
  connectionState: ConnectionState;
  onAddTool: (toolType: string, x: number, y: number) => void;
  onAddWire: (from: { tool: string; socket: number }, to: { tool: string; socket: number }) => void;
  onConnectionStateChange: (state: ConnectionState) => void;
  onToolMove: (toolId: string, x: number, y: number) => void;
}

interface DraggedTool {
  id: string;
  offsetX: number;
  offsetY: number;
}

export default function Canvas({ 
  tools, 
  wires, 
  connectionState, 
  onAddTool, 
  onAddWire, 
  onConnectionStateChange,
  onToolMove 
}: CanvasProps) {
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
    e.stopPropagation();
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

  const handleSocketMouseDown = (e: React.MouseEvent, toolId: string, socketId: number, socketType: 'input' | 'output') => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Socket clicked:', { toolId, socketId, socketType, isConnecting: connectionState.isConnecting });

    if (socketType === 'output') {
      // Start connection from output
      console.log('Starting connection from output socket');
      onConnectionStateChange({
        isConnecting: true,
        startTool: toolId,
        startSocket: socketId,
        startSocketType: socketType,
        currentX: e.clientX,
        currentY: e.clientY
      });
    } else if (connectionState.isConnecting && connectionState.startSocketType === 'output') {
      // Complete connection to input
      console.log('Completing connection to input socket');
      onAddWire(
        { tool: connectionState.startTool!, socket: connectionState.startSocket! },
        { tool: toolId, socket: socketId }
      );
      onConnectionStateChange({ isConnecting: false });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (connectionState.isConnecting) {
      onConnectionStateChange({
        ...connectionState,
        currentX: e.clientX,
        currentY: e.clientY
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (connectionState.isConnecting) {
      // Cancel connection
      onConnectionStateChange({ isConnecting: false });
    }
  };

  const getSocketPosition = (tool: Tool, socketId: number) => {
    const definition = getToolDefinition(tool.type);
    if (!definition) return { x: 0, y: 0 };

    const socket = definition.sockets.find(s => s.id === socketId);
    if (!socket) return { x: 0, y: 0 };

    const toolWidth = 120;
    const toolHeight = 60;
    const socketSize = 24;

    if (socket.direction === 'input') {
      return {
        x: tool.x - socketSize / 2,
        y: tool.y + toolHeight / 2
      };
    } else {
      // For outputs, spread them vertically if there are multiple
      const outputSockets = definition.sockets.filter(s => s.direction === 'output');
      const outputIndex = outputSockets.findIndex(s => s.id === socketId);
      
      return {
        x: tool.x + toolWidth + socketSize / 2,
        y: tool.y + toolHeight / 2 + (outputIndex * 30) - ((outputSockets.length - 1) * 15)
      };
    }
  };

  return (
    <div className="flex-1 relative overflow-hidden">
      <div
        ref={canvasRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseMove={handleCanvasMouseMove}
        onClick={handleCanvasClick}
        className="w-full h-full bg-gray-50 relative"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      >
        {/* Render wires */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        >
          {wires.map((wire, index) => {
            const fromTool = tools.find(t => t.id === wire.from.tool);
            const toTool = tools.find(t => t.id === wire.to.tool);
            
            if (!fromTool || !toTool) return null;

            const fromPos = getSocketPosition(fromTool, wire.from.socket);
            const toPos = getSocketPosition(toTool, wire.to.socket);

            return (
              <line
                key={index}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="#4f46e5"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Render connection preview */}
          {connectionState.isConnecting && connectionState.startTool && connectionState.currentX && connectionState.currentY && canvasRef.current && (
            (() => {
              const startTool = tools.find(t => t.id === connectionState.startTool);
              if (!startTool) return null;
              
              const startPos = getSocketPosition(startTool, connectionState.startSocket!);
              const canvasRect = canvasRef.current.getBoundingClientRect();
              const endX = connectionState.currentX - canvasRect.left;
              const endY = connectionState.currentY - canvasRect.top;

              return (
                <line
                  x1={startPos.x}
                  y1={startPos.y}
                  x2={endX}
                  y2={endY}
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeDasharray="8,4"
                  opacity="0.8"
                />
              );
            })()
          )}
          
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
                fill="#4f46e5"
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
              {/* Tool content */}
              <div 
                onMouseDown={(e) => handleToolMouseDown(e, tool.id)}
                className="flex items-center justify-center h-full pointer-events-auto"
              >
                <div className="text-center">
                  <div className="text-xl mb-1">{definition.icon}</div>
                  <div className="text-xs font-medium text-gray-700">
                    {definition.name}
                  </div>
                </div>
              </div>

              {/* Input sockets */}
              {definition.sockets
                .filter(socket => socket.direction === 'input')
                .map(socket => (
                  <div
                    key={`input-${socket.id}`}
                    onMouseDown={(e) => handleSocketMouseDown(e, tool.id, socket.id, 'input')}
                    className={`
                      absolute flex items-center justify-center bg-blue-500 rounded cursor-pointer 
                      hover:bg-blue-600 pointer-events-auto border-2 border-white shadow-lg 
                      transition-all hover:scale-110
                      ${connectionState.isConnecting && connectionState.startSocketType === 'output'
                        ? 'ring-4 ring-yellow-400 ring-opacity-75 scale-110 hover:scale-125 animate-pulse hover:bg-blue-700'
                        : ''
                      }
                    `}
                    style={{
                      left: -12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '24px',
                      height: '24px',
                      zIndex: 5
                    }}
                    title={`Input ${socket.id}${socket.type ? ` (${socket.type})` : ''}`}
                  >
                    <div className="text-white text-xs font-bold">◀</div>
                  </div>
                ))}

              {/* Output sockets */}
              {definition.sockets
                .filter(socket => socket.direction === 'output')
                .map((socket, index) => (
                  <div
                    key={`output-${socket.id}`}
                    onMouseDown={(e) => handleSocketMouseDown(e, tool.id, socket.id, 'output')}
                    className="absolute flex items-center justify-center bg-green-500 rounded cursor-pointer hover:bg-green-600 pointer-events-auto border-2 border-white shadow-lg transition-all hover:scale-110"
                    style={{
                      right: -12,
                      top: `${50 + (index * 30) - 15}%`,
                      transform: 'translateY(-50%)',
                      width: '24px',
                      height: '24px',
                      zIndex: 5
                    }}
                    title={`Output ${socket.id}${socket.type ? ` (${socket.type})` : ''}`}
                  >
                    <div className="text-white text-xs font-bold">▶</div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
