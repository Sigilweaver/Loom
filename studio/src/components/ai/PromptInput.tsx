/**
 * Prompt Input Component
 *
 * Text input with send button for the AI chat panel.
 * Supports Enter to send, Shift+Enter for newline.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square } from 'lucide-react';

interface PromptInputProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const PromptInput: React.FC<PromptInputProps> = ({
  onSend,
  onCancel,
  isGenerating,
  disabled = false,
  placeholder = 'Describe what you want to build...',
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isGenerating, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex items-end gap-2 p-3 border-t border-theme-border-primary bg-theme-surface-elevated">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isGenerating}
        placeholder={placeholder}
        rows={1}
        className="flex-1 px-3 py-2 text-sm border rounded resize-none
          bg-theme-bg-input border-theme-border-primary text-theme-text-primary
          placeholder:text-theme-text-tertiary
          focus:outline-none focus:ring-1 focus:ring-theme-border-focus
          disabled:opacity-50"
      />

      {isGenerating ? (
        <button
          onClick={onCancel}
          className="flex items-center justify-center w-8 h-8 rounded
            bg-theme-status-error-bg border border-theme-status-error-border text-theme-status-error-text
            hover:opacity-80 transition-colors flex-shrink-0"
          title="Cancel generation"
        >
          <Square className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="flex items-center justify-center w-8 h-8 rounded
            bg-theme-interactive-accent text-theme-text-on-accent
            hover:opacity-90 transition-colors flex-shrink-0
            disabled:opacity-40 disabled:cursor-not-allowed"
          title="Send message (Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default PromptInput;
