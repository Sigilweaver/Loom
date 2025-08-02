import { useState } from 'react';

interface WorkflowConfigurationProps {
  workflowMeta: {
    name: string;
    description: string;
    author: string;
    workflowId: string;
    created: string;
  };
  onWorkflowMetaChange: (meta: { name: string; description: string; author: string }) => void;
}

export default function WorkflowConfiguration({
  workflowMeta,
  onWorkflowMetaChange
}: WorkflowConfigurationProps) {
  const [previewMode, setPreviewMode] = useState(false);

  const handleFieldChange = (field: 'name' | 'description' | 'author', value: string) => {
    onWorkflowMetaChange({
      ...workflowMeta,
      [field]: value
    });
  };

  // Simple markdown rendering for preview
  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div className="space-y-4">
      {/* Workflow Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Workflow Name
        </label>
        <input
          type="text"
          value={workflowMeta.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter workflow name..."
        />
      </div>

      {/* Workflow Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            {previewMode ? 'Edit' : 'Preview'}
          </button>
        </div>
        
        {previewMode ? (
          <div 
            className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
            dangerouslySetInnerHTML={{ 
              __html: renderMarkdown(workflowMeta.description || 'No description provided.') 
            }}
          />
        ) : (
          <textarea
            value={workflowMeta.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
            placeholder="Enter workflow description... (Markdown supported: **bold**, *italic*, `code`)"
          />
        )}
        
        <div className="text-xs text-gray-500 mt-1">
          Supports basic Markdown: **bold**, *italic*, `code`
        </div>
      </div>

      {/* Author */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Author
        </label>
        <input
          type="text"
          value={workflowMeta.author}
          onChange={(e) => handleFieldChange('author', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter author name..."
        />
      </div>

      {/* Workflow Info (Read-only) */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Workflow Info</h4>
        <div className="text-xs text-gray-500 space-y-1">
          <div>ID: {workflowMeta.workflowId}</div>
          <div>Created: {new Date(workflowMeta.created).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
