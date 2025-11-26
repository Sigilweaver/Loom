import { useState } from 'react';
import { createLogger } from '@utils/logger';
import MarkdownRenderer from './common/MarkdownRenderer';
import { CodeEditor } from './common/CodeEditor';

const logger = createLogger('WorkflowConfiguration');

interface WorkflowConfigurationProps {
  workflowMeta: {
    name: string;
    description: string;
    author: string;
    workflowId: string;
    created: string;
  };
  toolCount?: number;
  wireCount?: number;
  onWorkflowMetaChange: (meta: { name: string; description: string; author: string }) => void;
}

export default function WorkflowConfiguration({
  workflowMeta,
  toolCount = 0,
  wireCount = 0,
  onWorkflowMetaChange
}: WorkflowConfigurationProps) {
  const [previewMode, setPreviewMode] = useState(true); // Default to preview mode

  const handleFieldChange = (field: 'name' | 'description' | 'author', value: string) => {
    logger.debug("Field changed:", field, value.length > 50 ? `${value.substring(0, 50)}...` : value);
    onWorkflowMetaChange({
      ...workflowMeta,
      [field]: value
    });
  };

  return (
    <div className="space-y-4">
      {/* Workflow Name */}
      <div>
        <label className="block text-sm font-medium text-theme-text-secondary mb-2">
          Workflow Name
        </label>
        <input
          type="text"
          value={workflowMeta.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus bg-theme-surface-elevated text-theme-text-primary"
          placeholder="Enter workflow name..."
        />
      </div>

      {/* Workflow Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-theme-text-secondary">
            Description
          </label>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="text-xs text-theme-text-secondary hover:text-theme-text-primary transition-colors"
          >
            {previewMode ? 'Edit' : 'Preview'}
          </button>
        </div>
        
        {previewMode ? (
          <div className="w-full min-h-[100px] px-3 py-2 border border-theme-border-primary rounded-md text-sm bg-theme-surface-panel">
            <MarkdownRenderer 
              content={workflowMeta.description} 
              fallbackText="No description provided."
            />
          </div>
        ) : (
          <div className="w-full border border-theme-border-primary rounded-md overflow-hidden">
            <CodeEditor
              value={workflowMeta.description}
              onChange={(code) => handleFieldChange('description', code)}
              language="markdown"
              height="150px"
              placeholder="Enter workflow description... (Markdown supported: **bold**, *italic*, `code`, # headers, - lists)"
            />
          </div>
        )}
        
        {!previewMode && (
          <div className="text-xs text-theme-text-tertiary mt-1">
            Supports Markdown: **bold**, *italic*, `code`, # headers, - lists, [links](url)
          </div>
        )}
      </div>

      {/* Author */}
      <div>
        <label className="block text-sm font-medium text-theme-text-secondary mb-2">
          Author
        </label>
        <input
          type="text"
          value={workflowMeta.author}
          onChange={(e) => handleFieldChange('author', e.target.value)}
          className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus bg-theme-surface-elevated text-theme-text-primary"
          placeholder="Enter author name..."
        />
      </div>

      {/* Workflow Info (Read-only) */}
      <div className="border-t border-theme-border-primary pt-4 space-y-2">
        <h4 className="text-sm font-medium text-theme-text-secondary">Workflow Info</h4>
        <div className="text-xs text-theme-text-tertiary space-y-1">
          <div>ID: {workflowMeta.workflowId}</div>
          <div>Created: {new Date(workflowMeta.created).toLocaleString()}</div>
          <div className="mt-2 space-y-1">
            <div>Tools: <span className="font-mono tabular-nums text-theme-text-secondary">{toolCount}</span></div>
            <div>Wires: <span className="font-mono tabular-nums text-theme-text-secondary">{wireCount}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
