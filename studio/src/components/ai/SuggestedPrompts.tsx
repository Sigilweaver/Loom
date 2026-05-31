/**
 * Suggested Prompts
 *
 * Contextual prompt suggestions based on the current canvas state.
 * Shown in the empty state of the chat panel.
 */

import React, { useMemo } from 'react';
import { useToolTypesDigest, useWireCount } from '@state/workflowStore';
import { MessageSquare } from 'lucide-react';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

/** Capability descriptions shown in the empty state */
const CAPABILITIES = [
  { label: 'Build workflows', description: 'Create data pipelines from natural language descriptions' },
  { label: 'Add & configure tools', description: 'Insert reads, filters, joins, calculations, and more' },
  { label: 'Write expressions', description: 'Generate Polars expressions for calculations and filters' },
  { label: 'Explain workflows', description: 'Describe what a workflow does step by step' },
  { label: 'Inspect data', description: 'Preview schemas, profiles, and sample rows' },
];

/** Quick-start prompts users can click to begin */
const STARTER_PROMPTS = [
  'Build a workflow that filters and sorts a CSV',
  'What does this workflow do?',
  'Add a calculation for a new column',
];

/** Contextual prompts when there are tools on the canvas */
function getContextualPrompts(toolTypes: string[], hasWires: boolean): string[] {
  const prompts: string[] = [];

  if (toolTypes.length > 1 && !hasWires) {
    prompts.push('Connect the tools on my canvas');
  }

  if (toolTypes.includes('Input')) {
    prompts.push('Add a filter to keep only certain rows');
    prompts.push('Aggregate this data by a column');
  }

  if (toolTypes.length > 0 && !toolTypes.includes('Output')) {
    prompts.push('Add a write tool to save the results');
  }

  prompts.push('What does this workflow do?');
  prompts.push('Add a calculation for a new column');

  return prompts.slice(0, 3);
}

const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelect }) => {
  // Subscribe to compact digests instead of full arrays so this
  // panel only re-renders when the set of tool types or the wire count
  // actually changes, not on every position/config edit.
  const toolTypesDigest = useToolTypesDigest();
  const wireCount = useWireCount();

  const hasTools = toolTypesDigest.length > 0;
  const prompts = useMemo(() => {
    if (!hasTools) return STARTER_PROMPTS;
    const toolTypes = toolTypesDigest.split("|").filter(Boolean);
    return getContextualPrompts(toolTypes, wireCount > 0);
  }, [toolTypesDigest, wireCount, hasTools]);

  return (
    <div className="w-full space-y-4">
      {/* Capabilities list */}
      {!hasTools && (
        <div className="space-y-1.5">
          {CAPABILITIES.map((cap, i) => (
            <div key={i} className="flex items-start gap-2 px-2 py-1 text-xs text-theme-text-secondary">
              <span className="text-theme-interactive-accent mt-0.5">-</span>
              <div>
                <span className="font-medium text-theme-text-primary">{cap.label}</span>
                <span className="text-theme-text-tertiary"> - {cap.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick-start prompts */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-theme-text-tertiary uppercase tracking-wider px-2">
          Try asking
        </p>
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
    </div>
  );
};

export default SuggestedPrompts;
