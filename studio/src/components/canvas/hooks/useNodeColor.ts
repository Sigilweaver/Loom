import { useCallback } from 'react';
import { Node } from '@xyflow/react';
import { Tool } from '@domain/workflow/entities/workflow';
import { getToolDefinition } from '@data/tools';
import { useTheme } from '@contexts/ThemeContext';

export function useNodeColor(tools: Tool[]) {
  const { currentTheme } = useTheme();
  return useCallback((node: Node) => {
    const tool = tools.find(t => t.id === node.id);
    if (!tool) return currentTheme.colors.canvas.minimap.viewport;
    const def = getToolDefinition(tool.type);
    if (!def) return currentTheme.colors.canvas.minimap.viewport;
    switch (def.category) {
      case 'connect': return currentTheme.colors.palette.tools.connect[500];
      case 'compute': return currentTheme.colors.palette.tools.compute[500];
      case 'reshape': return currentTheme.colors.palette.tools.reshape[500];
      case 'combine': return currentTheme.colors.palette.tools.combine[500];
      default: return currentTheme.colors.canvas.minimap.viewport;
    }
  }, [tools, currentTheme]);
}
