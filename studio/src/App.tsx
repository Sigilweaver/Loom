import { useHistoryStore } from "@state/historyStore";
import { startNotificationAutoHide, useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { useTabStore } from "@state/tabStore";
import { useSettingsStore } from "@state/settingsStore";
import { useConnectionStore } from "@state/connectionStore";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useRef } from "react";
import Canvas, { CanvasRef } from "./components/Canvas";
import ErrorBoundary from "./components/ErrorBoundary";
import LeftPane from "./components/LeftPane";
import Header, { HeaderRef } from "./components/shell/Header";
import Notification from "./components/shell/Notification";
import BottomPane from "./components/shell/BottomPane";
import TabBar from "./components/shell/TabBar";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TooltipProvider } from "./components/ui/Tooltip";
import { initializeAuth } from "./api/backend";
import { useAIStore } from "@state/aiStore";
import { closeAllWorkflowCaches } from "./api/cache";
import { initHubClient, hasHubClient } from "./api/hub";
import { triggerHubConnectionsRefresh } from "./hooks/useAllConnections";
import { useValidationSync } from "./hooks/useValidationSync";

function App() {
  // Keep validation results current while they are shown
  useValidationSync();

  const loadSettings = useSettingsStore(s => s.loadSettings);
  const loadConnections = useConnectionStore(s => s.loadConnections);
  const setLeftPaneTab = useUIStore((s) => s.setLeftPaneTab);
  const setSelectedTool = useWorkflowStore((s) => s.setSelectedTool);
  // Zustand stores - primary state
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);

  // Tab store
  const createTab = useTabStore((s) => s.createTab);
  const saveCurrentTab = useTabStore((s) => s.saveCurrentTab);

  // History store
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo());
  const canRedo = useHistoryStore((s) => s.canRedo());

  // Canvas ref for calling fitView
  const canvasRef = useRef<CanvasRef>(null);
  // Header ref for calling save methods
  const headerRef = useRef<HeaderRef>(null);

  // UI notifications and state via store
  const showNotification = useUIStore((s) => s.showNotification);

  // Load settings on mount and sync with uiStore, then create initial tab
  useEffect(() => {
    const initSettings = async () => {
      // Initialize auth token before any API calls
      await initializeAuth();

      await loadSettings();

      // Sync settings with uiStore on load
      const settings = useSettingsStore.getState();
      const { snapToGrid, minimapVisible, minimapPosition } = useUIStore.getState();

      // Only toggle if different to avoid unnecessary updates
      if (settings.ui.snapToGrid !== snapToGrid) {
        useUIStore.getState().toggleSnapToGrid();
      }
      if (settings.ui.minimapVisible !== minimapVisible) {
        useUIStore.getState().toggleMinimap();
      }
      if (settings.ui.minimapPosition !== minimapPosition) {
        useUIStore.getState().setMinimapPosition(settings.ui.minimapPosition);
      }

      // Initialize Hub client if we have a persisted session
      // This ensures Hub connections are available immediately on app startup
      if (settings.executionMode === 'hub' && settings.hub.sessionToken && settings.hub.url) {
        if (!hasHubClient()) {
          initHubClient({
            url: settings.hub.url,
            sessionToken: settings.hub.sessionToken,
          });
          // Trigger Hub connections refresh now that client is ready
          triggerHubConnectionsRefresh();
        }
      }

      // Create initial tab AFTER settings are loaded
      const tabs = useTabStore.getState().tabs;
      if (tabs.length === 0) {
        createTab("Untitled Workflow");
      }

      // Load AI settings
      useAIStore.getState().loadAISettings();
    };

    initSettings();
  }, [loadSettings, createTab]);

  // Load connections on mount (after auth is initialized)
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Save current tab and close all caches before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save current tab state
      saveCurrentTab();

      // Close all workflow caches on the backend
      const { tabs, tabData } = useTabStore.getState();
      const workflowIds = tabs
        .map((t) => tabData[t.id]?.workflow?.workflowMeta?.workflowId)
        .filter((id): id is string => !!id);

      closeAllWorkflowCaches(workflowIds);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveCurrentTab]);

  // Listen for open-settings custom event (e.g., from PostgresqlConfiguration)
  // Now just switches to the Settings tab in the left pane
  useEffect(() => {
    const handleOpenSettings = () => {
      // Deselect any tool to show the left pane tabs
      setSelectedTool(null);
      // Switch to settings tab
      setLeftPaneTab('settings');
    };
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, [setSelectedTool, setLeftPaneTab]);

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

  // Tab keyboard shortcuts
  useEffect(() => {
    const handleTabShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      const mod = e.metaKey || e.ctrlKey;

      // Ctrl+T: New tab
      if (mod && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        createTab("Untitled Workflow");
        showNotification("New tab created", "info");
      }

      // Ctrl+W: Close tab
      if (mod && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        const activeTabId = useTabStore.getState().activeTabId;
        if (activeTabId) {
          const closeTab = useTabStore.getState().closeTab;
          const closed = closeTab(activeTabId);
          if (closed) {
            showNotification("Tab closed", "info");
          }
        }
      }

      // Ctrl+Tab or Ctrl+Shift+Tab: Switch tabs
      if (mod && e.key === "Tab") {
        e.preventDefault();
        const currentTabs = useTabStore.getState().tabs;
        const activeTabId = useTabStore.getState().activeTabId;
        const switchTab = useTabStore.getState().switchTab;

        if (currentTabs.length <= 1) return;

        const currentIndex = currentTabs.findIndex(t => t.id === activeTabId);
        if (currentIndex === -1) return;

        let nextIndex: number;
        if (e.shiftKey) {
          // Shift+Tab: Previous tab
          nextIndex = currentIndex > 0 ? currentIndex - 1 : currentTabs.length - 1;
        } else {
          // Tab: Next tab
          nextIndex = (currentIndex + 1) % currentTabs.length;
        }

        const nextTab = currentTabs[nextIndex];
        if (nextTab) {
          switchTab(nextTab.id);
        }
      }
    };

    window.addEventListener("keydown", handleTabShortcuts);
    return () => window.removeEventListener("keydown", handleTabShortcuts);
  }, [createTab, showNotification]);

  // Save and workflow keyboard shortcuts
  useEffect(() => {
    const handleWorkflowShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      const mod = e.metaKey || e.ctrlKey;

      // Ctrl+S: Save
      if (mod && (e.key === "s" || e.key === "S") && !e.shiftKey) {
        e.preventDefault();
        headerRef.current?.handleSaveWorkflow();
      }

      // Ctrl+Shift+S: Save As
      if (mod && (e.key === "s" || e.key === "S") && e.shiftKey) {
        e.preventDefault();
        headerRef.current?.handleSaveAsWorkflow();
      }

      // Ctrl+O: Open Workflow
      if (mod && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        headerRef.current?.handleImportWorkflow();
      }

      // Ctrl+P: Preview All Tools
      if (mod && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        headerRef.current?.handlePreviewWorkflow();
      }

      // Ctrl+Alt+X: Toggle Code Viewer
      if (mod && e.altKey && (e.key === "x" || e.key === "X")) {
        e.preventDefault();
        headerRef.current?.handleToggleWorkflowViewer();
      }

      // F5: Run Workflow
      if (e.key === "F5") {
        e.preventDefault();
        headerRef.current?.handleRunWorkflow();
      }
    };

    window.addEventListener("keydown", handleWorkflowShortcuts);
    return () => window.removeEventListener("keydown", handleWorkflowShortcuts);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <div className="flex flex-col h-screen bg-theme-surface-page">
            <Header ref={headerRef} />

            <div className="flex flex-1 overflow-hidden">
              {/* Left Pane - Tool Palette and Configuration */}
              <LeftPane />

              {/* Main Content Area */}
              <ReactFlowProvider>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <TabBar />
                  <Canvas ref={canvasRef} />
                  <BottomPane />
                </div>
              </ReactFlowProvider>
            </div>

            {/* Notification System - uses uiStore internally */}
            <Notification />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
