import React from 'react';
import type { Edge } from '@xyflow/react';
import type { Tool, Wire } from '@domain/workflow/entities/workflow';
import { CanvasActionMenu, type ActionItem } from './CanvasActionMenu';

interface Props {
  // General actions menu
  actionsOpen: boolean;
  actionsCoords: { x: number; y: number } | null;
  onCloseActions: () => void;
  hasSelection: boolean;
  multiSelection: boolean;
  hasClipboard: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onAlignH: () => void;
  onAlignV: () => void;
  onDistH: () => void;
  onDistV: () => void;

  // Edge context menu
  edgeMenuOpen: boolean;
  edgeMenuCoords: { x: number; y: number } | null;
  onCloseEdgeMenu: () => void;
  edge: Edge | null;
  tools: Tool[];
  wires: Wire[];
  onAddWire: (f: { tool: string; socket: string }, t: { tool: string; socket: string }) => void;
  onRemoveWire: (id: string) => void;
  onBeginTransaction?: (() => void) | undefined;
  onCommitTransaction?: (() => void) | undefined;
}

export const CanvasMenus: React.FC<Props> = ({
  actionsOpen,
  actionsCoords,
  onCloseActions,
  hasSelection,
  multiSelection,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onAlignH,
  onAlignV,
  onDistH,
  onDistV,
  edgeMenuOpen,
  edgeMenuCoords,
  onCloseEdgeMenu,
  edge,
  tools,
  wires,
  onAddWire,
  onRemoveWire,
  onBeginTransaction,
  onCommitTransaction,
}) => {
  const mod = typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';

  const generalItems: ActionItem[] = (() => {
    const items: ActionItem[] = [];
    if (hasSelection) {
      items.push({ key: 'copy', label: 'Copy', onClick: onCopy, hint: `${mod}+C` });
      items.push({ key: 'cut', label: 'Cut', onClick: onCut, hint: `${mod}+X` });
      if (hasClipboard) items.push({ key: 'paste', label: 'Paste', onClick: onPaste, hint: `${mod}+V` });
      items.push({ key: 'delete', label: 'Delete', onClick: onDelete, hint: 'Del' });
      if (multiSelection) {
        items.push({ key: 'align-h', label: 'Align Horizontally', onClick: onAlignH });
        items.push({ key: 'align-v', label: 'Align Vertically', onClick: onAlignV });
        items.push({ key: 'dist-h', label: 'Distribute Horizontally', onClick: onDistH });
        items.push({ key: 'dist-v', label: 'Distribute Vertically', onClick: onDistV });
      }
    } else if (hasClipboard) {
      items.push({ key: 'paste', label: 'Paste', onClick: onPaste, hint: `${mod}+V` });
    }
    return items;
  })();

  const buildEdgeMenuItems = (edge: Edge): ActionItem[] => {
    const items: ActionItem[] = [];
    const parsed = {
      sourceTool: edge.source,
      sourceSocket: String(edge.sourceHandle || '').replace('output-', ''),
      targetTool: edge.target,
      targetSocket: String(edge.targetHandle || '').replace('input-', ''),
    };
    items.push({ key: 'delete-edge', label: 'Delete', onClick: () => onRemoveWire(edge.id) });

  const toolById = (id: string) => tools.find(t => t.id === id);
    const isTargetSocketOccupied = (toolId: string, socket: string) => wires.some(w => w.to.tool === toolId && w.to.socket === socket);
    const isSourceSocketOccupied = (toolId: string, socket: string) => wires.some(w => w.from.tool === toolId && w.from.socket === socket);

    // Change input to ...
    const targetTool = toolById(parsed.targetTool);
    if (targetTool) {
      const inputSockets = targetTool.sockets.filter(s => s.direction === 'input');
      const viableInputs = inputSockets.filter(s => s.id !== parsed.targetSocket);
      viableInputs.forEach(s => {
        const occupied = isTargetSocketOccupied(targetTool.id, s.id);
        const canUse = s.multiple ?? !occupied ? true : !occupied;
        if (canUse) {
          items.push({
            key: `change-input-${s.id}`,
            label: `Change input to ${s.type ?? String(s.id)}`,
            onClick: () => {
              onBeginTransaction?.();
              onRemoveWire(edge.id);
              onAddWire({ tool: parsed.sourceTool, socket: parsed.sourceSocket }, { tool: targetTool.id, socket: s.id });
              onCommitTransaction?.();
            },
          });
        }
      });
    }

    // Change output to ...
    const sourceTool = toolById(parsed.sourceTool);
    if (sourceTool) {
      const outputSockets = sourceTool.sockets.filter(s => s.direction === 'output');
      const viableOutputs = outputSockets.filter(s => s.id !== parsed.sourceSocket);
      viableOutputs.forEach(s => {
        const occupied = isSourceSocketOccupied(sourceTool.id, s.id);
        const canUse = s.multiple ?? !occupied ? true : !occupied;
        if (canUse) {
          items.push({
            key: `change-output-${s.id}`,
            label: `Change output to ${s.type ?? String(s.id)}`,
            onClick: () => {
              onBeginTransaction?.();
              onRemoveWire(edge.id);
              onAddWire({ tool: sourceTool.id, socket: s.id }, { tool: parsed.targetTool, socket: parsed.targetSocket });
              onCommitTransaction?.();
            },
          });
        }
      });
    }

    return items;
  };

  return (
    <>
      <CanvasActionMenu open={actionsOpen} coords={actionsCoords} onClose={onCloseActions} items={generalItems} />
      <CanvasActionMenu open={edgeMenuOpen && !!edge} coords={edgeMenuCoords} onClose={onCloseEdgeMenu} items={edge ? buildEdgeMenuItems(edge) : []} />
    </>
  );
};

export default CanvasMenus;
