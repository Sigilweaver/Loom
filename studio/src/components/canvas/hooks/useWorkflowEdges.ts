import { useMemo } from "react";
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

  return useMemo(() => wiresToEdges(wires, edgeStyle), [wires, edgeStyle]);
}
