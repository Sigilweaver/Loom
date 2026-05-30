/**
 * Follow-Up Question Component
 *
 * Renders a pending question from the AI agent with selectable options
 * and an optional freeform text input. The agent loop is paused until
 * the user responds, at which point the answer becomes the tool result.
 *
 * Supports:
 *  - Recommended option (visually highlighted, single-click confirm)
 *  - Option descriptions (secondary text below the label)
 *  - Multi-select mode (checkboxes, submit selected set)
 *  - Freeform fallback (always available)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, MessageCircleQuestion, Send, Star } from 'lucide-react';
import { MarkdownBlock } from './ChatMessage';
import type { PendingQuestionOption } from '@state/aiStore';

interface FollowUpQuestionProps {
  question: string;
  options: PendingQuestionOption[];
  multiSelect: boolean;
  onAnswer: (answer: string | string[]) => void;
}

const FollowUpQuestion: React.FC<FollowUpQuestionProps> = ({
  question,
  options,
  multiSelect,
  onAnswer,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [selected, setSelected] = useState<Set<number>>(() => {
    // Pre-select recommended options in multi-select mode
    if (!multiSelect) return new Set<number>();
    const rec = new Set<number>();
    options.forEach((o, i) => { if (o.recommended) rec.add(i); });
    return rec;
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus the custom input when there are no options
  useEffect(() => {
    if (options.length === 0) {
      inputRef.current?.focus();
    }
  }, [options.length]);

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customInput.trim();
    if (trimmed) {
      onAnswer(trimmed);
    }
  }, [customInput, onAnswer]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit();
    }
  }, [handleCustomSubmit]);

  // Single-select: click → immediate answer
  const handleSingleSelect = useCallback(
    (label: string) => onAnswer(label),
    [onAnswer],
  );

  // Multi-select: toggle checkbox
  const toggleOption = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Multi-select: submit all selected
  const handleMultiSubmit = useCallback(() => {
    const labels = [...selected].sort().map((i) => options[i]?.label).filter(Boolean) as string[];
    if (labels.length > 0) onAnswer(labels);
  }, [selected, options, onAnswer]);

  return (
    <div className="mx-4 my-3 rounded-lg border border-theme-interactive-accent/30 bg-theme-surface-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-theme-interactive-accent/8 border-b border-theme-interactive-accent/20">
        <MessageCircleQuestion className="w-4 h-4 text-theme-interactive-accent flex-shrink-0" />
        <span className="text-xs font-medium text-theme-interactive-accent">Follow-up Question</span>
        {multiSelect && (
          <span className="ml-auto text-[10px] text-theme-text-tertiary">Select all that apply</span>
        )}
      </div>

      {/* Question text */}
      <div className="px-4 pt-3 pb-2">
        <MarkdownBlock content={question} />
      </div>

      {/* Options */}
      {options.length > 0 && (
        <div className="px-4 pb-2 space-y-1.5">
          {options.map((option, i) => {
            const isSelected = selected.has(i);
            const isRecommended = option.recommended === true;

            return (
              <button
                key={i}
                onClick={() => (multiSelect ? toggleOption(i) : handleSingleSelect(option.label))}
                className={`flex items-start gap-2 w-full px-3 py-2 text-sm text-left rounded-md
                  border transition-colors group
                  ${isRecommended && !multiSelect
                    ? 'border-theme-interactive-accent/50 bg-theme-interactive-accent/6 hover:bg-theme-interactive-accent/12'
                    : isSelected
                      ? 'border-theme-interactive-accent bg-theme-interactive-accent/10'
                      : 'border-theme-border-primary bg-theme-surface-page hover:bg-theme-surface-hover hover:border-theme-interactive-accent/40'
                  }`}
              >
                {/* Indicator: number circle (single) or checkbox (multi) */}
                {multiSelect ? (
                  <span className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center mt-0.5 transition-colors
                    ${isSelected
                      ? 'bg-theme-interactive-accent border-theme-interactive-accent'
                      : 'border-theme-border-primary group-hover:border-theme-interactive-accent'
                    }`}>
                    {isSelected && <Check className="w-3 h-3 text-theme-text-on-accent" />}
                  </span>
                ) : (
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs font-medium mt-0.5 transition-colors
                    ${isRecommended
                      ? 'border-theme-interactive-accent text-theme-interactive-accent'
                      : 'border-theme-border-primary text-theme-text-tertiary group-hover:border-theme-interactive-accent group-hover:text-theme-interactive-accent'
                    }`}>
                    {i + 1}
                  </span>
                )}

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-theme-text-primary leading-relaxed">{option.label}</span>
                    {isRecommended && !multiSelect && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-theme-interactive-accent/12 text-theme-interactive-accent">
                        <Star className="w-2.5 h-2.5" />
                        Recommended
                      </span>
                    )}
                  </div>
                  {option.description && (
                    <span className="block text-xs text-theme-text-secondary leading-snug mt-0.5">
                      {option.description}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Multi-select submit */}
      {multiSelect && options.length > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={handleMultiSubmit}
            disabled={selected.size === 0}
            className="w-full px-3 py-2 text-sm font-medium rounded-md
              bg-theme-interactive-accent text-theme-text-on-accent
              hover:opacity-90 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm {selected.size > 0 ? `(${selected.size} selected)` : ''}
          </button>
        </div>
      )}

      {/* Custom input - always shown */}
      <div className="px-4 pb-3 pt-1">
        {options.length > 0 && (
          <div className="text-[11px] text-theme-text-tertiary mb-1.5">
            Or type a custom response:
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={options.length > 0 ? 'Custom answer...' : 'Type your answer...'}
            rows={1}
            className="flex-1 px-3 py-2 text-sm border rounded resize-none
              bg-theme-bg-input border-theme-border-primary text-theme-text-primary
              placeholder:text-theme-text-tertiary
              focus:outline-none focus:ring-1 focus:ring-theme-border-focus"
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customInput.trim()}
            className="flex items-center justify-center w-8 h-8 rounded
              bg-theme-interactive-accent text-theme-text-on-accent
              hover:opacity-90 transition-colors flex-shrink-0
              disabled:opacity-40 disabled:cursor-not-allowed"
            title="Send answer (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FollowUpQuestion;
