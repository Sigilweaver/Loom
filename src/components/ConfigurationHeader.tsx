import { Tool } from '../types/workflow';
import { getToolDefinition } from '../data/tools';

interface ConfigurationHeaderProps {
  tool: Tool;
}

export default function ConfigurationHeader({ tool }: ConfigurationHeaderProps) {
  const toolDefinition = getToolDefinition(tool.type);
  
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center space-x-3">
        <div className="text-2xl">{toolDefinition?.icon || '⚙️'}</div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{toolDefinition?.name || tool.type}</h2>
          <p className="text-sm text-gray-500">Tool ID: {tool.id}</p>
        </div>
      </div>
    </div>
  );
}
