import { useHistoryStore } from "@state/historyStore";
import {
  useToolCount,
  useWireCount,
  useWorkflowStore,
} from "@state/workflowStore";
import { useTabStore } from "@state/tabStore";
import { createLogger } from "@utils/logger";
import { ToolConfig } from "../domain/workflow/entities/workflow";
// Error boundary for configuration panels
import { ConfigErrorBoundary } from "./ConfigErrorBoundary";
import { SourceConfigurationPanel } from "./config/inout/SourceConfigurationPanel";
// Shell components
import ToolHeader from "./ToolHeader";
import ToolCommentEditor from "./workflow/ToolCommentEditor";
import ResizablePanel from "./shell/ResizablePanel";
import ToolPalette from "./shell/ToolPalette";
import SettingsPane from "./shell/SettingsPane";
// Workflow components
import WorkflowConfiguration from "./workflow/WorkflowConfiguration";
import WorkflowViewer from "./workflow/WorkflowViewer";
import AIChatPanel from "./ai/AIChatPanel";
import { Settings, LayoutGrid, Sliders, Sparkles } from "lucide-react";
import { getToolConfigEntry } from "@data/toolConfigComponents";
import { useUIStore } from "@state/uiStore";
import { useAIStore } from "@state/aiStore";

const logger = createLogger('LeftPane');

