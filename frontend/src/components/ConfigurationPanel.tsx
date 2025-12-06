import { CSVMode } from "@domain/dataSources/csv";
import { CSVOutputMode } from "@domain/dataSources/csvOutput";
import { IpcMode } from "@domain/dataSources/ipc";
import { IpcOutputMode } from "@domain/dataSources/ipcOutput";
import { JSONMode } from "@domain/dataSources/json";
import { JSONOutputMode } from "@domain/dataSources/jsonOutput";
import { ParquetMode } from "@domain/dataSources/parquet";
import { ParquetOutputMode } from "@domain/dataSources/parquetOutput";
import { useHistoryStore } from "@state/historyStore";
import { useWorkflowStore } from "@state/workflowStore";
import { useTabStore } from "@state/tabStore";
import { createLogger } from "@utils/logger";
import { ToolConfig } from "../domain/workflow/entities/workflow";
import { AvroConfiguration } from "./AvroConfiguration";
import { AvroOutputConfiguration } from "./AvroOutputConfiguration";
import ConfigurationHeader from "./ConfigurationHeader";
import { CsvConfiguration } from "./CsvConfiguration";
import { CsvOutputConfiguration } from "./CsvOutputConfiguration";
import { ExcelConfiguration } from "./ExcelConfiguration";
import { ExcelOutputConfiguration } from "./ExcelOutputConfiguration";
import { IpcConfiguration } from "./IpcConfiguration";
import { IpcOutputConfiguration } from "./IpcOutputConfiguration";
import { JsonConfiguration } from "./JsonConfiguration";
import { JsonOutputConfiguration } from "./JsonOutputConfiguration";
import { OdsConfiguration } from "./OdsConfiguration";
import { ParquetConfiguration } from "./ParquetConfiguration";
import { ParquetOutputConfiguration } from "./ParquetOutputConfiguration";
import { DataSourceSelector } from "./DataSourceSelector";
import { FilterConfiguration } from "./FilterConfiguration";
import { FormulaConfiguration } from "./FormulaConfiguration";
import { JoinConfiguration } from "./JoinConfiguration";
import { SelectConfiguration } from "./SelectConfiguration";
import { SortConfiguration } from "./SortConfiguration";
import { SummarizeConfiguration } from "./SummarizeConfiguration";
import { UnionConfiguration } from "./UnionConfiguration";
import ResizablePanel from "./ResizablePanel";
import WorkflowConfiguration from "./WorkflowConfiguration";
import { Settings } from "lucide-react";

