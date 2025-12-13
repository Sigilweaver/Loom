import { getToolDefinition } from "@data/tools";
import type { Tool } from "@domain/workflow/entities/workflow";
import type { Node } from "@xyflow/react";
import { useMemo } from "react";

export interface UseCanvasNodesParams {
  tools: Tool[];
  onToolMove: (id: string, x: number, y: number) => void;
}

/**
 * Hook that transforms workflow tools into React Flow nodes.
 * Builds the node data structure with tool definitions and event handlers.
 */
export function useCanvasNodes({ tools, onToolMove }: UseCanvasNodesParams): Node[] {
  return useMemo(
    () =>
      tools.map((tool) => ({
        id: tool.id,
        type: "workflow" as const,
        position: { x: tool.x, y: tool.y },
        data: {
          tool,
          definition: getToolDefinition(tool.type),
          onToolMove,
        },
        deletable: true,
        selectable: true,
      })),
    [tools, onToolMove]
  );
}
