import { Handle, Position } from '@xyflow/react';
import { Tool, ToolDefinition, Socket } from '../types/workflow';

interface WorkflowNodeProps {
  data: {
    tool: Tool;
    definition: ToolDefinition;
    onToolMove: (toolId: string, x: number, y: number) => void;
  };
}

export default function WorkflowNode({ data }: WorkflowNodeProps) {
  const { definition } = data;

  const inputSockets = definition.sockets.filter((socket: Socket) => socket.direction === 'input');
  const outputSockets = definition.sockets.filter((socket: Socket) => socket.direction === 'output');

  // Calculate socket positions - distribute evenly around center
  const getSocketPosition = (index: number, total: number): string => {
    if (total === 1) return '50%';
    if (total === 2) return index === 0 ? '35%' : '65%';
    if (total === 3) return index === 0 ? '25%' : index === 1 ? '50%' : '75%';
    if (total === 4) return index === 0 ? '20%' : index === 1 ? '40%' : index === 2 ? '60%' : '80%';
    if (total === 5) return index === 0 ? '15%' : index === 1 ? '30%' : index === 2 ? '50%' : index === 3 ? '70%' : '85%';
    // Fallback for more sockets
    return `${15 + (index * (70 / (total - 1)))}%`;
  };

  return (
    <div
      className="border-2 rounded-lg p-4 bg-white shadow-lg hover:shadow-xl transition-shadow select-none"
      style={{
        width: '100px',  // Square dimensions
        height: '100px',
        borderColor: 
          definition.category === 'inout' ? '#10b981' :
          definition.category === 'preparation' ? '#3b82f6' :
          definition.category === 'join' ? '#8b5cf6' : '#6b7280',
      }}
    >
      {/* Input handles */}
      {inputSockets.map((socket: Socket, index: number) => (
        <Handle
          key={`input-${socket.id}`}
          type="target"
          position={Position.Left}
          id={`input-${socket.id}`}
          style={{
            top: getSocketPosition(index, inputSockets.length),
            left: '-9px',
            background: '#3b82f6',
            width: '18px',
            height: '18px',
            border: '3px solid white',
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
          title={`Input ${socket.id}${socket.type ? ` (${socket.type})` : ''}${socket.multiple ? ' - Multiple connections allowed' : ' - Single connection only'}`}
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
              color: 'white',
              pointerEvents: 'none'
            }}>
              {socket.type}
            </div>
          )}
          
          {/* Multiple connection indicator - only for inputs without type labels */}
          {!socket.type && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '8px',
              fontWeight: 'bold',
              color: 'white',
              pointerEvents: 'none'
            }}>
              {socket.multiple ? 'M' : '1'}
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
              color: '#ef4444',
              background: 'white',
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
          <div className="text-xs font-medium text-gray-700 leading-tight">
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
          style={{
            top: getSocketPosition(index, outputSockets.length),
            right: '-9px',
            background: '#10b981',
            width: '18px',
            height: '18px',
            border: '3px solid white',
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
          title={`Output ${socket.id}${socket.type ? ` (${socket.type})` : ''}`}
        >
          {socket.type && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '8px',
              fontWeight: 'bold',
              color: 'white',
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
