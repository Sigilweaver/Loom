import { useClipboardStore } from "@state/clipboardStore";
import type { Node } from "@xyflow/react";
import { useCallback } from "react";

export interface UseCanvasPasteParams {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  doPaste: () => void;
}

export function useCanvasPaste({ setNodes, doPaste }: UseCanvasPasteParams) {
  return useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      console.log("[PASTE_EVENT] Native paste event triggered");

      const hasClipboard = useClipboardStore.getState().clipboard !== null;
      console.log("[PASTE_EVENT] Has clipboard data:", hasClipboard);

      if (hasClipboard) {
        e.preventDefault();
        doPaste();
      }
    },
    [setNodes, doPaste]
  );
}
