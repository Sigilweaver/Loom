import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { useHistoryStore } from "@state/historyStore";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import SigilWeaverLogo from "./SigilWeaverLogo";
import { ThemeSelector } from "./ThemeSelector";

export default function Header() {
  // Access stores directly
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);

  const pushState = useHistoryStore((s) => s.pushState);

  const showNotification = useUIStore((s) => s.showNotification);
  const setWorkflowViewerVisible = useUIStore(
    (s) => s.setWorkflowViewerVisible
  );
  const setBottomPaneOpen = useUIStore((s) => s.setBottomPaneOpen);

  const handleNewWorkflow = () => {
    // Save current state before clearing
    pushState(tools, wires, workflowMeta);

    // Clear workflow
    newWorkflow();
    setSelectedTool(null);
  };

  const handleImportWorkflow = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".swwf";
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;

          // Save current state before import
          pushState(tools, wires, workflowMeta);

          // Parse JSON workflow file
          const {
            tools: importedTools,
            wires: importedWires,
            meta,
          } = WorkflowSerializer.fromJSON(content);

          // Load into store
          loadWorkflow(importedTools, importedWires, meta);
          setSelectedTool(null);

          showNotification(
            `Workflow "${meta.name}" imported successfully!`,
            "success"
          );
        } catch (error) {
          console.error("Error importing workflow:", error);
          showNotification(
            "Failed to import workflow. Please check the file format.",
            "error"
          );
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportWorkflow = async () => {
    try {
      const json = WorkflowSerializer.toJSON(tools, wires, workflowMeta);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Build filesystem-safe filename
      const buildSafeName = (name: string) => {
        const base = name || "Workflow";
        const withoutControls = Array.from(base)
          .map((ch) => {
            const cp = ch.codePointAt(0) ?? 0;
            return cp >= 0x20 ? ch : "_";
          })
          .join("");
        let safe = withoutControls.replace(/[<>:"/\\|?*]/g, "_");
        safe = safe
          .replace(/\s+/g, " ")
          .replace(/\s*_\s*/g, "_")
          .trim();
        if (!safe || /^\.+$/.test(safe)) safe = "workflow";
        if (safe.length > 120) safe = safe.slice(0, 120).trim();
        return safe;
      };

      const baseName = buildSafeName(workflowMeta.name);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.swwf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showNotification("Workflow exported successfully!", "success");
    } catch (error) {
      console.error("Export error:", error);
      showNotification("Failed to export workflow", "error");
    }
  };

  const handleShowWorkflowViewer = () => {
    setWorkflowViewerVisible(true);
  };

  const handlePreviewWorkflow = () => {
    // Open the bottom pane to show preview
    setBottomPaneOpen(true);
    showNotification(
      "Bottom pane opened. Preview will show data when connected to backend.",
      "info"
    );
  };

  const truncate = (value: string, max: number) =>
    value.length > max ? value.slice(0, max).trimEnd() + "…" : value;

  const truncatedWorkflowName = truncate(workflowMeta.name, 60);
  return (
    <header className="border-b shadow-lg bg-theme-header-bg border-theme-border-primary">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - App title and workflow info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <SigilWeaverLogo
                className="opacity-75 text-theme-header-logo-icon"
                size="md"
              />
              <h1 className="text-xl font-bold text-theme-header-title-text">
                Sigilweaver
              </h1>
            </div>
            <div className="text-sm opacity-75 text-theme-header-metadata-text">
              <div className="font-medium" title={workflowMeta.name}>
                {truncatedWorkflowName}
              </div>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2">
            <ThemeSelector className="mr-2" />

            <button
              onClick={handleNewWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-new-bg border border-theme-header-btn-new-border text-theme-header-btn-new-text
                hover:bg-theme-header-btn-new-bg-hover hover:border-theme-header-btn-new-border-hover hover:text-theme-header-btn-new-text-hover
                active:bg-theme-header-btn-new-bg-active active:border-theme-header-btn-new-border-active active:text-theme-header-btn-new-text-active
                disabled:bg-theme-header-btn-new-bg-disabled disabled:border-theme-header-btn-new-border-disabled disabled:text-theme-header-btn-new-text-disabled"
              title="New Workflow (Ctrl+N)"
            >
              New
            </button>

            <button
              onClick={handleImportWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-import-bg border border-theme-header-btn-import-border text-theme-header-btn-import-text
                hover:bg-theme-header-btn-import-bg-hover hover:border-theme-header-btn-import-border-hover hover:text-theme-header-btn-import-text-hover
                active:bg-theme-header-btn-import-bg-active active:border-theme-header-btn-import-border-active active:text-theme-header-btn-import-text-active
                disabled:bg-theme-header-btn-import-bg-disabled disabled:border-theme-header-btn-import-border-disabled disabled:text-theme-header-btn-import-text-disabled"
              title="Import Workflow (Ctrl+I)"
            >
              Import
            </button>

            <button
              onClick={handleExportWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-export-bg border border-theme-header-btn-export-border text-theme-header-btn-export-text
                hover:bg-theme-header-btn-export-bg-hover hover:border-theme-header-btn-export-border-hover hover:text-theme-header-btn-export-text-hover
                active:bg-theme-header-btn-export-bg-active active:border-theme-header-btn-export-border-active active:text-theme-header-btn-export-text-active
                disabled:bg-theme-header-btn-export-bg-disabled disabled:border-theme-header-btn-export-border-disabled disabled:text-theme-header-btn-export-text-disabled"
              title="Export Workflow (Ctrl+E)"
            >
              Export
            </button>

            <button
              onClick={handleShowWorkflowViewer}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-viewcode-bg border border-theme-header-btn-viewcode-border text-theme-header-btn-viewcode-text
                hover:bg-theme-header-btn-viewcode-bg-hover hover:border-theme-header-btn-viewcode-border-hover hover:text-theme-header-btn-viewcode-text-hover
                active:bg-theme-header-btn-viewcode-bg-active active:border-theme-header-btn-viewcode-border-active active:text-theme-header-btn-viewcode-text-active
                disabled:bg-theme-header-btn-viewcode-bg-disabled disabled:border-theme-header-btn-viewcode-border-disabled disabled:text-theme-header-btn-viewcode-text-disabled"
              title="Show Workflow Viewer (Ctrl+Alt+X)"
            >
              View Code
            </button>

            <div className="w-px h-6 mx-1 opacity-50 bg-theme-header-divider"></div>

            <button
              onClick={handlePreviewWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-preview-bg border border-theme-header-btn-preview-border text-theme-header-btn-preview-text
                hover:bg-theme-header-btn-preview-bg-hover hover:border-theme-header-btn-preview-border-hover hover:text-theme-header-btn-preview-text-hover
                active:bg-theme-header-btn-preview-bg-active active:border-theme-header-btn-preview-border-active active:text-theme-header-btn-preview-text-active
                disabled:bg-theme-header-btn-preview-bg-disabled disabled:border-theme-header-btn-preview-border-disabled disabled:text-theme-header-btn-preview-text-disabled"
              title="Preview Workflow Results (Ctrl+P)"
            >
              Preview
            </button>

            <button
              onClick={() => {
                if (confirm("This will run the workflow. Continue?")) {
                  showNotification(
                    "Workflow execution not yet implemented",
                    "info"
                  );
                }
              }}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-run-bg border border-theme-header-btn-run-border text-theme-header-btn-run-text
                hover:bg-theme-header-btn-run-bg-hover hover:border-theme-header-btn-run-border-hover hover:text-theme-header-btn-run-text-hover
                active:bg-theme-header-btn-run-bg-active active:border-theme-header-btn-run-border-active active:text-theme-header-btn-run-text-active
                disabled:bg-theme-header-btn-run-bg-disabled disabled:border-theme-header-btn-run-border-disabled disabled:text-theme-header-btn-run-text-disabled"
              title="Run Workflow (F5)"
            >
              Run
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
