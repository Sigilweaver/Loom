import { Tool } from '../domain/workflow/entities/workflow';
import { getToolDefinition } from '../data/tools';
import { HelpLink } from './common/HelpLink';
import { Settings } from 'lucide-react';

interface ToolHeaderProps {
  tool: Tool;
}

export default function ToolHeader({ tool }: ToolHeaderProps) {
  const toolDefinition = getToolDefinition(tool.type);
  
  // Category color logic
  const categoryColor = toolDefinition ? (
    toolDefinition.category === 'inout' ? 'var(--color-tool-inout)' :
    toolDefinition.category === 'preparation' ? 'var(--color-tool-preparation)' :
    toolDefinition.category === 'join' ? 'var(--color-tool-join)' :
    toolDefinition.category === 'aggregate' ? 'var(--color-tool-aggregate)' : 'var(--color-tool-default)'
  ) : 'var(--color-tool-default)';

  return (
    <div className="bg-theme-surface-elevated border-b border-theme-border-primary p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {toolDefinition ? (
            <toolDefinition.icon className="w-6 h-6" style={{ color: categoryColor }} />
          ) : (
            <Settings className="w-6 h-6" />
          )}
          <div>
            <h2 className="text-lg font-semibold text-theme-text-primary">{toolDefinition?.name || tool.type}</h2>
            <p className="text-xs text-theme-text-tertiary">Tool ID: {tool.id}</p>
          </div>
        </div>
        {toolDefinition?.docsUrl && (
          <HelpLink 
            url={toolDefinition.docsUrl} 
            label={`${toolDefinition.name} documentation`}
          />
        )}
      </div>
    </div>
  );
}
