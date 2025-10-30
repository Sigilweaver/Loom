import { CSVMode } from "@domain/dataSources/csv";
import { CSVOutputMode } from "@domain/dataSources/csvOutput";
import { ParquetMode } from "@domain/dataSources/parquet";
import { ParquetOutputMode } from "@domain/dataSources/parquetOutput";
import { useHistoryStore } from "@state/historyStore";
import { useWorkflowStore } from "@state/workflowStore";
import { ToolConfig } from "../domain/workflow/entities/workflow";
import { ConfigTestingPanel } from "./ConfigTestingPanel";
import ConfigurationHeader from "./ConfigurationHeader";
import { CsvConfiguration } from "./CsvConfiguration";
import { CsvOutputConfiguration } from "./CsvOutputConfiguration";
import { ParquetConfiguration } from "./ParquetConfiguration";
import { ParquetOutputConfiguration } from "./ParquetOutputConfiguration";
import { DataSourceSelector } from "./DataSourceSelector";
import { FilterConfiguration } from "./FilterConfiguration";
import { FormulaConfiguration } from "./FormulaConfiguration";
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

  const pushState = useHistoryStore((s) => s.pushState);

  // Handler functions
  const handleWorkflowMetaChange = (meta: {
    name: string;
    description: string;
    author: string;
  }) => {
    // Save current state before change
    pushState(tools, wires, workflowMeta);

    // Update meta in store
    updateWorkflowMeta(meta);
  };

  const handleToolConfigChange = (toolId: string, config: ToolConfig) => {
    // Save current state before change
    pushState(tools, wires, workflowMeta);

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
                  // CSV with mode selection
                  const dataSourceWithMode = dataSource as typeof dataSource & {
                    selectedMode?: string;
                  };
                  const selectedMode =
                    dataSourceWithMode.selectedMode || "scan"; // Default to scan mode
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "csv" as const,
                    csvMode: selectedMode,
                  };
                  // Preserve existing file path if any
                  const existingFilePath = selectedTool.config?.filePath;
                  if (
                    existingFilePath !== undefined &&
                    existingFilePath !== null
                  ) {
                    newConfig.filePath = existingFilePath;
                  }
                  handleToolConfigChange(selectedTool.id, newConfig);
                } else if (dataSource.id === "parquet") {
                  // Parquet with mode selection
                  const dataSourceWithMode = dataSource as typeof dataSource & {
                    selectedMode?: string;
                  };
                  const selectedMode =
                    dataSourceWithMode.selectedMode || "scan"; // Default to scan mode
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "parquet" as const,
                    parquetMode: selectedMode,
                  };
                  // Preserve existing file path if any
                  const existingFilePath = selectedTool.config?.filePath;
                  if (
                    existingFilePath !== undefined &&
                    existingFilePath !== null
                  ) {
                    newConfig.filePath = existingFilePath;
                  }
                  handleToolConfigChange(selectedTool.id, newConfig);
                }
              }}
              selectedId={selectedTool.config?.type as string}
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "csv" ? (
            /* CSV Configuration Panel */
            <CsvConfiguration
              mode={(selectedTool.config.csvMode as CSVMode) || "scan"}
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "parquet" ? (
            /* Parquet Configuration Panel */
            <ParquetConfiguration
              mode={(selectedTool.config.parquetMode as ParquetMode) || "scan"}
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
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
      ) : selectedTool.type === "Output" ? (
        /* Output Tool Configuration */
        <div className="flex-1 overflow-hidden">
          {/* Show data source selector if no type selected */}
          {!selectedTool.config?.type ? (
            <DataSourceSelector
              onSelect={(dataSource) => {
                if (dataSource.id === "csv") {
                  // CSV with mode selection (default to sink)
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "csv" as const,
                    csvMode: "sink", // Default to streaming mode
                  };
                  handleToolConfigChange(selectedTool.id, newConfig);
                } else if (dataSource.id === "parquet") {
                  // Parquet with mode selection (default to sink)
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "parquet" as const,
                    parquetMode: "sink", // Default to streaming mode
                  };
                  handleToolConfigChange(selectedTool.id, newConfig);
                }
              }}
              selectedId={selectedTool.config?.type as string}
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "csv" ? (
            /* CSV Output Configuration Panel */
            <CsvOutputConfiguration
              mode={(selectedTool.config.csvMode as CSVOutputMode) || "sink"}
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "parquet" ? (
            /* Parquet Output Configuration Panel */
            <ParquetOutputConfiguration
              mode={(selectedTool.config.parquetMode as ParquetOutputMode) || "sink"}
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
          ) : (
            /* Other output types */
            <div className="p-4 text-center text-theme-text-tertiary">
              <div className="text-sm">
                Configuration for {String(selectedTool.config.type)} output not yet
                implemented
              </div>
              <div className="mt-2 text-xs text-theme-text-disabled">
                Coming soon...
              </div>
            </div>
          )}
        </div>
      ) : selectedTool.type === "Filter" ? (
        /* Filter Tool Configuration */
        <div className="flex-1 overflow-hidden">
          <FilterConfiguration
            config={selectedTool.config}
            onChange={(config) => handleToolConfigChange(selectedTool.id, config)}
          />
        </div>
      ) : selectedTool.type === "Formula" ? (
        /* Formula Tool Configuration */
        <div className="flex-1 overflow-hidden">
          <FormulaConfiguration
            config={selectedTool.config}
            onChange={(config) => handleToolConfigChange(selectedTool.id, config)}
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
