/**
 * Filter Assist Component
 *
 * AI helper for basic-mode Filter configuration.
 * Generates structured conditions from natural language — no raw expressions.
 * Feeds directly into the FilterExpressionBuilder via onConditionsGenerated.
 */

import React, { useState, useCallback } from 'react';
import { useAIStore } from '@state/aiStore';
import { generateBasicFilter, type BasicFilterResult } from '../../ai/agent';
import { Sparkles, Send, Loader2, X } from 'lucide-react';

interface FilterAssistProps {
  /** Current columns available */
  columns: Array<{ name: string; dtype: string; nullable?: boolean }>;
  /** Callback with generated conditions — consumer builds a FilterGroup from these */
  onConditionsGenerated: (result: BasicFilterResult) => void;
}

const FilterAssist: React.FC<FilterAssistProps> = ({
  columns,
  onConditionsGenerated,
}) => {
  const enabled = useAIStore((s) => s.enabled);
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    const { result, error: err } = await generateBasicFilter(prompt.trim(), columns);

    setLoading(false);

    if (err) {
      setError(err);
    } else if (result) {
      onConditionsGenerated(result);
      setPrompt('');
      setIsOpen(false);
    }
  }, [prompt, loading, columns, onConditionsGenerated]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [handleGenerate]);

  if (!enabled) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded
          border border-theme-border-primary bg-theme-surface-page
          hover:bg-theme-surface-hover hover:border-theme-interactive-accent
          transition-colors text-theme-text-secondary"
        title="AI filter helper — describe what to filter"
      >
        <Sparkles className="w-3 h-3" />
        AI Assist
      </button>
    );
  }

  return (
    <div className="space-y-2 p-2.5 rounded border border-theme-interactive-accent bg-theme-surface-elevated">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-theme-text-primary">
          <Sparkles className="w-3 h-3 text-theme-interactive-accent" />
          AI Filter Helper
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-0.5 rounded hover:bg-theme-surface-hover transition-colors"
        >
          <X className="w-3.5 h-3.5 text-theme-text-tertiary" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='e.g. "women and children who survived"'
          disabled={loading}
          className="flex-1 px-2.5 py-1.5 text-xs border rounded
            bg-theme-bg-input border-theme-border-primary text-theme-text-primary
            placeholder:text-theme-text-tertiary
            focus:outline-none focus:ring-1 focus:ring-theme-border-focus
            disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || loading}
          className="flex items-center justify-center w-7 h-7 rounded
            bg-theme-interactive-accent text-theme-text-on-accent
            hover:opacity-90 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {error && (
        <div className="text-xs text-theme-status-error-text px-2 py-1 rounded bg-theme-status-error-bg">
          {error}
        </div>
      )}

      <p className="text-[10px] text-theme-text-tertiary">
        Describe your filter in plain English. Conditions are built automatically.
      </p>
    </div>
  );
};

export default FilterAssist;