const logger = createLogger('ConfigurationPanel');

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
  const activeTabId = useTabStore((s) => s.activeTabId);
  const markTabDirty = useTabStore((s) => s.markTabDirty);

  // Handler functions
  const handleWorkflowMetaChange = (meta: {
    name: string;
    description: string;
    author: string;
  }) => {
    logger.info("Workflow metadata updated:", meta.name);
    // Save current state before change
    pushState(tools, wires, workflowMeta);

    // Update meta in store
    updateWorkflowMeta(meta);
    
    // Mark tab as dirty
    if (activeTabId) {
      markTabDirty(activeTabId);
    }
  };

  const handleToolConfigChange = (toolId: string, config: ToolConfig) => {
    logger.debug("Tool configuration updated:", toolId);
    // Save current state before change
    pushState(tools, wires, workflowMeta);

    // Update configuration in store
    updateToolConfiguration(toolId, config);
    
    // Mark tab as dirty
    if (activeTabId) {
      markTabDirty(activeTabId);
    }
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
              operation="input"
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
                } else if (dataSource.id === "excel") {
                  // Excel (no mode selection - always eager read)
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "excel" as const,
                    sheet_id: 1, // Default to first sheet
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
                } else if (dataSource.id === "json") {
                  // JSON with mode selection (mode only applies to NDJSON)
                  const dataSourceWithMode = dataSource as typeof dataSource & {
                    selectedMode?: string;
                  };
                  const selectedMode =
                    dataSourceWithMode.selectedMode || "scan"; // Default to scan mode
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "json" as const,
                    jsonMode: selectedMode,
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
                } else if (dataSource.id === "ipc") {
                  // IPC/Arrow with mode selection
                  const dataSourceWithMode = dataSource as typeof dataSource & {
                    selectedMode?: string;
                  };
                  const selectedMode =
                    dataSourceWithMode.selectedMode || "scan"; // Default to scan mode
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "ipc" as const,
                    ipcMode: selectedMode,
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
                } else if (dataSource.id === "avro") {
                  // Avro has no mode selection (always eager read)
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "avro" as const,
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
                } else if (dataSource.id === "ods") {
                  // ODS has no mode selection (always eager read)
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "ods" as const,
                    sheet_id: 1, // Default to first sheet
                    has_header: true,
                    drop_empty_rows: true,
                    drop_empty_cols: true,
                    raise_if_empty: true,
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
            selectedTool.config.type === "excel" ? (
            /* Excel Configuration Panel */
            <ExcelConfiguration
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
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "json" ? (
            /* JSON Configuration Panel */
            <JsonConfiguration
              mode={(selectedTool.config.jsonMode as JSONMode) || "scan"}
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "ipc" ? (
            /* IPC/Arrow Configuration Panel */
            <IpcConfiguration
              mode={(selectedTool.config.ipcMode as IpcMode) || "scan"}
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "avro" ? (
            /* Avro Configuration Panel */
            <AvroConfiguration
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "ods" ? (
            /* ODS Configuration Panel */
            <OdsConfiguration
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
      ) : selectedTool.type === "Output" ? (
        /* Output Tool Configuration */
        <div className="flex-1 overflow-hidden">
          {/* Show data source selector if no type selected */}
          {!selectedTool.config?.type ? (
            <DataSourceSelector
              operation="output"
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
                } else if (dataSource.id === "excel") {
                  // Excel output (always eager - no streaming)
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "excel" as const,
                    table_style: "Table Style Medium 4", // Default table style
                    include_header: true,
                    autofilter: true,
                    autofit: false,
                    float_precision: 3,
                  };
                  handleToolConfigChange(selectedTool.id, newConfig);
                } else if (dataSource.id === "json") {
                  // JSON with mode selection (default to sink for NDJSON)
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "json" as const,
                    jsonMode: "sink", // Default to streaming mode
                  };
                  handleToolConfigChange(selectedTool.id, newConfig);
                } else if (dataSource.id === "ipc") {
                  // IPC/Arrow with mode selection (default to sink)
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "ipc" as const,
                    ipcMode: "sink", // Default to streaming mode
                  };
                  handleToolConfigChange(selectedTool.id, newConfig);
                } else if (dataSource.id === "avro") {
                  // Avro output (always eager - no streaming)
                  const newConfig: ToolConfig = {
                    category: "file" as const,
                    type: "avro" as const,
                    compression: "uncompressed", // Default compression
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
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "excel" ? (
            /* Excel Output Configuration Panel */
            <ExcelOutputConfiguration
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "json" ? (
            /* JSON Output Configuration Panel */
            <JsonOutputConfiguration
              mode={(selectedTool.config.jsonMode as JSONOutputMode) || "sink"}
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "ipc" ? (
            /* IPC/Arrow Output Configuration Panel */
            <IpcOutputConfiguration
              mode={(selectedTool.config.ipcMode as IpcOutputMode) || "sink"}
              config={selectedTool.config}
              onChange={(config) =>
                handleToolConfigChange(selectedTool.id, config)
              }
            />
          ) : selectedTool.config.category === "file" &&
            selectedTool.config.type === "avro" ? (
            /* Avro Output Configuration Panel */
            <AvroOutputConfiguration
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
            toolId={selectedTool.id}
            tools={tools}
            wires={wires}
            workflowMeta={workflowMeta}
          />
        </div>
      ) : selectedTool.type === "Formula" ? (
        /* Formula Tool Configuration */
        <div className="flex-1 overflow-hidden">
          <FormulaConfiguration
            config={selectedTool.config}
            onChange={(config) => handleToolConfigChange(selectedTool.id, config)}
            toolId={selectedTool.id}
            tools={tools}
            wires={wires}
            workflowMeta={workflowMeta}
          />
        </div>
      ) : selectedTool.type === "Select" ? (
        /* Select Tool Configuration */
        <div className="flex-1 overflow-hidden">
          <SelectConfiguration
            config={selectedTool.config}
            onChange={(config) => handleToolConfigChange(selectedTool.id, config)}
            toolId={selectedTool.id}
            tools={tools}
            wires={wires}
            workflowMeta={workflowMeta}
          />
        </div>
      ) : selectedTool.type === "Union" ? (
        /* Union Tool Configuration */
        <div className="flex-1 overflow-hidden">
          <UnionConfiguration
            config={selectedTool.config}
            onChange={(config) => handleToolConfigChange(selectedTool.id, config)}
          />
        </div>
      ) : selectedTool.type === "Join" ? (
        /* Join Tool Configuration */
        <div className="flex-1 overflow-hidden">
          <JoinConfiguration
            config={selectedTool.config}
            onChange={(config) => handleToolConfigChange(selectedTool.id, config)}
            toolId={selectedTool.id}
            tools={tools}
            wires={wires}
            workflowMeta={workflowMeta}
          />
        </div>
      ) : selectedTool.type === "Sort" ? (
        /* Sort Tool Configuration */
        <div className="flex-1 overflow-hidden">
          <SortConfiguration
            config={selectedTool.config}
            onChange={(config) => handleToolConfigChange(selectedTool.id, config)}
            toolId={selectedTool.id}
            tools={tools}
            wires={wires}
            workflowMeta={workflowMeta}
          />
        </div>
      ) : selectedTool.type === "Summarize" ? (
        /* Summarize Tool Configuration */
        <div className="flex-1 overflow-hidden">
          <SummarizeConfiguration
            config={selectedTool.config}
            onChange={(config) => handleToolConfigChange(selectedTool.id, config)}
            toolId={selectedTool.id}
            tools={tools}
            wires={wires}
            workflowMeta={workflowMeta}
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
