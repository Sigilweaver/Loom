import { useEffect } from "react";
import { useWorkflowStore } from "@state/workflowStore";
import { useValidationStore } from "@state/validationStore";

/** Wait for edits to settle so dragging a tool does not re-validate per frame. */
const REFRESH_DELAY_MS = 150;

/**
 * Keeps validation results in step with the workflow while they are shown.
 * Mount once near the app root.
 */
export function useValidationSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (!useValidationStore.getState().active) return;
      clearTimeout(timer);
      timer = setTimeout(() => useValidationStore.getState().refresh(), REFRESH_DELAY_MS);
    };

    const unsubscribeWorkflow = useWorkflowStore.subscribe((state, prev) => {
      if (state.tools !== prev.tools || state.wires !== prev.wires) schedule();
    });

    return () => {
      clearTimeout(timer);
      unsubscribeWorkflow();
    };
  }, []);
}