export default function LeftPane() {
  // Access stores directly
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  // Count-only selectors for the summary chips so position/config
  // edits on individual tools do not re-render the entire left pane.
  const toolCount = useToolCount();
  const wireCount = useWireCount();
  // The full tools/wires arrays are still needed when a workflow-aware
  // config panel is mounted (Filter, Formula, Join, etc) and when the
  // history snapshot helper fires below. We subscribe to them so the
  // mounted config panel updates when upstream tools change.
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  const updateWorkflowMeta = useWorkflowStore((s) => s.updateWorkflowMeta);
  const leftPaneTab = useUIStore((s) => s.leftPaneTab);
  const setLeftPaneTab = useUIStore((s) => s.setLeftPaneTab);
  const aiEnabled = useAIStore((s) => s.enabled);
  const updateToolConfiguration = useWorkflowStore(
    (s) => s.updateToolConfiguration
  );
  const updateToolComment = useWorkflowStore((s) => s.updateToolComment);

  const pushState = useHistoryStore((s) => s.pushState);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const markTabDirty = useTabStore((s) => s.markTabDirty);

  // Snapshot helper reads fresh state from the store at call
  // time so handlers stay stable across renders.
  const snapshotForHistory = () => {
    const s = useWorkflowStore.getState();
    pushState(s.tools, s.wires, s.workflowMeta);
  };

  // Handler functions
  const handleWorkflowMetaChange = (meta: {
    name: string;
    description: string;
    author: string;
  }) => {
    logger.info("Workflow metadata updated:", meta.name);
    snapshotForHistory();

    // Update meta in store
    updateWorkflowMeta(meta);

    // Mark tab as dirty
    if (activeTabId) {
      markTabDirty(activeTabId);
    }
  };

  const handleToolConfigChange = (toolId: string, config: ToolConfig) => {
    logger.debug("Tool configuration updated:", toolId);
    snapshotForHistory();

    // Update configuration in store
    updateToolConfiguration(toolId, config);

    // Mark tab as dirty
    if (activeTabId) {
      markTabDirty(activeTabId);
    }
  };

  const handleToolCommentChange = (toolId: string, comment: string | undefined) => {
    snapshotForHistory();
    updateToolComment(toolId, comment);
    if (activeTabId) {
      markTabDirty(activeTabId);
    }
  };

  // Show tool palette / workflow configuration if no tool is selected
  if (!selectedTool) {
    return (
      <ResizablePanel
        defaultWidth={450}
        minWidth={320}
        maxWidth={800}
        className="h-full flex flex-col border-r bg-theme-surface-panel border-theme-border-primary"
      >
        {/* Tab Selector */}
        <div className="bg-theme-surface-elevated border-b border-theme-border-primary p-2">
          <div className="w-full bg-theme-surface-panel rounded-lg p-1 gap-1 flex">
            <button
              onClick={() => setLeftPaneTab("tools")}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${leftPaneTab === "tools"
                ? "bg-theme-surface-elevated text-theme-interactive-accent"
                : "text-theme-text-secondary hover:text-theme-text-primary"
                }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Tools</span>
            </button>
            <button
              onClick={() => setLeftPaneTab("workflow")}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${leftPaneTab === "workflow"
                ? "bg-theme-surface-elevated text-theme-interactive-accent"
                : "text-theme-text-secondary hover:text-theme-text-primary"
                }`}
            >
              <Settings className="w-4 h-4" />
              <span>Workflow</span>
            </button>
            <button
              onClick={() => setLeftPaneTab("settings")}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${leftPaneTab === "settings"
                ? "bg-theme-surface-elevated text-theme-interactive-accent"
                : "text-theme-text-secondary hover:text-theme-text-primary"
                }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Settings</span>
            </button>
            {aiEnabled && (
              <button
                onClick={() => setLeftPaneTab("ai")}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${leftPaneTab === "ai"
                  ? "bg-theme-surface-elevated text-theme-interactive-accent"
                  : "text-theme-text-secondary hover:text-theme-text-primary"
                  }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>AI</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {leftPaneTab === "tools" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ToolPalette />
          </div>
        ) : leftPaneTab === "settings" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <SettingsPane />
          </div>
        ) : leftPaneTab === "ai" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <AIChatPanel onClose={() => setLeftPaneTab('tools')} embedded />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden overflow-y-auto">
            {/* Workflow Configuration Header */}
            <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
              <div className="flex items-center space-x-3">
                <Settings className="w-6 h-6 text-theme-text-primary" />
                <div>
                  <h2 className="text-lg font-semibold text-theme-text-primary">
                    Workflow Configuration
                  </h2>
                  <p className="text-sm text-theme-text-tertiary">
                    General workflow settings
                  </p>
                </div>
              </div>
            </div>

            {/* Workflow Configuration Content */}
            <div className="p-4">
              <WorkflowConfiguration
                workflowMeta={workflowMeta}
                toolCount={toolCount}
                wireCount={wireCount}
                onWorkflowMetaChange={handleWorkflowMetaChange}
              />
            </div>

            {/* Code Viewer */}
            <div className="flex-1 min-h-[200px] border-t border-theme-border-primary">
              <WorkflowViewer />
            </div>
          </div>
        )}
      </ResizablePanel>
    );
  }

  // Show tool configuration when a tool is selected
  return (
    <ResizablePanel
      defaultWidth={450}
      minWidth={320}
      maxWidth={800}
      className="h-full flex flex-col border-r bg-theme-surface-panel border-theme-border-primary"
    >
      <ToolHeader tool={selectedTool} />
      <ToolCommentEditor tool={selectedTool} onCommentChange={handleToolCommentChange} />

      {/* Input and output source configuration */}
      {selectedTool.type === "Input" || selectedTool.type === "Output" ? (
        <ConfigErrorBoundary componentName={`${selectedTool.type} Configuration`}>
          <div className="flex-1 overflow-hidden">
            <SourceConfigurationPanel
              operation={selectedTool.type === "Input" ? "input" : "output"}
              config={selectedTool.config}
              onChange={(config) => handleToolConfigChange(selectedTool.id, config)}
            />
          </div>
        </ConfigErrorBoundary>
      ) : (() => {
        // Use registry for non-Input/Output tools
        const configEntry = getToolConfigEntry(selectedTool.type);
        if (configEntry) {
          // Use discriminated union - TypeScript narrows based on needsWorkflowContext
          if (configEntry.needsWorkflowContext) {
            const ConfigComponent = configEntry.component;
            return (
              <div className="flex-1 overflow-hidden">
                <ConfigComponent
                  config={selectedTool.config}
                  onChange={(config: ToolConfig) => handleToolConfigChange(selectedTool.id, config)}
                  toolId={selectedTool.id}
                  tools={tools}
                  wires={wires}
                  workflowMeta={workflowMeta}
                />
              </div>
            );
          } else {
            const ConfigComponent = configEntry.component;
            return (
              <div className="flex-1 overflow-hidden">
                <ConfigComponent
                  config={selectedTool.config}
                  onChange={(config: ToolConfig) => handleToolConfigChange(selectedTool.id, config)}
                />
              </div>
            );
          }
        }
        // Default placeholder for tools without configuration
        return (
          <div className="p-4 text-center text-theme-text-tertiary">
            <div className="text-sm">
              Configuration not available for {selectedTool.type} tools
            </div>
            <div className="mt-2 text-xs text-theme-text-disabled">
              Coming soon...
            </div>
          </div>
        );
      })()}
    </ResizablePanel>
  );
}
