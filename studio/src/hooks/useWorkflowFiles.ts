import { useCallback } from "react";
import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { useTabStore } from "@state/tabStore";
import { platform, hasNativeDialogs } from "@platform";
import { createLogger } from "@utils/logger";

const logger = createLogger("WorkflowFiles");

const WORKFLOW_FILE_FILTERS = [
  { name: "Workflow Files", extensions: ["swwf"] },
  { name: "All Files", extensions: ["*"] },
];

/** Turn a workflow name into a filesystem-safe file name (without extension). */
export function buildSafeFileName(name: string): string {
  const base = name || "Workflow";
  const withoutControls = Array.from(base)
    .map((ch) => ((ch.codePointAt(0) ?? 0) >= 0x20 ? ch : "_"))
    .join("");
  let safe = withoutControls.replace(/[<>:"/\\|?*]/g, "_");
  safe = safe
    .replace(/\s+/g, " ")
    .replace(/\s*_\s*/g, "_")
    .trim();
  if (!safe || /^\.+$/.test(safe)) safe = "workflow";
  if (safe.length > 120) safe = safe.slice(0, 120).trim();
  return safe;
}

/**
 * Open, import and save workflow files, on desktop (native dialogs and file
 * paths) and in the browser (file picker and download).
 */
export function useWorkflowFiles() {
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);

  const activeTabId = useTabStore((s) => s.activeTabId);
  const getTabById = useTabStore((s) => s.getTabById);
  const createTab = useTabStore((s) => s.createTab);
  const setTabFilePath = useTabStore((s) => s.setTabFilePath);
  const markTabClean = useTabStore((s) => s.markTabClean);

  const showNotification = useUIStore((s) => s.showNotification);

  /** Parse workflow JSON and open it in a new tab. */
  const openWorkflowContent = useCallback(
    (content: string, verb: "opened" | "imported", filePath?: string) => {
      try {
        const { tools, wires, meta } = WorkflowSerializer.fromJSON(content);

        const newTabId = createTab(meta.name, { tools, wires, workflowMeta: meta });

        // Just loaded from disk: remember where, and start clean
        if (newTabId && filePath) {
          setTabFilePath(newTabId, filePath);
          markTabClean(newTabId);
        }

        setSelectedTool(null);
        showNotification(`Workflow "${meta.name}" ${verb} successfully!`, "success");
      } catch (error) {
        logger.error(`Error ${verb === "opened" ? "opening" : "importing"} workflow:`, error);
        showNotification(
          `Failed to ${verb === "opened" ? "open" : "import"} workflow. Please check the file format.`,
          "error"
        );
      }
    },
    [createTab, setTabFilePath, markTabClean, setSelectedTool, showNotification]
  );

  const handleNewWorkflow = useCallback(() => {
    createTab("Untitled Workflow");
  }, [createTab]);

  const handleOpenWorkflowFromPath = useCallback(
    async (filePath: string) => {
      try {
        const content = await platform.files.readFile(filePath);
        openWorkflowContent(content, "opened", filePath);
      } catch (error) {
        logger.error("Error opening workflow:", error);
        showNotification("Failed to open workflow. Please check the file format.", "error");
      }
    },
    [openWorkflowContent, showNotification]
  );

  const handleImportWorkflow = useCallback(async () => {
    if (hasNativeDialogs()) {
      try {
        const filePath = await platform.files.showOpenDialog({
          filters: WORKFLOW_FILE_FILTERS,
          properties: ["openFile"],
        });
        if (!filePath) return;

        const content = await platform.files.readFile(filePath);
        openWorkflowContent(content, "imported", filePath);
      } catch (error) {
        logger.error("Error importing workflow:", error);
        showNotification("Failed to import workflow. Please check the file format.", "error");
      }
      return;
    }

    // Browser: use a file picker
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".swwf";
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => openWorkflowContent(e.target?.result as string, "imported");
      reader.readAsText(file);
    };
    input.click();
  }, [openWorkflowContent, showNotification]);

  const handleSaveAsWorkflow = useCallback(async () => {
    if (!activeTabId) return;

    try {
      const { tools, wires } = useWorkflowStore.getState();
      const json = WorkflowSerializer.toJSON(tools, wires, workflowMeta);
      const baseName = buildSafeFileName(workflowMeta.name);

      if (hasNativeDialogs()) {
        const filePath = await platform.files.showSaveDialog({
          defaultPath: `${baseName}.swwf`,
          filters: WORKFLOW_FILE_FILTERS,
        });

        if (filePath) {
          await platform.files.writeFile(filePath, json);
          setTabFilePath(activeTabId, filePath);
          markTabClean(activeTabId);
          showNotification("Workflow saved successfully!", "success");
        }
      } else {
        // Browser: download the file
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.swwf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        markTabClean(activeTabId);
        showNotification("Workflow saved successfully!", "success");
      }
    } catch (error) {
      logger.error("Save error:", error);
      showNotification("Failed to save workflow", "error");
    }
  }, [activeTabId, workflowMeta, setTabFilePath, markTabClean, showNotification]);

  const handleSaveWorkflow = useCallback(async () => {
    if (!activeTabId) return;

    const activeTab = getTabById(activeTabId);

    // Save in place when we know the file and can write to it
    if (activeTab?.filePath && hasNativeDialogs()) {
      try {
        const { tools, wires } = useWorkflowStore.getState();
        const json = WorkflowSerializer.toJSON(tools, wires, workflowMeta);
        await platform.files.writeFile(activeTab.filePath, json);
        markTabClean(activeTabId);
        showNotification("Workflow saved successfully!", "success");
      } catch (error) {
        logger.error("Save error:", error);
        showNotification("Failed to save workflow", "error");
      }
      return;
    }

    // No file yet (or no filesystem access): Save As
    await handleSaveAsWorkflow();
  }, [activeTabId, getTabById, workflowMeta, markTabClean, showNotification, handleSaveAsWorkflow]);

  return {
    handleNewWorkflow,
    handleOpenWorkflowFromPath,
    handleImportWorkflow,
    handleSaveWorkflow,
    handleSaveAsWorkflow,
  };
}
