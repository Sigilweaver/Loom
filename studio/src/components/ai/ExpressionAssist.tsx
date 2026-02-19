/**
 * Expression Assist Component
 *
 * Inline AI helper for writing Polars expressions in Formula and Filter config panels.
 * Shows a prompt input that generates expressions using the configured AI provider.
 */

import React, { useState, useCallback } from 'react';
import { useAIStore } from '@state/aiStore';
import { generateExpression } from '../../ai/agent';
import { Sparkles, Send, Loader2, X } from 'lucide-react';

interface ExpressionAssistProps {
  /** Current columns available for expression writing */
  columns: Array<{ name: string; dtype: string; nullable?: boolean }>;
  /** Tool type context */
  toolType: 'Filter' | 'Formula';
  /** Callback when an expression is generated */
  onExpressionGenerated: (expression: string) => void;
  /** Available Polars functions for context */
  polarsFunctions?: string[] | undefined;
}

const ExpressionAssist: React.FC<ExpressionAssistProps> = ({
  columns,
  toolType,
  onExpressionGenerated,
  polarsFunctions,
}) => {
  const enabled = useAIStore((s) => s.enabled);
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ prompt: string; expression: string }>>([]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    const result = await generateExpression(
      prompt.trim(),
      columns,
      toolType,
      polarsFunctions,
    );

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.expression) {
      onExpressionGenerated(result.expression);
      setHistory((h) => [...h, { prompt: prompt.trim(), expression: result.expression! }]);
      setPrompt('');
    }
  }, [prompt, loading, columns, toolType, polarsFunctions, onExpressionGenerated]);

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
        title="AI expression helper"
      >
        <Sparkles className="w-3 h-3" />
        AI Assist
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 p-2.5 rounded border border-theme-interactive-accent bg-theme-surface-elevated">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-theme-text-primary">
          <Sparkles className="w-3 h-3 text-theme-interactive-accent" />
          AI Expression Helper
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-0.5 rounded hover:bg-theme-surface-hover transition-colors"
        >
          <X className="w-3.5 h-3.5 text-theme-text-tertiary" />
        </button>
      </div>

      {/* Prompt input */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={toolType === 'Filter' ? 'e.g. "keep rows where age > 18"' : 'e.g. "calculate fare per person"'}
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

      {/* Error */}
      {error && (
        <div className="text-xs text-theme-status-error-text px-2 py-1 rounded bg-theme-status-error-bg">
          {error}
        </div>
      )}

      {/* History of generated expressions */}
      {history.length > 0 && (
        <div className="space-y-1">
          {history.slice(-3).map((h, i) => (
            <button
              key={i}
              onClick={() => onExpressionGenerated(h.expression)}
              className="w-full text-left px-2 py-1 text-xs rounded
                bg-theme-surface-page hover:bg-theme-surface-hover
                transition-colors border border-theme-border-primary"
              title={`Click to use: ${h.expression}`}
            >
              <div className="text-theme-text-tertiary truncate">{h.prompt}</div>
              <div className="text-theme-text-secondary font-mono truncate">{h.expression}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpressionAssist;
