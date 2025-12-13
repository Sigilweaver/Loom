import { useClipboardStore } from "@state/clipboardStore";
import { useCallback } from "react";

export interface UseCanvasPasteParams {
  doPaste: () => void;
}

export function useCanvasPaste({ doPaste }: UseCanvasPasteParams) {
  return useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const hasClipboard = useClipboardStore.getState().clipboard !== null;

      if (hasClipboard) {
        e.preventDefault();
        doPaste();
      }
    },
    [doPaste]
  );
}
