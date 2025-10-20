import { useHistoryStore } from "@state/historyStore";
import { useWorkflowStore } from "@state/workflowStore";
import { getDefaultCSVConfig } from "../domain/dataSources/csv";
import { ToolConfig } from "../domain/workflow/entities/workflow";
import { ConfigTestingPanel } from "./ConfigTestingPanel";
import ConfigurationHeader from "./ConfigurationHeader";
import { DataSourceSelector } from "./DataSourceSelector";
import ResizablePanel from "./ResizablePanel";
import WorkflowConfiguration from "./WorkflowConfiguration";

export default function ConfigurationPanel() {
  // Access stores directly
  const selectedTool = useWorkflowStore((s) => s.selectedTool);
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);
  const updateWorkflowMeta = useWorkflowStore((s) => s.updateWorkflowMeta);
  const updateToolConfiguration = useWorkflowStore(
    (s) => s.updateToolConfiguration
  );

  const saveSnapshot = useHistoryStore((s) => s.saveSnapshot);

  // Handler functions
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

  const handleToolConfigChange = (toolId: string, config: ToolConfig) => {
    // Save snapshot before change
    saveSnapshot(tools, wires, workflowMeta);

    // Update configuration in store
    updateToolConfiguration(toolId, config);
  };

  const toolCount = tools.length;
  const wireCount = wires.length;
  // Show workflow configuration if no tool is selected
  if (!selectedTool) {
    return (
      <ResizablePanel
        defaultWidth={450}
        minWidth={320}
        maxWidth={800}
        className="flex flex-col border-r bg-theme-surface-panel border-theme-border-primary"
      >
        {/* Workflow Configuration Header */}
        <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">⚙️</div>
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
        <div className="flex-1 p-4 overflow-y-auto">
          <WorkflowConfiguration
            workflowMeta={workflowMeta}
            toolCount={toolCount}
            wireCount={wireCount}
            onWorkflowMetaChange={handleWorkflowMetaChange}
          />
        </div>
      </ResizablePanel>
    );
  }

  // Show basic placeholder for all tools except workflow configuration
  return (
    <ResizablePanel
      defaultWidth={450}
      minWidth={320}
      maxWidth={800}
      className="flex flex-col border-r bg-theme-surface-panel border-theme-border-primary"
    >
      <ConfigurationHeader tool={selectedTool} />

      {/* Input tool configuration */}
      {selectedTool.type === "Input" ? (
        <div className="flex-1 overflow-hidden">
          {/* Show data source selector if no data source selected */}
          {!selectedTool.config?.category ? (
            <DataSourceSelector
              onSelect={(dataSource) => {
                if (dataSource.id === "csv") {
                  const defaultConfig = getDefaultCSVConfig();
                  // Preserve existing file path if any
                  const existingFilePath = selectedTool.config?.filePath;
                  const newConfig: ToolConfig = {
                    category: defaultConfig.category,
                    type: defaultConfig.type,
                  };
                  if (
                    existingFilePath !== undefined &&
                    existingFilePath !== null
                  ) {
                    newConfig.filePath = existingFilePath;
                  }
                  if (
                    defaultConfig.options !== undefined &&
                    defaultConfig.options !== null
                  ) {
                    newConfig.options = defaultConfig.options as Record<
                      string,
                      unknown
                    >;
                  }
                  handleToolConfigChange(selectedTool.id, newConfig);
                }
              }}
              selectedId={selectedTool.config?.type as string}
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "csv" ? (
            /* CSV Configuration Panel - TODO: Build with primitives */
            <div className="p-4 space-y-4">
              <div className="p-3 border rounded-md bg-theme-surface-elevated border-theme-border-primary">
                <div className="flex items-center space-x-3">
                  <div className="text-xl">📄</div>
                  <div>
                    <h3 className="font-medium text-theme-text-primary">
                      CSV Data Source
                    </h3>
                    <p className="text-xs text-theme-text-tertiary">
                      Configuration panel coming soon
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  // Reset to data source selector while preserving file path
                  const currentFilePath = selectedTool.config?.filePath;
                  const newConfig: ToolConfig = {};
                  if (
                    currentFilePath !== undefined &&
                    currentFilePath !== null
                  ) {
                    newConfig.filePath = currentFilePath;
                  }
                  handleToolConfigChange(selectedTool.id, newConfig);
                }}
                className="px-3 py-1 text-xs transition-colors border rounded bg-theme-surface-panel border-theme-border-primary text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-elevated"
              >
                Change Data Source
              </button>
              <div className="text-xs text-theme-text-tertiary">
                The CSV configuration panel will be rebuilt using the new
                primitive components.
              </div>
            </div>
          ) : (
            /* Other data source types */
            <div className="p-4 text-center text-theme-text-tertiary">
              <div className="text-sm">
                Configuration for {String(selectedTool.config.type)} not yet
                implemented
              </div>
              <div className="mt-2 text-xs text-theme-text-disabled">
                Coming soon...
              </div>
            </div>
          )}
        </div>
      ) : selectedTool.type === "ConfigTesting" ? (
        /* Config Testing Tool (Development Only) */
        <div className="flex-1 overflow-hidden">
          <ConfigTestingPanel
            config={selectedTool.config}
            onChange={(config) => {
              handleToolConfigChange(selectedTool.id, config as ToolConfig);
            }}
          />
        </div>
      ) : (
        /* Default placeholder for other tools */
        <div className="p-4 text-center text-theme-text-tertiary">
          <div className="text-sm">
            Configuration not available for {selectedTool.type} tools
          </div>
          <div className="mt-2 text-xs text-theme-text-disabled">
            Coming soon...
          </div>
        </div>
      )}
    </ResizablePanel>
  );
}
