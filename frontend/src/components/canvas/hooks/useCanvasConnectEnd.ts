import { useState, useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { generateUniqueId } from '@utils/id';
import { getToolDefinition } from '@data/tools';
import type { Tool } from '@domain/workflow/entities/workflow';

interface UseCanvasConnectEndParams {
  tools: Tool[];
  onAddTool: (type: string, x: number, y: number, idOverride?: string) => void;
  onAddWire: (
    from: { tool: string; socket: string },
    to: { tool: string; socket: string }
  ) => void;
}

interface ConnectionState {
  sourceToolId: string;
  sourceSocketId: string;
  isOutput: boolean;
  position: { x: number; y: number };
}

/**
 * Hook that handles connection end events - shows tool selection menu
 * when dragging from a socket to empty canvas (not connecting to another socket).
 */
export function useCanvasConnectEnd({
  tools,
  onAddTool,
  onAddWire,
}: UseCanvasConnectEndParams) {
  const { screenToFlowPosition } = useReactFlow();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(null);
  const connectionStateRef = useRef<ConnectionState | null>(null);
  const connectionMadeRef = useRef<boolean>(false);

  const onConnectStart = useCallback((_event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType: 'source' | 'target' | null }) => {
    if (!params.nodeId || !params.handleId || !params.handleType) return;

    const isOutput = params.handleType === 'source';
    const socketId = params.handleId.replace(isOutput ? 'output-' : 'input-', '');

    // Reset connection made flag
    connectionMadeRef.current = false;

    connectionStateRef.current = {
      sourceToolId: params.nodeId,
      sourceSocketId: socketId,
      isOutput,
      position: { x: 0, y: 0 }, // Will be updated in onConnectEnd
    };
  }, []);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const state = connectionStateRef.current;
    if (!state) return;

    // Get mouse position early
    const clientX = 'clientX' in event ? event.clientX : event.touches[0]?.clientX ?? 0;
    const clientY = 'clientY' in event ? event.clientY : event.touches[0]?.clientY ?? 0;

    // Wait for next frame to check if onConnect fired (React Flow calls onConnect after onConnectEnd)
    requestAnimationFrame(() => {
      // If a connection was successfully made, don't show the menu
      if (connectionMadeRef.current) {
        connectionStateRef.current = null;
        connectionMadeRef.current = false;
        return;
      }

      // Store the flow position for tool creation
      const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
      connectionStateRef.current = {
        ...state,
        position: flowPosition,
      };

      // Show menu at cursor position
      setMenuCoords({ x: clientX, y: clientY });
      setMenuOpen(true);
    });
  }, [screenToFlowPosition]);

  // Called when a connection is successfully made to another socket
  const onConnectionMade = useCallback(() => {
    connectionMadeRef.current = true;
  }, []);

  const handleToolSelect = useCallback((toolType: string) => {
    const state = connectionStateRef.current;
    if (!state) return;

    const { sourceToolId, sourceSocketId, isOutput, position } = state;

    // Generate unique ID for new tool
    const newToolId = generateUniqueId(new Set(tools.map((t) => t.id)));

    // Create the tool at the drop position
    onAddTool(toolType, position.x, position.y, newToolId);

    // Get the tool definition to find appropriate socket
    const toolDef = getToolDefinition(toolType);
    if (!toolDef) return;

    // Find the first compatible socket on the new tool
    // If dragging from output, connect to input; if from input, connect to output
    const targetSocket = toolDef.sockets.find((s) => 
      isOutput ? s.direction === 'input' : s.direction === 'output'
    );

    if (!targetSocket) return;

    // Create wire based on drag direction
    if (isOutput) {
      // Dragged from output to create new tool - wire from source output to new tool input
      onAddWire(
        { tool: sourceToolId, socket: sourceSocketId },
        { tool: newToolId, socket: targetSocket.id }
      );
    } else {
      // Dragged from input to create new tool - wire from new tool output to source input
      onAddWire(
        { tool: newToolId, socket: targetSocket.id },
        { tool: sourceToolId, socket: sourceSocketId }
      );
    }

    // Clear state
    connectionStateRef.current = null;
    setMenuOpen(false);
    setMenuCoords(null);
  }, [tools, onAddTool, onAddWire]);

  const handleMenuClose = useCallback(() => {
    connectionStateRef.current = null;
    setMenuOpen(false);
    setMenuCoords(null);
  }, []);

  // Determine filter direction based on drag source
  const filterDirection = connectionStateRef.current?.isOutput ? 'input' : 'output';

  return {
    onConnectStart,
    onConnectEnd,
    onConnectionMade,
    menuOpen,
    menuCoords,
    filterDirection: menuOpen ? filterDirection : undefined,
    onToolSelect: handleToolSelect,
    onMenuClose: handleMenuClose,
  } as const;
}
