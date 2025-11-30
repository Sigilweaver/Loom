import { useCallback } from "react";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { useSettingsStore } from "@state/settingsStore";
import { getRuntimeLogActions } from "@state/runtimeLogStore";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { previewTool } from "../api/backend";
import { getCachedPreview, cachePreview } from "../api/cache";

/**
 * Hook for handling socket preview functionality
 */
export function useSocketPreview() {
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  
  const previewRows = useSettingsStore((s) => s.backend.previewRows);
  
  const setPreviewState = useUIStore((s) => s.setPreviewState);
  const setBottomPaneOpen = useUIStore((s) => s.setBottomPaneOpen);
  const setActiveBottomTab = useUIStore((s) => s.setActiveBottomTab);
  const showNotification = useUIStore((s) => s.showNotification);

  const previewSocket = useCallback(
    async (toolId: string, socketId: string, socketDirection: "input" | "output") => {
      // Open bottom pane and switch to preview tab
      setBottomPaneOpen(true);
      setActiveBottomTab("preview");

      // Serialize workflow first (needed for cache check)
      const workflowJSON = WorkflowSerializer.toJSON(tools, wires, workflowMeta);
      const workflow = JSON.parse(workflowJSON);

      // For input sockets, we need to find the upstream tool's output
      let targetToolId = toolId;
      let targetSocketId = socketId;

      if (socketDirection === "input") {
        // Find wire connected to this input socket
        const wire = wires.find(
          (w) => w.to.tool === toolId && w.to.socket === socketId
        );
        
        if (!wire) {
          setPreviewState({
            toolId,
            socketId,
            socketDirection,
            data: [],
            schema: [],
            loading: false,
            error: "No connection to this input socket",
          });
          return;
        }

        // Preview the upstream tool's output socket
        targetToolId = wire.from.tool;
        targetSocketId = wire.from.socket;
      }

      const socketKey = targetSocketId.toString();

      // Check unified cache (works for both individual and "Preview All" requests)
      const cached = getCachedPreview(targetToolId, workflow, previewRows);
      if (cached) {
        const output = cached.outputs[socketKey];
        
        if (output) {
          // Log cache hit
          const { logCacheHit } = getRuntimeLogActions();
          logCacheHit("/workflow/tool/execute", { toolId: targetToolId });
          
          setPreviewState({
            toolId,
            socketId,
            socketDirection,
            data: output.data || [],
            schema: output.data_schema?.columns || [],
            loading: false,
            error: null,
          });
          return;
        }
      }

      // Set loading state (only if not cached)
      setPreviewState({
        toolId,
        socketId,
        socketDirection,
        data: [],
        schema: [],
        loading: true,
        error: null,
      });

      try {
        // Execute preview
        const result = await previewTool(targetToolId, workflow, previewRows);
        
        // Cache the result
        cachePreview(targetToolId, workflow, previewRows, result);

        // Get data for the specific socket
        const output = result.outputs[socketKey];

        if (!output) {
          setPreviewState({
            toolId,
            socketId,
            socketDirection,
            data: [],
            schema: [],
            loading: false,
            error: `No output data for socket ${socketKey}`,
          });
          return;
        }

        setPreviewState({
          toolId,
          socketId,
          socketDirection,
          data: output.data || [],
          schema: output.data_schema?.columns || [],
          loading: false,
          error: null,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to fetch preview";
        
        setPreviewState({
          toolId,
          socketId,
          socketDirection,
          data: [],
          schema: [],
          loading: false,
          error: errorMessage,
        });

        showNotification(`Preview failed: ${errorMessage}`, "error");
      }
    },
    [tools, wires, workflowMeta, setPreviewState, setBottomPaneOpen, setActiveBottomTab, showNotification]
  );

  return { previewSocket };
}
