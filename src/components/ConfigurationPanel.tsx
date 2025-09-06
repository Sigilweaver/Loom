import { Tool } from '../domain/workflow/entities/workflow';
import ConfigurationHeader from './ConfigurationHeader';
import WorkflowConfiguration from './WorkflowConfiguration';
import ResizablePanel from './ResizablePanel';
import { DataSourceSelector } from './DataSourceSelector';

interface ConfigurationPanelProps {
  selectedTool: Tool | null;
  toolCount?: number;
  wireCount?: number;
  workflowMeta: {
    name: string;
    description: string;
    author: string;
    workflowId: string;
    created: string;
  };
  onWorkflowMetaChange: (meta: { name: string; description: string; author: string }) => void;
}

export default function ConfigurationPanel({
  selectedTool,
  workflowMeta,
  toolCount,
  wireCount,
  onWorkflowMetaChange
}: ConfigurationPanelProps) {

  // Show workflow configuration if no tool is selected
  if (!selectedTool) {
    return (
      <ResizablePanel
        defaultWidth={320}
        minWidth={280}
        maxWidth={600}
        className="bg-theme-surface-panel border-r border-theme-border-primary flex flex-col"
      >
        {/* Workflow Configuration Header */}
        <div className="bg-theme-surface-elevated border-b border-theme-border-primary p-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">⚙️</div>
            <div>
              <h2 className="text-lg font-semibold text-theme-text-primary">Workflow Configuration</h2>
              <p className="text-sm text-theme-text-tertiary">General workflow settings</p>
            </div>
          </div>
        </div>
        
        {/* Workflow Configuration Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <WorkflowConfiguration
            workflowMeta={workflowMeta}
            toolCount={toolCount ?? 0}
            wireCount={wireCount ?? 0}
            onWorkflowMetaChange={onWorkflowMetaChange}
          />
        </div>
      </ResizablePanel>
    );
  }

  // Show basic placeholder for all tools except workflow configuration
  return (
    <ResizablePanel
      defaultWidth={320}
      minWidth={280}
      maxWidth={600}
      className="bg-theme-surface-panel border-r border-theme-border-primary flex flex-col"
    >
      <ConfigurationHeader tool={selectedTool} />
      
      {/* Input tool configuration */}
      {selectedTool.type === 'Input' ? (
        <div className="flex-1 overflow-hidden">
          <DataSourceSelector
            onSelect={(dataSource) => {
              console.log('Selected data source:', dataSource);
              // TODO: Update tool configuration with selected data source
            }}
            selectedId={selectedTool.config?.dataSourceType as string}
          />
        </div>
      ) : (
        /* Default placeholder for other tools */
        <div className="p-4 text-center text-theme-text-tertiary">
          <div className="text-sm">Configuration not available for {selectedTool.type} tools</div>
          <div className="text-xs mt-2 text-theme-text-disabled">Coming soon...</div>
        </div>
      )}
    </ResizablePanel>
  );
}
