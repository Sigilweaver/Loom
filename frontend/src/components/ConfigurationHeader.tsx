import { Tool } from '../domain/workflow/entities/workflow';
import { getToolDefinition } from '../data/tools';

interface ConfigurationHeaderProps {
  tool: Tool;
}

export default function ConfigurationHeader({ tool }: ConfigurationHeaderProps) {
  const toolDefinition = getToolDefinition(tool.type);
  
  return (
    <div className="bg-theme-surface-elevated border-b border-theme-border-primary p-4">
      <div className="flex items-center space-x-3">
        <div className="text-2xl">{toolDefinition?.icon || '⚙️'}</div>
        <div>
          <h2 className="text-lg font-semibold text-theme-text-primary">{toolDefinition?.name || tool.type}</h2>
          <p className="text-xs text-theme-text-tertiary">Tool ID: {tool.id}</p>
        </div>
      </div>
    </div>
  );
}
