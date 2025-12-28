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
      case 'inout': return currentTheme.colors.palette.tools.inout[500];
      case 'preparation': return currentTheme.colors.palette.tools.preparation[500];
      case 'join': return currentTheme.colors.palette.tools.join[500];
      case 'aggregate': return currentTheme.colors.palette.tools.aggregate[500];
      default: return currentTheme.colors.canvas.minimap.viewport;
    }
  }, [tools, currentTheme]);
}
