import { useState, useEffect, useCallback } from "react";
import { useUIStore } from "@state/uiStore";
import DataTable from "@components/viewer/DataTable";
import LogViewer from "@components/viewer/LogViewer";
import RuntimeLogViewer from "@components/viewer/RuntimeLogViewer";
import ProfileViewer from "@components/viewer/ProfileViewer";
import ProblemsViewer from "@components/viewer/ProblemsViewer";
import { useValidationStore, runWorkflowValidation } from "@state/validationStore";
import SocketTabs from "@components/viewer/SocketTabs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@components/ui/Tabs";
import { X } from "lucide-react";

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
  const problemCount = useValidationStore((s) => s.issues.length);
  const problemsActive = useValidationStore((s) => s.active);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const newHeight = window.innerHeight - e.clientY;
    setBottomPaneHeight(newHeight);
  }, [setBottomPaneHeight]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      const newHeight = window.innerHeight - touch.clientY;
      setBottomPaneHeight(newHeight);
    }
  }, [setBottomPaneHeight]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);
    document.body.style.cursor = "row-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
      document.body.style.cursor = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  if (!bottomPaneOpen) return null;

  return (
    <div
      style={{ height: `${bottomPaneHeight}px` }}
      className="flex flex-col overflow-hidden border-t bg-theme-surface-panel border-theme-border-primary"
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`h-1 cursor-row-resize transition-colors ${
          isResizing
            ? "bg-theme-border-accent"
            : "bg-transparent hover:bg-theme-border-secondary"
        }`}
      />

      {/* Radix Tabs Container */}
      <Tabs
        value={activeBottomTab}
        onValueChange={(value) => setActiveBottomTab(value as typeof activeBottomTab)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* Header with Tabs */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-theme-surface-elevated border-theme-border-primary">
          <TabsList className="border-b-0 gap-1">
            <TabsTrigger value="preview" className="px-3 py-1.5 rounded border-b-0 data-[state=active]:bg-theme-surface-panel data-[state=active]:border data-[state=active]:border-theme-border-primary">
              Data Preview
            </TabsTrigger>
            <TabsTrigger value="profile" className="px-3 py-1.5 rounded border-b-0 data-[state=active]:bg-theme-surface-panel data-[state=active]:border data-[state=active]:border-theme-border-primary">
              Data Profile
            </TabsTrigger>
            <TabsTrigger value="problems" className="px-3 py-1.5 rounded border-b-0 data-[state=active]:bg-theme-surface-panel data-[state=active]:border data-[state=active]:border-theme-border-primary">
              Problems{problemsActive && problemCount > 0 ? ` (${problemCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="logs" className="px-3 py-1.5 rounded border-b-0 data-[state=active]:bg-theme-surface-panel data-[state=active]:border data-[state=active]:border-theme-border-primary">
              Workflow Logs
            </TabsTrigger>
            <TabsTrigger value="network" className="px-3 py-1.5 rounded border-b-0 data-[state=active]:bg-theme-surface-panel data-[state=active]:border data-[state=active]:border-theme-border-primary">
              Network Logs
            </TabsTrigger>
          </TabsList>

          <button
            onClick={toggleBottomPane}
            className="p-1 rounded transition-colors text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-hover"
            title="Close panel"
          >
            <X className="h-4 w-4" />
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
          <TabsContent value="preview" className="flex-1 p-3 overflow-auto m-0">
            <DataTable />
          </TabsContent>
          <TabsContent value="profile" className="flex-1 p-3 overflow-auto m-0">
            <ProfileViewer />
          </TabsContent>
          <TabsContent value="problems" className="flex-1 p-3 overflow-auto m-0">
            <ProblemsViewer onValidate={runWorkflowValidation} />
          </TabsContent>
          <TabsContent value="logs" className="flex-1 p-3 overflow-auto m-0">
            <LogViewer />
          </TabsContent>
          <TabsContent value="network" className="flex-1 p-3 overflow-auto m-0">
            <RuntimeLogViewer />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default BottomPane;
