/**
 * Suggested Prompts
 *
 * Contextual prompt suggestions based on the current canvas state.
 * Shown in the empty state of the chat panel.
 */

import React, { useMemo } from 'react';
import { useWorkflowStore } from '@state/workflowStore';
import { MessageSquare } from 'lucide-react';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

/** Static prompts for empty canvas */
const EMPTY_CANVAS_PROMPTS = [
  'Load a CSV file and show me the first few rows',
  'Build a workflow that filters and sorts data',
  'Help me join two data sources together',
];

/** Prompts when there are tools on the canvas */
function getContextualPrompts(toolTypes: string[], hasWires: boolean): string[] {
  const prompts: string[] = [];

  // If there are tools but no wires, suggest connecting them
  if (toolTypes.length > 1 && !hasWires) {
    prompts.push('Connect the tools on my canvas');
  }

  // If there's an Input tool, suggest transforms
  if (toolTypes.includes('Input')) {
    prompts.push('Add a filter to keep only certain rows');
    prompts.push('Summarize this data by a column');
  }

  // If there are transforms but no Output, suggest adding one
  if (toolTypes.length > 0 && !toolTypes.includes('Output')) {
    prompts.push('Add an output to save the results');
  }

  // General prompts
  prompts.push('What does this workflow do?');
  prompts.push('Add a formula to calculate a new column');

  return prompts.slice(0, 3);
}

const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelect }) => {
  const tools = useWorkflowStore((s) => s.tools);
  const wires = useWorkflowStore((s) => s.wires);

  const prompts = useMemo(() => {
    if (tools.length === 0) return EMPTY_CANVAS_PROMPTS;
    const toolTypes = tools.map((t) => t.type);
    return getContextualPrompts(toolTypes, wires.length > 0);
  }, [tools, wires]);

  return (
    <div className="w-full space-y-2">
      {prompts.map((prompt, i) => (
        <button
          key={i}
          onClick={() => onSelect(prompt)}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left rounded
            border border-theme-border-primary bg-theme-surface-page
            hover:bg-theme-surface-hover hover:border-theme-border-focus
            transition-colors text-theme-text-secondary"
        >
          <MessageSquare className="w-3.5 h-3.5 text-theme-text-tertiary flex-shrink-0" />
          <span className="truncate">{prompt}</span>
        </button>
      ))}
    </div>
  );
};

export default SuggestedPrompts;
