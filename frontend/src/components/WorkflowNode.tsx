import { Handle, Position } from '@xyflow/react';
import { Tool, ToolDefinition, Socket } from '../domain/workflow/entities/workflow';
import { useSocketPreview } from '../hooks/useSocketPreview';

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
    <div className="flex flex-col items-center">
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
          style={{
            top: getSocketPosition(index, inputSockets.length),
            left: `${socketOffset}px`,
            background: 'var(--color-socket-input)',
            width: `${socketSize}px`,
            height: `${socketSize}px`,
            border: '2px solid var(--color-socket-input-border)',
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
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
          style={{
            top: getSocketPosition(index, outputSockets.length),
            right: `${socketOffset}px`,
            background: 'var(--color-socket-output)',
            width: `${socketSize}px`,
            height: `${socketSize}px`,
            border: '2px solid var(--color-socket-output-border)',
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
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
      
      {/* Tool label - below node with background */}
      <div 
        className="text-[10px] font-medium text-theme-text-primary text-center mt-1 px-1.5 py-0.5 rounded border max-w-[80px] truncate"
        style={{ backgroundColor: 'var(--color-surface-elevated)', borderColor: categoryColor }}
        title={definition.name}
      >
        {definition.name}
      </div>
    </div>
  );
}
