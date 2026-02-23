import { useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Tool, ToolDefinition, Socket } from '@domain/workflow/entities/workflow';
import { useSocketPreview } from '@hooks/useSocketPreview';
import { useSocketProfile } from '@hooks/useSocketProfile';

interface SocketContextMenu {
  x: number;
  y: number;
  socketId: string;
  direction: 'input' | 'output';
}

interface WorkflowNodeProps {
  data: {
    tool: Tool;
    definition: ToolDefinition;
    onToolMove: (toolId: string, x: number, y: number) => void;
  };
}

export default function WorkflowNode({ data }: WorkflowNodeProps) {
  const { definition, tool } = data;
  const { previewSocket } = useSocketPreview();
  const { profileSocket } = useSocketProfile();
  const [contextMenu, setContextMenu] = useState<SocketContextMenu | null>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  const handleSocketContextMenu = useCallback((
    e: React.MouseEvent,
    socketId: string,
    direction: 'input' | 'output'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      socketId,
      direction,
    });
  }, []);

  const handlePreviewData = useCallback(() => {
    if (contextMenu) {
      previewSocket(tool.id, contextMenu.socketId, contextMenu.direction);
      setContextMenu(null);
    }
  }, [contextMenu, previewSocket, tool.id]);

  const handleProfileData = useCallback(() => {
    if (contextMenu) {
      profileSocket(tool.id, contextMenu.socketId, contextMenu.direction);
      setContextMenu(null);
    }
  }, [contextMenu, profileSocket, tool.id]);

  const inputSockets = definition.sockets.filter((socket: Socket) => socket.direction === 'input');
  const outputSockets = definition.sockets.filter((socket: Socket) => socket.direction === 'output');

  // Node dimensions - single source of truth
  const nodeSize = 60; // Tool width/height in pixels
  const center = nodeSize / 2; // 30px
  const socketSize = 14; // Socket diameter in pixels
  const socketOffset = -(socketSize / 2 + 3); // Position socket center outside node edge

  // Calculate socket positions - spacing from center for uniformity with grid
  const getSocketPosition = (index: number, total: number): string => {
    const spacing = 18; // Spacing between sockets
    
    if (total === 1) {
      return `${center}px`; // Center: 40px
    }
    
    if (total === 2) {
      // Two sockets: ±16px from center (24px, 56px)
      return index === 0 ? `${center - spacing}px` : `${center + spacing}px`;
    }
    
    if (total === 3) {
      // Three sockets: one center, two ±16px from center (24px, 40px, 56px)
      if (index === 0) return `${center - spacing}px`; // 24px
      if (index === 1) return `${center}px`; // 40px (center)
      return `${center + spacing}px`; // 56px
    }
    
    if (total === 4) {
      // Four sockets: ±7px and ±21px from center
      const positions = [center - 21, center - 7, center + 7, center + 21];
      return `${positions[index]}px`;
    }
    
    if (total === 5) {
      // Five sockets: center and ±7px, ±21px
      const positions = [center - 21, center - 7, center, center + 7, center + 21];
      return `${positions[index]}px`;
    }
    
    // Fallback for more sockets - distribute evenly in available space
    const margin = 8;
    const availableSpace = nodeSize - (margin * 2);
    const step = availableSpace / (total - 1);
    return `${margin + (index * step)}px`;
  };

  // Category border color
  const categoryColor = 
    definition.category === 'inout' ? 'var(--color-tool-inout)' :
    definition.category === 'preparation' ? 'var(--color-tool-preparation)' :
    definition.category === 'join' ? 'var(--color-tool-join)' :
    definition.category === 'aggregate' ? 'var(--color-tool-aggregate)' : 'var(--color-tool-default)';

  return (
    <div style={{ width: `${nodeSize}px`, height: `${nodeSize}px` }}>
      {/* Node container */}
      <div
        className="p-3 transition-shadow border-2 rounded-lg shadow-lg select-none sig-node bg-theme-node-default-bg hover:shadow-xl"
        style={{
          width: `${nodeSize}px`,
          height: `${nodeSize}px`,
          borderColor: categoryColor,
        }}
      >
      {/* Input handles */}
      {inputSockets.map((socket: Socket, index: number) => (
        <Handle
          key={`input-${socket.id}`}
          type="target"
          position={Position.Left}
          id={`input-${socket.id}`}
          onClick={(e) => {
            e.stopPropagation();
            previewSocket(tool.id, socket.id, "input");
          }}
          onContextMenu={(e) => handleSocketContextMenu(e, socket.id, "input")}
          style={{
            top: getSocketPosition(index, inputSockets.length),
            left: `${socketOffset}px`,
            background: 'var(--color-socket-input)',
            width: `${socketSize}px`,
            height: `${socketSize}px`,
            border: '2px solid var(--color-socket-input-border)',
            borderRadius: '50%',
            boxShadow: 'var(--color-node-default-shadow)',
            cursor: 'pointer',
          }}
          title={`Input ${socket.id}${socket.type ? ` (${socket.type})` : ''}${socket.multiple ? ' - Multiple connections allowed' : ''} - Click to preview`}
        >
          {/* Socket type indicator (L, R, etc.) */}
          {socket.type && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '7px',
              fontWeight: 'bold',
              color: 'var(--color-text-inverse)',
              pointerEvents: 'none'
            }}>
              {socket.type}
            </div>
          )}
          
          {/* Multiple connection indicator - only for inputs without type labels that accept multiple */}
          {!socket.type && socket.multiple && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '7px',
              fontWeight: 'bold',
              color: 'var(--color-text-inverse)',
              pointerEvents: 'none'
            }}>
              M
            </div>
          )}
          
          {/* Small multiple indicator for typed sockets */}
          {socket.type && socket.multiple && (
            <div style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              fontSize: '5px',
              fontWeight: 'bold',
              color: 'var(--color-error-accent)',
              background: 'var(--color-socket-input-border)',
              borderRadius: '50%',
              width: '7px',
              height: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}>
              M
            </div>
          )}
        </Handle>
      ))}

      {/* Tool icon - centered */}
      <div className="flex items-center justify-center h-full">
        <definition.icon className="w-6 h-6" style={{ color: categoryColor }} />
      </div>

      {/* Output handles */}
      {outputSockets.map((socket: Socket, index: number) => (
        <Handle
          key={`output-${socket.id}`}
          type="source"
          position={Position.Right}
          id={`output-${socket.id}`}
          onClick={(e) => {
            e.stopPropagation();
            previewSocket(tool.id, socket.id, "output");
          }}
          onContextMenu={(e) => handleSocketContextMenu(e, socket.id, "output")}
          style={{
            top: getSocketPosition(index, outputSockets.length),
            right: `${socketOffset}px`,
            background: 'var(--color-socket-output)',
            width: `${socketSize}px`,
            height: `${socketSize}px`,
            border: '2px solid var(--color-socket-output-border)',
            borderRadius: '50%',
            boxShadow: 'var(--color-node-default-shadow)',
            cursor: 'pointer',
          }}
          title={`Output ${socket.id}${socket.type ? ` (${socket.type})` : ''} - Click to preview`}
        >
          {socket.type && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '7px',
              fontWeight: 'bold',
              color: 'var(--color-text-inverse)',
              pointerEvents: 'none'
            }}>
              {socket.type}
            </div>
          )}
        </Handle>
      ))}
      </div>
      
      {/* Socket context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 py-1 rounded shadow-lg bg-theme-surface-elevated border border-theme-border-primary"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 160),
            top: Math.min(contextMenu.y, window.innerHeight - 100),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handlePreviewData}
            className="w-full px-4 py-2 text-left text-xs hover:bg-theme-surface-panel text-theme-text-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Data
          </button>
          <button
            onClick={handleProfileData}
            className="w-full px-4 py-2 text-left text-xs hover:bg-theme-surface-panel text-theme-text-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Profile Data
          </button>
        </div>
      )}
    </div>
  );
}
