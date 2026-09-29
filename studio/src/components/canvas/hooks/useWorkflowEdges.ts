import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Edge } from "@xyflow/react";
import { useWorkflowStore } from "@state/workflowStore";
import { useSettingsStore } from "@state/settingsStore";
import { wiresToEdges } from "@domain/workflow/services/wireEdges";

/**
 * Derives React Flow edges from the workflow's wires.
 *
 * Edge styling depends on the edge style setting and on graph validity, so it
 * is computed here at render time rather than stored in the workflow store.
 * Theme colors are resolved by CSS, so theme switches need no rebuild.
 */
export function useWorkflowEdges(): Edge[] {
  const wires = useWorkflowStore((s) => s.wires);
  const edgeStyle = useSettingsStore((s) => s.ui.edgeStyle);
  // Cycle detection only needs tool ids, so position and config edits (which
  // replace `tools`) must not rebuild every edge. useShallow keeps the array
  // reference stable until the set of ids actually changes.
  const toolIds = useWorkflowStore(useShallow((s) => s.tools.map((t) => t.id)));

  return useMemo(
    () => wiresToEdges(wires, toolIds.map((id) => ({ id })), edgeStyle),
    [wires, toolIds, edgeStyle]
  );
}
