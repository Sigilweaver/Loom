import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { getXMLClipboard, getLegacyClipboard } from '../clipboardStore';

export interface UseCanvasPasteParams {
  onPasteXMLAt: ((anchor: { x: number; y: number }, fragment: string) => Promise<string[]>) | undefined;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  doPaste: () => void;
  getAnchor: () => { x: number; y: number };
}

export function useCanvasPaste({ onPasteXMLAt, setNodes, doPaste, getAnchor }: UseCanvasPasteParams) {
  return useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData?.getData('text/plain') || '';

    const tryUse = (fragment: string) => {
      if (!onPasteXMLAt) return false;
      if (!fragment || !fragment.includes('<WorkflowFragment')) return false;
      e.preventDefault();
      const anchor = getAnchor();
      onPasteXMLAt(anchor, fragment).then(newIds => {
        if (Array.isArray(newIds) && newIds.length > 0) {
          setTimeout(() => {
            setNodes(ns => ns.map((n) => ({ ...n, selected: newIds.includes(n.id) })));
          }, 0);
        }
      }).catch(() => {});
      return true;
    };

    if (tryUse(text)) return;
    const local = getXMLClipboard();
    if (tryUse(local)) return;

  if (getLegacyClipboard()) {
      e.preventDefault();
      doPaste();
    }
  }, [onPasteXMLAt, setNodes, doPaste, getAnchor]);
}
