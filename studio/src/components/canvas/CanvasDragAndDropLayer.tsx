import React, { useCallback, useEffect, useRef } from 'react';
import { TOOL_TOUCH_DROP_EVENT, type ToolTouchDropDetail } from '@components/shell/ToolPalette';
import { getToolDefinition } from '@data/tools';
import type { Tool } from '@domain/workflow/entities/workflow';
import { useAutoConnectPreviewStore } from '@state/autoConnectPreviewStore';
import { useSettingsStore } from '@state/settingsStore';
import { useWorkflowStore } from '@state/workflowStore';
import { findAutoConnectWire, getSocketWorldPosition as socketPos } from './hooks/useCanvasHandlers';

interface Props {
  onAddTool: (type: string, x: number, y: number, idOverride?: string) => void;
  snap: (x: number, y: number) => { x: number; y: number };
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number };
  children: React.ReactNode;
}

/**
 * Compute the preview wire for a tool being dragged at the given flow position.
 */
function computePreview(
  toolType: string,
  flowX: number,
  flowY: number,
  snap: (x: number, y: number) => { x: number; y: number },
) {
  const { autoConnect, autoConnectRadius } = useSettingsStore.getState().behavior;
  if (!autoConnect) return null;

  const def = getToolDefinition(toolType);
  if (!def) return null;

  const snapped = snap(flowX - 50, flowY - 50); // mirror the centering offset used on drop
  const phantomTool: Tool = {
    id: '__preview__',
    type: toolType,
    x: snapped.x,
    y: snapped.y,
    config: {},
    sockets: [...def.sockets],
  };

  const { tools, wires } = useWorkflowStore.getState();
  const wire = findAutoConnectWire(phantomTool, tools, wires, autoConnectRadius);
  if (!wire) return null;

  // Resolve positions for the preview line
  const fromTool = wire.from.tool === '__preview__'
    ? phantomTool
    : tools.find((t) => t.id === wire.from.tool);
  const toTool = wire.to.tool === '__preview__'
    ? phantomTool
    : tools.find((t) => t.id === wire.to.tool);
  if (!fromTool || !toTool) return null;

  const fromSocket = fromTool.sockets.find((s) => s.id === wire.from.socket);
  const toSocket = toTool.sockets.find((s) => s.id === wire.to.socket);
  if (!fromSocket || !toSocket) return null;

  const source = socketPos(fromTool, fromSocket, fromTool.sockets);
  const target = socketPos(toTool, toSocket, toTool.sockets);

  return {
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    toolId: wire.from.tool === '__preview__' ? wire.to.tool : wire.from.tool,
  };
}

export const CanvasDragAndDropLayer: React.FC<Props> = ({ onAddTool, snap, screenToFlowPosition, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const setPreview = useAutoConnectPreviewStore((s) => s.setPreview);
  const clearPreview = useAutoConnectPreviewStore((s) => s.clear);

  // Track which tool type is being dragged (set on first dragOver)
  const dragToolTypeRef = useRef<string | null>(null);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const toolType = event.dataTransfer.getData('application/reactflow');
    if (!toolType) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const size = 100;
    const centered = { x: position.x - size / 2, y: position.y - size / 2 };
    const snapped = snap(centered.x, centered.y);
    onAddTool(toolType, snapped.x, snapped.y);
    dragToolTypeRef.current = null;
    clearPreview();
  }, [onAddTool, snap, screenToFlowPosition, clearPreview]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    // Capture tool type from the drag data (only available as types, not getData during dragOver)
    if (!dragToolTypeRef.current) {
      // We can't read getData during dragover due to browser security.
      // The tool type is stored via a module-level variable set when the drag starts.
      dragToolTypeRef.current = getDragToolType();
    }

    const toolType = dragToolTypeRef.current;
    if (!toolType) return;

    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const preview = computePreview(toolType, flowPos.x, flowPos.y, snap);
    setPreview(preview);
  }, [screenToFlowPosition, snap, setPreview]);

  const onDragLeave = useCallback(() => {
    dragToolTypeRef.current = null;
    clearPreview();
  }, [clearPreview]);

  // Handle touch drop events from ToolPalette
  useEffect(() => {
    const handleTouchDrop = (event: Event) => {
      const customEvent = event as CustomEvent<ToolTouchDropDetail>;
      const { toolType, clientX, clientY } = customEvent.detail;

      // Check if the drop is within the canvas area
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return; // Drop outside canvas, ignore
      }

      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const size = 100;
      const centered = { x: position.x - size / 2, y: position.y - size / 2 };
      const snapped = snap(centered.x, centered.y);
      onAddTool(toolType, snapped.x, snapped.y);
      clearPreview();
    };

    document.addEventListener(TOOL_TOUCH_DROP_EVENT, handleTouchDrop);
    return () => {
      document.removeEventListener(TOOL_TOUCH_DROP_EVENT, handleTouchDrop);
    };
  }, [onAddTool, snap, screenToFlowPosition, clearPreview]);

  return (
    <div ref={containerRef} className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
      {children}
    </div>
  );
};

/**
 * Module-level variable to pass the tool type from drag-start to drag-over.
 * Browser security prevents reading dataTransfer.getData() during dragover,
 * so the ToolPalette sets this when starting a drag.
 */
let _dragToolType: string | null = null;
export function setDragToolType(type: string | null) { _dragToolType = type; }
export function getDragToolType(): string | null { return _dragToolType; }
