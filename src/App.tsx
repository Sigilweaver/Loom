import { useHistoryStore } from "@state/historyStore";
import { startNotificationAutoHide, useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Canvas, { CanvasRef } from "./components/Canvas";
import ConfigurationPanel from "./components/ConfigurationPanel";
import Header from "./components/Header";
import Notification from "./components/Notification";
import ToolPalette from "./components/ToolPalette";
import XMLViewer from "./components/XMLViewer";
import { ThemeProvider } from "./contexts/ThemeContext";
import { getToolDefinition } from "./data/tools";
import {
  Tool,
  ToolCategory,
  ToolConfig,
  Wire,
} from "./domain/workflow/entities/workflow";
import { WorkflowSerializer } from "./domain/workflow/services/WorkflowSerializer";
import { generateUniqueId } from "./utils/id";

function App() {
  const [activeTab, setActiveTab] = useState<ToolCategory>("favorites");
  const [xmlViewerVisible, setXmlViewerVisible] = useState(false);

  // Zustand stores - primary state
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  const edges = useWorkflowStore((s) => s.edges);
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  const updateWorkflowMeta = useWorkflowStore((s) => s.updateWorkflowMeta);
  const addTool = useWorkflowStore((s) => s.addTool);
  const removeTool = useWorkflowStore((s) => s.removeTool);
  const updateToolPosition = useWorkflowStore((s) => s.updateToolPosition);
  const updateToolConfiguration = useWorkflowStore(
    (s) => s.updateToolConfiguration
  );
  const addWire = useWorkflowStore((s) => s.addWire);
  const removeWire = useWorkflowStore((s) => s.removeWire);
  const batchAddToolsAndWires = useWorkflowStore(
    (s) => s.batchAddToolsAndWires
  );
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);

  // History store
  const saveSnapshot = useHistoryStore((s) => s.saveSnapshot);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo());
  const canRedo = useHistoryStore((s) => s.canRedo());

  // Canvas ref for calling fitView
  const canvasRef = useRef<CanvasRef>(null);

  // UI notifications via store
  const notification = useUIStore((s) => s.notification);
  const showNotification = useUIStore((s) => s.showNotification);
  const hideNotification = useUIStore((s) => s.hideNotification);
  useEffect(() => {
    startNotificationAutoHide();
  }, []);

  // Initialize with empty workflow and first snapshot
  useEffect(() => {
    // Save initial snapshot for undo/redo
    saveSnapshot(tools, wires, workflowMeta);
  }, []); // Only run once on mount

  // Global undo/redo shortcuts (when not typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      const isUndoKey =
        (e.key === "z" || e.key === "Z") &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey;
      const isRedoKey =
        ((e.key === "z" || e.key === "Z") &&
          (e.ctrlKey || e.metaKey) &&
          e.shiftKey) ||
        ((e.key === "y" || e.key === "Y") && (e.ctrlKey || e.metaKey));

      if (!isUndoKey && !isRedoKey) return;
      e.preventDefault();

      if (isUndoKey && canUndo) {
        const snapshot = undo();
        if (snapshot) {
          loadWorkflow(snapshot.tools, snapshot.wires, snapshot.meta);
          setSelectedTool(null);
          showNotification("Undo successful", "info");
        }
      } else if (isRedoKey && canRedo) {
        const snapshot = redo();
        if (snapshot) {
          loadWorkflow(snapshot.tools, snapshot.wires, snapshot.meta);
          setSelectedTool(null);
          showNotification("Redo successful", "info");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    loadWorkflow,
    setSelectedTool,
    showNotification,
  ]);

  const handleToolSelect = (tool: Tool | null) => {
    setSelectedTool(tool);
  };

  // Workflow meta update function
  const handleWorkflowMetaChange = (meta: {
    name: string;
    description: string;
    author: string;
  }) => {
    // Save snapshot before change
    saveSnapshot(tools, wires, workflowMeta);

    // Update meta in store
    updateWorkflowMeta(meta);
  };

  // Tool configuration update function
  const handleToolConfigChange = (toolId: string, config: ToolConfig) => {
    // Save snapshot before change
    saveSnapshot(tools, wires, workflowMeta);

    // Update configuration in store
    updateToolConfiguration(toolId, config);
  };

  const handleNewWorkflow = () => {
    // Save snapshot before clearing
    saveSnapshot(tools, wires, workflowMeta);

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

          // Save snapshot before import
          saveSnapshot(tools, wires, workflowMeta);

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

          // Fit the view to show the entire imported workflow
          setTimeout(() => {
            canvasRef.current?.fitView();
          }, 100);
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

  const handlePreviewWorkflow = () => {
    showNotification(
      "Preview functionality will show expected workflow output and flow analysis. Coming soon!",
      "info"
    );
  };

  // Batch add for paste operations
  const handleBatchAddToolsAndWires = (
    toolAdds: { id: string; type: string; x: number; y: number }[],
    wiresToAdd: Wire[]
  ) => {
    try {
      // Save snapshot before batch add
      saveSnapshot(tools, wires, workflowMeta);

      // Build tools array
      const newTools: Tool[] = [];
      for (const ta of toolAdds) {
        const definition = getToolDefinition(ta.type);
        if (!definition) continue;
        const newTool: Tool = {
          id: ta.id,
          type: ta.type,
          x: ta.x,
          y: ta.y,
          config: { ...definition.defaultConfig },
          sockets: [...definition.sockets],
        };
        newTools.push(newTool);
      }

      // Use store batch operation
      batchAddToolsAndWires(newTools, wiresToAdd);
    } catch (e) {
      showNotification("Failed to paste tools/wires", "error");
    }
  };

  const handleAddTool = (
    toolType: string,
    x: number,
    y: number,
    idOverride?: string
  ) => {
    const definition = getToolDefinition(toolType);
    if (!definition) return;

    // Save snapshot before adding
    saveSnapshot(tools, wires, workflowMeta);

    const newTool: Tool = {
      id: idOverride ?? generateUniqueId(new Set(tools.map((t) => t.id)), 8),
      type: toolType,
      x,
      y,
      config: { ...definition.defaultConfig },
      sockets: [...definition.sockets],
    };

    addTool(newTool);
  };

  // Copy/paste operations (simplified for now - will implement JSON clipboard later)
  const buildCopyFragment = (_selectedIds: string[]): string => {
    // TODO: Implement JSON-based clipboard
    return "";
  };

  const pasteFragmentAt = async (
    _anchor: { x: number; y: number },
    _fragment: string
  ): Promise<string[]> => {
    // TODO: Implement JSON-based clipboard
    return [];
  };

  const handleAddWire = (
    from: { tool: string; socket: number },
    to: { tool: string; socket: number }
  ) => {
    const newWire: Wire = { from, to };

    try {
      // Save snapshot before adding wire
      saveSnapshot(tools, wires, workflowMeta);

      // Add wire through store (validation happens there)
      const result = addWire(newWire);

      // Only show notification on error
      if (!result.success && result.error) {
        showNotification(result.error, "error");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create connection";
      showNotification(message, "error");
    }
  };

  const handleRemoveWire = (wireId: string) => {
    try {
      // Parse edge ID back into from/to
      // Edge ID format: "fromTool_fromSocket_toTool_toSocket"
      const parts = wireId.split("_");
      if (
        parts.length !== 4 ||
        !parts[0] ||
        !parts[1] ||
        !parts[2] ||
        !parts[3]
      ) {
        showNotification("Invalid wire ID format", "error");
        return;
      }

      const from = {
        tool: decodeURIComponent(parts[0]),
        socket: parseInt(parts[1], 10),
      };
      const to = {
        tool: decodeURIComponent(parts[2]),
        socket: parseInt(parts[3], 10),
      };

      // Save snapshot before removing
      saveSnapshot(tools, wires, workflowMeta);

      // Remove wire through store
      removeWire(from, to);

      showNotification("Connection removed", "success");
    } catch (error) {
      showNotification("Failed to remove connection", "error");
    }
  };

  const handleRemoveTool = (toolId: string) => {
    // Save snapshot before removing
    saveSnapshot(tools, wires, workflowMeta);

    // Remove tool through store
    removeTool(toolId);
  };

  const handleMoveTool = (toolId: string, x: number, y: number) => {
    // Update position through store (no snapshot - too frequent)
    updateToolPosition(toolId, x, y);
  };

  // Save snapshot after drag ends
  const handleBeginTransaction = () => {
    // Beginning a drag - snapshot will be saved on commit
  };

  const handleCommitTransaction = () => {
    // Drag ended - save snapshot
    saveSnapshot(tools, wires, workflowMeta);
  };

  // Memoize JSON serialization - only recompute when workflow data changes
  const workflowJSON = useMemo(
    () => WorkflowSerializer.toJSON(tools, wires, workflowMeta),
    [tools, wires, workflowMeta]
  );

  return (
    <ThemeProvider>
      <div className="h-screen flex flex-col bg-theme-surface-page">
        <Header
          onNewWorkflow={handleNewWorkflow}
          onImportWorkflow={handleImportWorkflow}
          onExportXML={handleExportWorkflow}
          onShowXMLViewer={() => setXmlViewerVisible(true)}
          onPreviewWorkflow={handlePreviewWorkflow}
          onShowNotification={showNotification}
          workflowMeta={workflowMeta}
        />

        <ToolPalette activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 flex overflow-hidden">
          {/* Configuration Panel - Left Side */}
          <ConfigurationPanel
            selectedTool={selectedTool}
            workflowMeta={workflowMeta}
            toolCount={tools.length}
            wireCount={wires.length}
            onWorkflowMetaChange={handleWorkflowMetaChange}
            onToolConfigChange={handleToolConfigChange}
          />

          <ReactFlowProvider>
            <div className="flex-1 flex">
              <Canvas
                ref={canvasRef}
                tools={tools}
                wires={wires}
                edges={edges}
                onAddTool={handleAddTool}
                onAddWire={handleAddWire}
                onRemoveWire={handleRemoveWire}
                onRemoveTool={handleRemoveTool}
                onToolSelect={handleToolSelect}
                onToolMove={handleMoveTool}
                onBatchAdd={handleBatchAddToolsAndWires}
                onBeginTransaction={handleBeginTransaction}
                onCommitTransaction={handleCommitTransaction}
                onBuildCopyFragment={buildCopyFragment}
                onPasteXMLAt={pasteFragmentAt}
              />

              {/* JSON Viewer Side Panel - uses memoized workflowJSON */}
              {xmlViewerVisible && (
                <XMLViewer
                  isVisible={xmlViewerVisible}
                  xmlContent={workflowJSON}
                  onClose={() => setXmlViewerVisible(false)}
                />
              )}
            </div>
          </ReactFlowProvider>
        </div>

        {/* Notification System */}
        <Notification
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={hideNotification}
          duration={notification.duration}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
