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

  // Calculate socket positions - 20px spacing from center for uniformity with grid
  const getSocketPosition = (index: number, total: number): string => {
    const nodeHeight = 100; // Tool height in pixels
    const center = nodeHeight / 2; // 50px
    const spacing = 20; // 20px spacing to match grid
    
    if (total === 1) {
      return `${center}px`; // Center: 50px
    }
    
    if (total === 2) {
      // Two sockets: ±20px from center (30px, 70px)
      return index === 0 ? `${center - spacing}px` : `${center + spacing}px`;
    }
    
    if (total === 3) {
      // Three sockets: one center, two ±20px from center (30px, 50px, 70px)
      if (index === 0) return `${center - spacing}px`; // 30px
      if (index === 1) return `${center}px`; // 50px (center)
      return `${center + spacing}px`; // 70px
    }
    
    if (total === 4) {
      // Four sockets: ±10px and ±30px from center (20px, 40px, 60px, 80px)
      const positions = [center - 30, center - 10, center + 10, center + 30];
      return `${positions[index]}px`;
    }
    
    if (total === 5) {
      // Five sockets: center and ±10px, ±30px (20px, 40px, 50px, 60px, 80px)
      const positions = [center - 30, center - 10, center, center + 10, center + 30];
      return `${positions[index]}px`;
    }
    
    // Fallback for more sockets - distribute evenly in available space
    const availableSpace = 70; // Leave 15px margin on top and bottom
    const startPosition = 15;
    const step = availableSpace / (total - 1);
    return `${startPosition + (index * step)}px`;
  };

  return (
    <div
      className="sig-node border-2 rounded-lg p-4 bg-theme-node-default-bg shadow-lg hover:shadow-xl transition-shadow select-none"
      style={{
        width: '100px',  // Square dimensions
        height: '100px',
        borderColor: 
          definition.category === 'inout' ? 'var(--color-tool-inout)' :
          definition.category === 'preparation' ? 'var(--color-tool-preparation)' :
          definition.category === 'join' ? 'var(--color-tool-join)' :
          definition.category === 'aggregate' ? 'var(--color-tool-aggregate)' : 'var(--color-tool-default)',
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
            left: '-9px',
            background: 'var(--color-socket-input)',
            width: '18px',
            height: '18px',
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
              fontSize: '8px',
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
              fontSize: '8px',
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
              fontSize: '6px',
              fontWeight: 'bold',
              color: 'var(--color-error-accent)',
              background: 'var(--color-socket-input-border)',
              borderRadius: '50%',
              width: '8px',
              height: '8px',
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

      {/* Tool content */}
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <div className="text-xl mb-1">{definition.icon}</div>
          <div className="text-xs font-medium text-theme-text-primary leading-tight">
            {definition.name}
          </div>
        </div>
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
            right: '-9px',
            background: 'var(--color-socket-output)',
            width: '18px',
            height: '18px',
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
              fontSize: '8px',
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
  );
}
