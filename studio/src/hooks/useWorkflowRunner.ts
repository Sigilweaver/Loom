import { useCallback, useRef, useState } from "react";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { useTabStore } from "@state/tabStore";
import { useExecutionStore } from "@state/executionStore";
import { useSettingsStore } from "@state/settingsStore";
import { useWorkflowExecute } from "@api/hooks";
import { previewAllTools } from "@api/execution";
import { clearBackendWorkflowCache } from "@api/backend";
import { resolveWorkflowConnections } from "@api/connectionResolver";
import { cacheAllPreviews, selectCacheablePreviews } from "@api/cache";

/** Resolve on the next animation frame, after the browser has painted. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      setTimeout(resolve, 0);
      return;
    }
    // A frame callback runs before paint; the timeout inside runs after it.
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

/**
 * Preview All, Run and cache actions for the active workflow.
 */
export function useWorkflowRunner() {
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  const activeTabId = useTabStore((s) => s.activeTabId);

  const showNotification = useUIStore((s) => s.showNotification);
  const setBottomPaneOpen = useUIStore((s) => s.setBottomPaneOpen);
  const setActiveBottomTab = useUIStore((s) => s.setActiveBottomTab);
  const bypassCache = useUIStore((s) => s.bypassCache);

  const previewRows = useSettingsStore((s) => s.backend.previewRows);

  const isExecuting = useExecutionStore((s) =>
    activeTabId ? s.executions[activeTabId]?.isExecuting ?? false : false
  );
  const startExecution = useExecutionStore((s) => s.startExecution);
  const finishExecution = useExecutionStore((s) => s.finishExecution);
  const failExecution = useExecutionStore((s) => s.failExecution);
  const addLog = useExecutionStore((s) => s.addLog);
  const clearLogs = useExecutionStore((s) => s.clearLogs);

  const { execute } = useWorkflowExecute();

  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  // State updates are async; a ref stops a second Preview All from starting
  // (for example a repeated Ctrl+P) before the loading state has rendered.
  const previewInFlight = useRef(false);

  const handlePreviewWorkflow = useCallback(async () => {
    if (previewInFlight.current) return;

    const { tools, wires } = useWorkflowStore.getState();
    if (tools.length === 0) {
      showNotification("Cannot preview empty workflow", "error");
      return;
    }

    previewInFlight.current = true;
    setBottomPaneOpen(true);
    setActiveBottomTab("preview");
    setIsPreviewLoading(true);

    try {
      // Let the loading state and bottom pane paint before the heavier
      // serialization and cache work starts.
      await nextPaint();

      const workflow = JSON.parse(WorkflowSerializer.toJSON(tools, wires, workflowMeta));

      // Resolve database connections before preview all
      const resolvedWorkflow = await resolveWorkflowConnections(workflow);

      // bypassCache is passed as force_refresh
      const result = await previewAllTools(resolvedWorkflow, previewRows, bypassCache);

      // Share the results with per-socket previews via the unified cache. The
      // unresolved workflow is used for keys so credentials never enter them.
      // This yields to the UI between slices, so it stays responsive.
      await cacheAllPreviews(workflow, previewRows, selectCacheablePreviews(result.tools));

      showNotification("Previews loaded for all tools!", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showNotification(`Preview failed: ${message}`, "error");
    } finally {
      previewInFlight.current = false;
      setIsPreviewLoading(false);
    }
  }, [workflowMeta, previewRows, bypassCache, showNotification, setBottomPaneOpen, setActiveBottomTab]);

  const handleClearCache = useCallback(async () => {
    try {
      const result = await clearBackendWorkflowCache(workflowMeta.workflowId);
      if (result.status === "cleared") {
        showNotification("Backend cache cleared successfully", "success");
      } else if (result.status === "cache_disabled") {
        showNotification("Backend cache is disabled", "info");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showNotification(`Failed to clear cache: ${message}`, "error");
    }
  }, [workflowMeta.workflowId, showNotification]);

  const handleRunWorkflow = useCallback(async () => {
    const executionTabId = activeTabId;
    if (!executionTabId) return;
    try {
      const { tools, wires } = useWorkflowStore.getState();
      if (tools.length === 0) {
        showNotification("Cannot execute empty workflow", "error");
        return;
      }

      if (!tools.some((t) => t.type === "Output")) {
        showNotification("Add a Write tool before running the workflow", "error");
        return;
      }

      clearLogs(executionTabId);
      startExecution(executionTabId);

      setBottomPaneOpen(true);
      setActiveBottomTab("logs");

      addLog(
        { level: "info", message: `Starting workflow execution: ${workflowMeta.name}` },
        executionTabId
      );

      const workflow = JSON.parse(WorkflowSerializer.toJSON(tools, wires, workflowMeta));

      addLog(
        { level: "info", message: `Executing ${tools.length} tools with ${wires.length} connections` },
        executionTabId
      );

      await execute(workflow, undefined, {
        tabId: executionTabId,
        workflowId: workflowMeta.workflowId,
      });

      addLog(
        { level: "success", message: "Workflow execution completed successfully" },
        executionTabId
      );

      finishExecution({ tool_id: "", outputs: {} }, executionTabId);
      showNotification("Workflow executed successfully!", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      addLog({ level: "error", message: `Execution failed: ${message}` }, executionTabId);

      failExecution(message, executionTabId);
      showNotification(`Execution failed: ${message}`, "error");
    }
  }, [
    activeTabId,
    workflowMeta,
    execute,
    showNotification,
    setBottomPaneOpen,
    setActiveBottomTab,
    startExecution,
    finishExecution,
    failExecution,
    addLog,
    clearLogs,
  ]);

  return {
    isPreviewLoading,
    isExecuting,
    bypassCache,
    handlePreviewWorkflow,
    handleClearCache,
    handleRunWorkflow,
  };
}
