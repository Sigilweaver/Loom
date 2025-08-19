import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Tool } from '@domain/workflow/entities/workflow';

export interface UseCanvasKeyboardParams {
  isFirefox: boolean;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onToolSelect: ((tool: Tool | null) => void) | undefined;
  doCopy: () => void;
  doCut: () => void;
  doPaste: () => void;
}

export function useCanvasKeyboard({ isFirefox, setNodes, setEdges, onToolSelect, doCopy, doCut, doPaste }: UseCanvasKeyboardParams) {
  return useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (isTyping) return;
    if (e.key === 'Escape') {
      setNodes(ns => ns.map(n => ({ ...n, selected: false })));
      setEdges(es => es.map(edge => ({ ...edge, selected: false })));
      onToolSelect?.(null);
      return;
    }
    const isCopy = (e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey);
    const isCut = (e.key === 'x' || e.key === 'X') && (e.ctrlKey || e.metaKey);
    const isPaste = (e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey);
    const isSelectAll = (e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey);
    if (!(isCopy || isCut || isPaste || isSelectAll)) return;
    if (isPaste && isFirefox) { return; }
    e.preventDefault();
    if (isSelectAll) {
      setNodes(ns => ns.map(n => ({ ...n, selected: true })));
      onToolSelect?.(null);
      return;
    }
    if (isCopy) doCopy();
    if (isCut) doCut();
    if (isPaste) doPaste();
  }, [isFirefox, setNodes, setEdges, onToolSelect, doCopy, doCut, doPaste]);
}
