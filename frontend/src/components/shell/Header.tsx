import { WorkflowSerializer } from "@domain/workflow/services/WorkflowSerializer";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { useTabStore } from "@state/tabStore";
import { useExecutionStore } from "@state/executionStore";
import { useSettingsStore } from "@state/settingsStore";
import { useWorkflowExecute } from "@api/hooks";
import { previewAllTools, clearBackendWorkflowCache } from "@api/backend";
import { resolveWorkflowConnections } from "@api/connectionResolver";
import { cacheAllPreviews } from "@api/cache";
import { platform, hasNativeDialogs } from "@platform";
import { createLogger } from "@utils/logger";
import SigilWeaverLogo from "./SigilWeaverLogo";
import { useEffect, forwardRef, useImperativeHandle, useState, useRef, useCallback } from "react";

const logger = createLogger('Header');

interface HeaderProps {
  onShowSettings: () => void;
}

export interface HeaderRef {
  handleSaveWorkflow: () => void;
  handleSaveAsWorkflow: () => void;
  handleImportWorkflow: () => void;
  handleToggleWorkflowViewer: () => void;
  handlePreviewWorkflow: () => void;
  handleRunWorkflow: () => void;
}

const Header = forwardRef<HeaderRef, HeaderProps>(({ onShowSettings }, ref) => {
  // Access stores directly
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);

  // Tab store
  const activeTabId = useTabStore((s) => s.activeTabId);
  const getTabById = useTabStore((s) => s.getTabById);
  const createTab = useTabStore((s) => s.createTab);
  const setTabFilePath = useTabStore((s) => s.setTabFilePath);
  const markTabClean = useTabStore((s) => s.markTabClean);

  const showNotification = useUIStore((s) => s.showNotification);
  const workflowViewerVisible = useUIStore((s) => s.workflowViewerVisible);
  const setWorkflowViewerVisible = useUIStore(
    (s) => s.setWorkflowViewerVisible
  );
  const setBottomPaneOpen = useUIStore((s) => s.setBottomPaneOpen);
  const setActiveBottomTab = useUIStore((s) => s.setActiveBottomTab);
  const bypassCache = useUIStore((s) => s.bypassCache);
  const setBypassCache = useUIStore((s) => s.setBypassCache);

  // Settings
  const previewRows = useSettingsStore((s) => s.backend.previewRows);

  // Execution state
  const isExecuting = useExecutionStore((s) => s.isExecuting);
  const startExecution = useExecutionStore((s) => s.startExecution);
  const finishExecution = useExecutionStore((s) => s.finishExecution);
  const failExecution = useExecutionStore((s) => s.failExecution);
  const addLog = useExecutionStore((s) => s.addLog);
  const clearLogs = useExecutionStore((s) => s.clearLogs);

  // Execution hook
  const { execute } = useWorkflowExecute();

  // Local state for preview loading and dropdown
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewDropdownOpen, setPreviewDropdownOpen] = useState(false);
  const previewDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (previewDropdownRef.current && !previewDropdownRef.current.contains(event.target as Node)) {
        setPreviewDropdownOpen(false);
      }
    };
    if (previewDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [previewDropdownOpen]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    handleSaveWorkflow,
    handleSaveAsWorkflow,
    handleImportWorkflow,
    handleToggleWorkflowViewer,
    handlePreviewWorkflow,
    handleRunWorkflow,
  }));

  // Listen for menu actions from platform
  useEffect(() => {
    const cleanup = platform.menu.onMenuAction((action, data) => {
      switch (action) {
        case 'new-workflow':
          handleNewWorkflow();
          break;
        case 'open-workflow':
          if (data) {
            // Data is the file path from the menu dialog
            handleOpenWorkflowFromPath(data as string);
          } else {
            handleImportWorkflow();
          }
          break;
        case 'save-workflow':
          handleSaveWorkflow();
          break;
        case 'run-workflow':
          handleRunWorkflow();
          break;
        case 'validate-workflow':
          // Future implementation
          showNotification('Workflow validation not yet implemented', 'info');
          break;
        case 'show-workflow-viewer':
          setWorkflowViewerVisible(true);
          break;
        case 'hide-workflow-viewer':
          setWorkflowViewerVisible(false);
          break;
        case 'toggle-workflow-viewer':
          setWorkflowViewerVisible(!workflowViewerVisible);
          break;
      }
    });

    return cleanup;
  }, []);

  const handleOpenWorkflowFromPath = async (filePath: string) => {
    try {
      // Read file content via platform
      const content = await platform.files.readFile(filePath);

      // Parse JSON workflow file
      const {
        tools: importedTools,
        wires: importedWires,
        meta,
      } = WorkflowSerializer.fromJSON(content);

      // Create new tab with loaded workflow
      const newTabId = createTab(meta.name, {
        tools: importedTools,
        wires: importedWires,
        workflowMeta: meta,
      });

      // Set file path and mark clean (just loaded from disk)
      if (newTabId) {
        setTabFilePath(newTabId, filePath);
        markTabClean(newTabId);
      }

      setSelectedTool(null);

      showNotification(
        `Workflow "${meta.name}" opened successfully!`,
        "success"
      );
    } catch (error) {
      logger.error("Error opening workflow:", error);
      showNotification(
        "Failed to open workflow. Please check the file format.",
        "error"
      );
    }
  };

  const handleNewWorkflow = () => {
    // Create a new tab instead of clearing current one
    createTab("Untitled Workflow");
  };

  const handleImportWorkflow = async () => {
    // Use native dialog if available
    if (hasNativeDialogs()) {
      try {
        const filePath = await platform.files.showOpenDialog({
          filters: [
            { name: "Workflow Files", extensions: ["swwf"] },
            { name: "All Files", extensions: ["*"] },
          ],
          properties: ["openFile"],
        });

        if (!filePath) return;

        // Read file content via platform
        const content = await platform.files.readFile(filePath);

        // Parse JSON workflow file
        const {
          tools: importedTools,
          wires: importedWires,
          meta,
        } = WorkflowSerializer.fromJSON(content);

        // Create new tab with loaded workflow
        const newTabId = createTab(meta.name, {
          tools: importedTools,
          wires: importedWires,
          workflowMeta: meta,
        });

        // Set file path and mark clean (just loaded from disk)
        if (newTabId) {
          setTabFilePath(newTabId, filePath);
          markTabClean(newTabId);
        }

        setSelectedTool(null);

        showNotification(
          `Workflow "${meta.name}" imported successfully!`,
          "success"
        );
      } catch (error) {
        logger.error("Error importing workflow:", error);
        showNotification(
          "Failed to import workflow. Please check the file format.",
          "error"
        );
      }
    } else {
      // Fallback for web browser
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

            // Parse JSON workflow file
            const {
              tools: importedTools,
              wires: importedWires,
              meta,
            } = WorkflowSerializer.fromJSON(content);

            // Create new tab with loaded workflow
            createTab(meta.name, {
              tools: importedTools,
              wires: importedWires,
              workflowMeta: meta,
            });

            setSelectedTool(null);

            showNotification(
              `Workflow "${meta.name}" imported successfully!`,
              "success"
            );
          } catch (error) {
            logger.error("Error importing workflow:", error);
            showNotification(
              "Failed to import workflow. Please check the file format.",
              "error"
            );
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
  };

  const handleSaveWorkflow = async () => {
    if (!activeTabId) return;

    const activeTab = getTabById(activeTabId);
    
    // If tab already has a file path, save to that file
    if (activeTab?.filePath) {
      try {
        const json = WorkflowSerializer.toJSON(tools, wires, workflowMeta);

        if (hasNativeDialogs()) {
          await platform.files.writeFile(activeTab.filePath, json);
          markTabClean(activeTabId);
          showNotification("Workflow saved successfully!", "success");
        } else {
          // Fallback: trigger Save As
          handleSaveAsWorkflow();
        }
      } catch (error) {
        logger.error("Save error:", error);
        showNotification("Failed to save workflow", "error");
      }
    } else {
      // No file path yet, trigger Save As
      handleSaveAsWorkflow();
    }
  };

  const handleSaveAsWorkflow = async () => {
    if (!activeTabId) return;

    try {
      const json = WorkflowSerializer.toJSON(tools, wires, workflowMeta);

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

      // Use native save dialog if available
      if (hasNativeDialogs()) {
        const filePath = await platform.files.showSaveDialog({
          defaultPath: `${baseName}.swwf`,
          filters: [
            { name: "Workflow Files", extensions: ["swwf"] },
            { name: "All Files", extensions: ["*"] },
          ],
        });

        if (filePath) {
          await platform.files.writeFile(filePath, json);
          setTabFilePath(activeTabId, filePath);
          markTabClean(activeTabId);
          showNotification("Workflow saved successfully!", "success");
        }
      } else {
        // Fallback for web browser
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.swwf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification("Workflow saved successfully!", "success");
      }
    } catch (error) {
      logger.error("Save error:", error);
      showNotification("Failed to save workflow", "error");
    }
  };

  const handleToggleWorkflowViewer = () => {
    setWorkflowViewerVisible(!workflowViewerVisible);
  };

  const handlePreviewWorkflow = async () => {
    try {
      // Validate workflow has tools
      if (tools.length === 0) {
        showNotification("Cannot preview empty workflow", "error");
        return;
      }

      // Open bottom pane to preview tab
      setBottomPaneOpen(true);
      setActiveBottomTab("preview");

      // Set loading state
      setIsPreviewLoading(true);

      // Serialize workflow
      const workflowJSON = WorkflowSerializer.toJSON(tools, wires, workflowMeta);
      const workflow = JSON.parse(workflowJSON);

      // Resolve database connections before preview all
      const resolvedWorkflow = await resolveWorkflowConnections(workflow);

      // Execute preview all using configured preview rows
      // Pass bypassCache to force_refresh parameter
      const result = await previewAllTools(resolvedWorkflow, previewRows, bypassCache);

      // Cache all previews in the unified cache
      // Transform ToolOutput to expected format (filter out undefined data)
      const previewsForCache: Record<string, { outputs: Record<string, { data: unknown[]; data_schema: unknown }> }> = {};
      for (const [toolId, toolData] of Object.entries(result.tools)) {
        const outputs: Record<string, { data: unknown[]; data_schema: unknown }> = {};
        for (const [socketId, socketData] of Object.entries(toolData.outputs)) {
          if (socketData.data !== undefined) {
            outputs[socketId] = {
              data: socketData.data,
              data_schema: socketData.data_schema,
            };
          }
        }
        if (Object.keys(outputs).length > 0) {
          previewsForCache[toolId] = { outputs };
        }
      }
      cacheAllPreviews(workflow, previewRows, previewsForCache);
      
      setIsPreviewLoading(false);
      showNotification("Previews loaded for all tools!", "success");

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setIsPreviewLoading(false);
      showNotification(`Preview failed: ${message}`, "error");
    }
  };

  const handleClearCache = useCallback(async () => {
    try {
      setPreviewDropdownOpen(false);
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

  const handleRunWorkflow = async () => {
    try {
      // Validate workflow has tools
      if (tools.length === 0) {
        showNotification("Cannot execute empty workflow", "error");
        return;
      }

      // Find output tools
      const outputTools = tools.filter((t) => t.type === "Output");
      if (outputTools.length === 0) {
        showNotification("Workflow must have at least one Output tool", "error");
        return;
      }

      // Clear previous logs and start execution
      clearLogs();
      startExecution();

      // Open bottom pane to logs tab
      setBottomPaneOpen(true);
      setActiveBottomTab("logs");

      // Add initial log
      addLog({
        level: "info",
        message: `Starting workflow execution: ${workflowMeta.name}`,
      });

      // Serialize workflow
      const workflowJSON = WorkflowSerializer.toJSON(tools, wires, workflowMeta);
      const workflow = JSON.parse(workflowJSON);

      addLog({
        level: "info",
        message: `Executing ${tools.length} tools with ${wires.length} connections`,
      });

      // Execute workflow
      await execute(workflow);

      // Success
      addLog({
        level: "success",
        message: "Workflow execution completed successfully",
      });

      finishExecution({ tool_id: "", outputs: {} });
      showNotification("Workflow executed successfully!", "success");

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      
      addLog({
        level: "error",
        message: `Execution failed: ${message}`,
      });

      failExecution(message);
      showNotification(`Execution failed: ${message}`, "error");
    }
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
            <button
              onClick={onShowSettings}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-new-bg border border-theme-header-btn-new-border text-theme-header-btn-new-text
                hover:bg-theme-header-btn-new-bg-hover hover:border-theme-header-btn-new-border-hover hover:text-theme-header-btn-new-text-hover
                active:bg-theme-header-btn-new-bg-active active:border-theme-header-btn-new-border-active active:text-theme-header-btn-new-text-active"
              title="Settings"
            >
              Settings
            </button>

            <div className="w-px h-6 mx-1 opacity-50 bg-theme-header-divider"></div>

            <button
              onClick={handleImportWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-import-bg border border-theme-header-btn-import-border text-theme-header-btn-import-text
                hover:bg-theme-header-btn-import-bg-hover hover:border-theme-header-btn-import-border-hover hover:text-theme-header-btn-import-text-hover
                active:bg-theme-header-btn-import-bg-active active:border-theme-header-btn-import-border-active active:text-theme-header-btn-import-text-active
                disabled:bg-theme-header-btn-import-bg-disabled disabled:border-theme-header-btn-import-border-disabled disabled:text-theme-header-btn-import-text-disabled"
              title="Open Workflow (Ctrl+O)"
            >
              Open
            </button>

            <button
              onClick={handleSaveWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-export-bg border border-theme-header-btn-export-border text-theme-header-btn-export-text
                hover:bg-theme-header-btn-export-bg-hover hover:border-theme-header-btn-export-border-hover hover:text-theme-header-btn-export-text-hover
                active:bg-theme-header-btn-export-bg-active active:border-theme-header-btn-export-border-active active:text-theme-header-btn-export-text-active
                disabled:bg-theme-header-btn-export-bg-disabled disabled:border-theme-header-btn-export-border-disabled disabled:text-theme-header-btn-export-text-disabled"
              title="Save Workflow (Ctrl+S)"
            >
              Save
            </button>

            <button
              onClick={handleSaveAsWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-export-bg border border-theme-header-btn-export-border text-theme-header-btn-export-text
                hover:bg-theme-header-btn-export-bg-hover hover:border-theme-header-btn-export-border-hover hover:text-theme-header-btn-export-text-hover
                active:bg-theme-header-btn-export-bg-active active:border-theme-header-btn-export-border-active active:text-theme-header-btn-export-text-active
                disabled:bg-theme-header-btn-export-bg-disabled disabled:border-theme-header-btn-export-border-disabled disabled:text-theme-header-btn-export-text-disabled"
              title="Save Workflow As... (Ctrl+Shift+S)"
            >
              Save As
            </button>

            <button
              onClick={handleToggleWorkflowViewer}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors border
                ${workflowViewerVisible
                  ? "bg-theme-header-btn-viewcode-bg-active border-theme-header-btn-viewcode-border-active text-theme-header-btn-viewcode-text-active"
                  : "bg-theme-header-btn-viewcode-bg border-theme-header-btn-viewcode-border text-theme-header-btn-viewcode-text"
                }
                hover:bg-theme-header-btn-viewcode-bg-hover hover:border-theme-header-btn-viewcode-border-hover hover:text-theme-header-btn-viewcode-text-hover
                disabled:bg-theme-header-btn-viewcode-bg-disabled disabled:border-theme-header-btn-viewcode-border-disabled disabled:text-theme-header-btn-viewcode-text-disabled`}
              title={workflowViewerVisible ? "Hide Code Viewer (Ctrl+Alt+X)" : "Show Code Viewer (Ctrl+Alt+X)"}
            >
              {workflowViewerVisible ? "Hide Code" : "View Code"}
            </button>

            <div className="w-px h-6 mx-1 opacity-50 bg-theme-header-divider"></div>

            {/* Preview All with dropdown */}
            <div className="relative" ref={previewDropdownRef}>
              <div className="flex">
                <button
                  onClick={handlePreviewWorkflow}
                  disabled={isPreviewLoading}
                  className="px-3 py-1.5 rounded-l text-sm font-medium transition-colors
                    bg-theme-header-btn-preview-bg border border-r-0 border-theme-header-btn-preview-border text-theme-header-btn-preview-text
                    hover:bg-theme-header-btn-preview-bg-hover hover:border-theme-header-btn-preview-border-hover hover:text-theme-header-btn-preview-text-hover
                    active:bg-theme-header-btn-preview-bg-active active:border-theme-header-btn-preview-border-active active:text-theme-header-btn-preview-text-active
                    disabled:bg-theme-header-btn-preview-bg-disabled disabled:border-theme-header-btn-preview-border-disabled disabled:text-theme-header-btn-preview-text-disabled disabled:cursor-not-allowed"
                  title={bypassCache ? "Preview All Tools - Cache Bypassed (Ctrl+P)" : "Preview All Tools (Ctrl+P)"}
                >
                  {isPreviewLoading ? "Loading..." : bypassCache ? "Preview All*" : "Preview All"}
                </button>
                <button
                  onClick={() => setPreviewDropdownOpen(!previewDropdownOpen)}
                  disabled={isPreviewLoading}
                  className="px-1.5 py-1.5 rounded-r text-sm font-medium transition-colors
                    bg-theme-header-btn-preview-bg border border-theme-header-btn-preview-border text-theme-header-btn-preview-text
                    hover:bg-theme-header-btn-preview-bg-hover hover:border-theme-header-btn-preview-border-hover hover:text-theme-header-btn-preview-text-hover
                    active:bg-theme-header-btn-preview-bg-active active:border-theme-header-btn-preview-border-active active:text-theme-header-btn-preview-text-active
                    disabled:bg-theme-header-btn-preview-bg-disabled disabled:border-theme-header-btn-preview-border-disabled disabled:text-theme-header-btn-preview-text-disabled disabled:cursor-not-allowed"
                  title="Preview options"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {/* Dropdown menu */}
              {previewDropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg z-50
                  bg-theme-canvas-bg border border-theme-border-primary">
                  <div className="py-1">
                    {/* Bypass Cache toggle */}
                    <button
                      onClick={() => {
                        setBypassCache(!bypassCache);
                      }}
                      className="w-full px-4 py-2 text-sm text-left flex items-center justify-between
                        text-theme-text-primary hover:bg-theme-panel-section-bg"
                    >
                      <span>Bypass Cache</span>
                      <span className={`w-8 h-4 rounded-full relative transition-colors ${bypassCache ? 'bg-blue-500' : 'bg-gray-400'}`}>
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${bypassCache ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </span>
                    </button>
                    
                    <div className="border-t border-theme-border-primary my-1"></div>
                    
                    {/* Clear Cache action */}
                    <button
                      onClick={handleClearCache}
                      className="w-full px-4 py-2 text-sm text-left
                        text-theme-text-primary hover:bg-theme-panel-section-bg"
                    >
                      Clear Backend Cache
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleRunWorkflow}
              disabled={isExecuting}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-run-bg border border-theme-header-btn-run-border text-theme-header-btn-run-text
                hover:bg-theme-header-btn-run-bg-hover hover:border-theme-header-btn-run-border-hover hover:text-theme-header-btn-run-text-hover
                active:bg-theme-header-btn-run-bg-active active:border-theme-header-btn-run-border-active active:text-theme-header-btn-run-text-active
                disabled:bg-theme-header-btn-run-bg-disabled disabled:border-theme-header-btn-run-border-disabled disabled:text-theme-header-btn-run-text-disabled disabled:cursor-not-allowed"
              title="Run Workflow (F5)"
            >
              {isExecuting ? "Running..." : "Run"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});

Header.displayName = "Header";

export default Header;
