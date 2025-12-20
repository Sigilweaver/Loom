import { useState, useEffect } from "react";
import { useUIStore } from "@state/uiStore";
import DataTable from "./DataTable.tsx";
import LogViewer from "./LogViewer.tsx";
import RuntimeLogViewer from "./RuntimeLogViewer.tsx";
import ProfileViewer from "./ProfileViewer.tsx";
import SocketTabs from "./SocketTabs.tsx";

const BottomPane = () => {
  const {
    bottomPaneOpen,
    bottomPaneHeight,
    activeBottomTab,
    setBottomPaneHeight,
    setActiveBottomTab,
    toggleBottomPane,
  } = useUIStore();

  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY;
      setBottomPaneHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "row-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [isResizing, setBottomPaneHeight]);

  if (!bottomPaneOpen) return null;

  return (
    <div
      style={{ height: `${bottomPaneHeight}px` }}
      className="flex flex-col overflow-hidden border-t bg-theme-surface-panel border-theme-border-primary"
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-1 cursor-row-resize transition-colors ${
          isResizing
            ? "bg-theme-border-accent"
            : "bg-transparent hover:bg-theme-border-secondary"
        }`}
      />

      {/* Header with Tabs */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveBottomTab("preview")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              activeBottomTab === "preview"
                ? "bg-theme-surface-panel text-theme-text-primary border border-theme-border-primary"
                : "bg-transparent text-theme-text-secondary border border-transparent hover:bg-theme-surface-panel/50"
            }`}
          >
            Data Preview
          </button>
          <button
            onClick={() => setActiveBottomTab("profile")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              activeBottomTab === "profile"
                ? "bg-theme-surface-panel text-theme-text-primary border border-theme-border-primary"
                : "bg-transparent text-theme-text-secondary border border-transparent hover:bg-theme-surface-panel/50"
            }`}
          >
            Data Profile
          </button>
          <button
            onClick={() => setActiveBottomTab("logs")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              activeBottomTab === "logs"
                ? "bg-theme-surface-panel text-theme-text-primary border border-theme-border-primary"
                : "bg-transparent text-theme-text-secondary border border-transparent hover:bg-theme-surface-panel/50"
            }`}
          >
            Workflow Logs
          </button>
          <button
            onClick={() => setActiveBottomTab("network")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              activeBottomTab === "network"
                ? "bg-theme-surface-panel text-theme-text-primary border border-theme-border-primary"
                : "bg-transparent text-theme-text-secondary border border-transparent hover:bg-theme-surface-panel/50"
            }`}
          >
            Network Logs
          </button>
        </div>

        <button
          onClick={toggleBottomPane}
          className="px-2 py-1 text-lg transition-colors text-theme-text-secondary hover:text-theme-text-primary"
          title="Close panel"
        >
          ×
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Socket Tabs Sidebar - Visible in Data Preview and Profile modes */}
        {(activeBottomTab === "preview" || activeBottomTab === "profile") && (
          <div className="flex-shrink-0 w-30 overflow-y-auto border-r bg-theme-surface-panel border-theme-border-secondary">
            <SocketTabs />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-3 overflow-auto">
          {activeBottomTab === "preview" && <DataTable />}
          {activeBottomTab === "logs" && <LogViewer />}
          {activeBottomTab === "network" && <RuntimeLogViewer />}
          {activeBottomTab === "profile" && <ProfileViewer />}
        </div>
      </div>
    </div>
  );
};

export default BottomPane;
