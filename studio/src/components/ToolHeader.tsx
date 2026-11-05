import { Tool } from '../domain/workflow/entities/workflow';
import { getToolDefinition } from '../data/tools';
import { HelpLink } from './common/HelpLink';
import { useSettingsStore } from '../state/settingsStore';
import { Settings, AlertTriangle, X } from 'lucide-react';
import { IconButton } from './ui/Button';
import { requestClearCanvasSelection } from './canvas/events';

interface ToolHeaderProps {
  tool: Tool;
}

export default function ToolHeader({ tool }: ToolHeaderProps) {
  const toolDefinition = getToolDefinition(tool.type);
  const showBlockingIndicators = useSettingsStore((s) => s.ui.showBlockingIndicators);
  
  // Category color logic
  const categoryColor = toolDefinition ? (
    toolDefinition.category === 'connect' ? 'var(--color-tool-connect)' :
    toolDefinition.category === 'compute' ? 'var(--color-tool-compute)' :
    toolDefinition.category === 'reshape' ? 'var(--color-tool-reshape)' :
    toolDefinition.category === 'combine' ? 'var(--color-tool-combine)' : 'var(--color-tool-default)'
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
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-semibold text-theme-text-primary">{toolDefinition?.name || tool.type}</h2>
              {toolDefinition?.blocking && showBlockingIndicators && (
                <span title="Blocking operation - materializes the dataframe and breaks lazy evaluation">
                  <AlertTriangle className="w-4 h-4 opacity-50" style={{ color: 'var(--color-warning)' }} />
                </span>
              )}
            </div>
            <p className="text-xs text-theme-text-tertiary">Tool ID: {tool.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {toolDefinition?.docsUrl && (
            <HelpLink
              url={toolDefinition.docsUrl}
              label={`${toolDefinition.name} documentation`}
            />
          )}
          <IconButton
            label="Close configuration and show the tool palette"
            onClick={requestClearCanvasSelection}
          >
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
