import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createLogger } from '@utils/logger';

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

  // Simple markdown rendering for preview
  const renderMarkdown = (text: string) => {
    return (
      <div className="prose prose-sm max-w-none prose-headings:text-theme-text-primary prose-p:text-theme-text-secondary prose-strong:text-theme-text-primary prose-code:text-theme-text-primary prose-code:bg-theme-surface-panel prose-code:px-1 prose-code:rounded">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {text || 'No description provided.'}
        </ReactMarkdown>
      </div>
    );
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
            {renderMarkdown(workflowMeta.description)}
          </div>
        ) : (
          <textarea
            value={workflowMeta.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            onKeyDown={(e) => {
              // Allow all normal text input including spaces and newlines
              if (e.key === 'Tab') {
                e.preventDefault();
                const target = e.target as HTMLTextAreaElement;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const value = target.value;
                const newValue = value.substring(0, start) + '  ' + value.substring(end);
                handleFieldChange('description', newValue);
                // Set cursor position after the inserted spaces
                setTimeout(() => {
                  target.selectionStart = target.selectionEnd = start + 2;
                }, 0);
              }
              // Don't prevent any other keys - allow natural text input
            }}
            className="w-full min-h-[100px] px-3 py-2 border border-theme-border-primary rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus resize-vertical bg-theme-surface-elevated text-theme-text-primary"
            placeholder="Enter workflow description... (Markdown supported: **bold**, *italic*, `code`, # headers, - lists)"
            rows={4}
          />
        )}
        
        <div className="text-xs text-theme-text-tertiary mt-1">
          Supports Markdown: **bold**, *italic*, `code`, # headers, - lists, [links](url)
        </div>
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
