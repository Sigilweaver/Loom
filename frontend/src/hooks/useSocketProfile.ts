import { useCallback } from "react";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { profileColumns } from "../api/backend";
import { resolveWorkflowConnections } from "../api/connectionResolver";

/**
 * Hook for handling socket profiling functionality
 * 
 * Profiles column data for a socket, computing statistics like
 * null counts, unique values, min/max, and data quality metrics.
 */
export function useSocketProfile() {
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  
  const setProfileState = useUIStore((s) => s.setProfileState);
  const setBottomPaneOpen = useUIStore((s) => s.setBottomPaneOpen);
  const setActiveBottomTab = useUIStore((s) => s.setActiveBottomTab);
  const showNotification = useUIStore((s) => s.showNotification);

  const profileSocket = useCallback(
    async (toolId: string, socketId: string, socketDirection: "input" | "output") => {
      // Read fresh state from store to avoid stale closure issues
      const tools = useWorkflowStore.getState().tools;
      const wires = useWorkflowStore.getState().wires;
      
      // Open bottom pane and switch to profile tab
      setBottomPaneOpen(true);
      setActiveBottomTab("profile");

      // For input sockets, we need to find the upstream tool's output
      let targetToolId = toolId;
      let targetSocketId = socketId;

      if (socketDirection === "input") {
        // Find wire connected to this input socket
        const wire = wires.find(
          (w) => w.to.tool === toolId && w.to.socket === socketId
        );
        
        if (!wire) {
          setProfileState({
            toolId,
            socketId,
            socketDirection,
            profile: null,
            loading: false,
            error: "No connection to this input socket",
          });
          return;
        }

        // Profile the upstream tool's output socket
        targetToolId = wire.from.tool;
        targetSocketId = wire.from.socket;
      }

      // Extract only the upstream subgraph for the target tool
      const { tools: upstreamTools, wires: upstreamWires } = 
        WorkflowSerializer.extractUpstreamSubgraph(tools, wires, targetToolId);

      // Serialize the filtered subgraph
      const workflowJSON = WorkflowSerializer.toJSON(upstreamTools, upstreamWires, workflowMeta);
      const workflow = JSON.parse(workflowJSON);

      const socketKey = targetSocketId.toString();

      // Set loading state
      setProfileState({
        toolId,
        socketId,
        socketDirection,
        profile: null,
        loading: true,
        error: null,
      });

      try {
        // Resolve database connections before profiling
        const resolvedWorkflow = await resolveWorkflowConnections(workflow);
        
        // Execute profile - fetches all metrics for all columns
        const result = await profileColumns(targetToolId, resolvedWorkflow, socketKey);

        setProfileState({
          toolId,
          socketId,
          socketDirection,
          profile: result,
          loading: false,
          error: null,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to fetch profile";
        
        setProfileState({
          toolId,
          socketId,
          socketDirection,
          profile: null,
          loading: false,
          error: errorMessage,
        });

        showNotification(`Profile failed: ${errorMessage}`, "error");
      }
    },
    [workflowMeta, setProfileState, setBottomPaneOpen, setActiveBottomTab, showNotification]
  );

  return { profileSocket };
}
