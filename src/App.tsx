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
import { ToolCategory } from "./domain/workflow/entities/workflow";
import { WorkflowSerializer } from "./domain/workflow/services/WorkflowSerializer";

function App() {
  const [activeTab, setActiveTab] = useState<ToolCategory>("favorites");

  // Zustand stores - primary state
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);

  // History store
  const saveSnapshot = useHistoryStore((s) => s.saveSnapshot);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo());
  const canRedo = useHistoryStore((s) => s.canRedo());

  // Canvas ref for calling fitView
  const canvasRef = useRef<CanvasRef>(null);

  // UI notifications and state via store
  const notification = useUIStore((s) => s.notification);
  const showNotification = useUIStore((s) => s.showNotification);
  const hideNotification = useUIStore((s) => s.hideNotification);
  const xmlViewerVisible = useUIStore((s) => s.xmlViewerVisible);
  const setXmlViewerVisible = useUIStore((s) => s.setXmlViewerVisible);
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

  // Memoize JSON serialization - only recompute when workflow data changes
  const workflowJSON = useMemo(
    () => WorkflowSerializer.toJSON(tools, wires, workflowMeta),
    [tools, wires, workflowMeta]
  );

  return (
    <ThemeProvider>
      <div className="h-screen flex flex-col bg-theme-surface-page">
        <Header />

        <ToolPalette activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 flex overflow-hidden">
          {/* Configuration Panel - Left Side */}
          <ConfigurationPanel />

          <ReactFlowProvider>
            <div className="flex-1 flex">
              <Canvas ref={canvasRef} />

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
