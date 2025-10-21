import { useHistoryStore } from "@state/historyStore";
import { startNotificationAutoHide, useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useRef } from "react";
import Canvas, { CanvasRef } from "./components/Canvas";
import ConfigurationPanel from "./components/ConfigurationPanel";
import Header from "./components/Header";
import Notification from "./components/Notification";
import ToolPalette from "./components/ToolPalette";
import WorkflowViewer from "./components/WorkflowViewer";
import { ThemeProvider } from "./contexts/ThemeContext";

function App() {
  // Zustand stores - primary state
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);

  // History store
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo());
  const canRedo = useHistoryStore((s) => s.canRedo());

  // Canvas ref for calling fitView
  const canvasRef = useRef<CanvasRef>(null);

  // UI notifications and state via store
  const showNotification = useUIStore((s) => s.showNotification);
  const workflowViewerVisible = useUIStore((s) => s.workflowViewerVisible);

  useEffect(() => {
    startNotificationAutoHide();
  }, []);

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

  return (
    <ThemeProvider>
      <div className="h-screen flex flex-col bg-theme-surface-page">
        <Header />

        <ToolPalette />

        <div className="flex-1 flex overflow-hidden">
          {/* Configuration Panel - Left Side */}
          <ConfigurationPanel />

          <ReactFlowProvider>
            <div className="flex-1 flex">
              <Canvas ref={canvasRef} />

              {/* JSON Viewer Side Panel - computes JSON internally */}
              {workflowViewerVisible && <WorkflowViewer />}
            </div>
          </ReactFlowProvider>
        </div>

        {/* Notification System - uses uiStore internally */}
        <Notification />
      </div>
    </ThemeProvider>
  );
}

export default App;
