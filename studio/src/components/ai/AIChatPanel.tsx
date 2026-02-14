/**
 * AI Chat Panel
 *
 * Right-side panel that hosts the conversational AI workflow builder.
 * Shows chat history, tool call results, and a prompt input.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useAIStore } from '@state/aiStore';
import { sendAgentMessage } from '../../ai/agent';
import ChatMessage from './ChatMessage';
import PromptInput from './PromptInput';
import SuggestedPrompts from './SuggestedPrompts';
import { X, Trash2, Sparkles } from 'lucide-react';

interface AIChatPanelProps {
  onClose: () => void;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ onClose }) => {
  const messages = useAIStore((s) => s.messages);
  const isGenerating = useAIStore((s) => s.isGenerating);
  const error = useAIStore((s) => s.error);
  const enabled = useAIStore((s) => s.enabled);
  const sessionUsage = useAIStore((s) => s.sessionUsage);
  const clearChat = useAIStore((s) => s.clearChat);
  const cancelGeneration = useAIStore((s) => s.cancelGeneration);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating]);

  const handleSend = useCallback(async (prompt: string) => {
    await sendAgentMessage(prompt);
  }, []);

  const handleSuggestedPrompt = useCallback((prompt: string) => {
    sendAgentMessage(prompt);
  }, []);

  // Not configured state
  if (!enabled) {
    return (
      <div className="flex flex-col h-full bg-theme-surface-page border-l border-theme-border-primary">
        <PanelHeader onClose={onClose} onClear={clearChat} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Sparkles className="w-10 h-10 text-theme-text-tertiary mb-3 opacity-50" />
          <h3 className="text-sm font-medium text-theme-text-primary mb-2">AI Assistant</h3>
          <p className="text-xs text-theme-text-secondary mb-4 max-w-[200px]">
            Enable AI features in Settings to start building workflows with natural language.
          </p>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-settings'));
            }}
            className="px-3 py-1.5 text-xs font-medium rounded
              bg-theme-interactive-accent text-theme-text-on-accent
              hover:opacity-90 transition-colors"
          >
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-theme-surface-page border-l border-theme-border-primary">
      <PanelHeader onClose={onClose} onClear={clearChat} sessionUsage={sessionUsage} />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState onSelectPrompt={handleSuggestedPrompt} />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Generating indicator */}
            {isGenerating && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-theme-text-tertiary">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-theme-text-tertiary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-theme-text-tertiary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-theme-text-tertiary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Thinking...
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="mx-4 my-2 px-3 py-2 text-xs rounded bg-theme-status-error-bg border border-theme-status-error-border text-theme-status-error-text">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div>
        <PromptInput
          onSend={handleSend}
          onCancel={cancelGeneration}
          isGenerating={isGenerating}
          disabled={!enabled}
        />
        <p className="px-4 pb-2 text-[10px] text-theme-text-tertiary leading-tight">
          AI-generated workflows may be inaccurate. Always review results.
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Panel Header
// ---------------------------------------------------------------------------

interface PanelHeaderProps {
  onClose: () => void;
  onClear: () => void;
  sessionUsage?: { totalTokens: number };
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ onClose, onClear, sessionUsage }) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b border-theme-border-primary bg-theme-surface-elevated">
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-theme-interactive-accent" />
      <span className="text-sm font-medium text-theme-text-primary">AI Assistant</span>
      {sessionUsage && sessionUsage.totalTokens > 0 && (
        <span className="text-xs text-theme-text-tertiary">
          ({sessionUsage.totalTokens.toLocaleString()} tokens)
        </span>
      )}
    </div>
    <div className="flex items-center gap-1">
      <button
        onClick={onClear}
        className="p-1.5 rounded hover:bg-theme-surface-hover transition-colors"
        title="Clear chat history"
      >
        <Trash2 className="w-3.5 h-3.5 text-theme-text-tertiary" />
      </button>
      <button
        onClick={onClose}
        className="p-1.5 rounded hover:bg-theme-surface-hover transition-colors"
        title="Close AI panel"
      >
        <X className="w-3.5 h-3.5 text-theme-text-tertiary" />
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Empty State with Suggested Prompts
// ---------------------------------------------------------------------------

const EmptyState: React.FC<{ onSelectPrompt: (prompt: string) => void }> = ({ onSelectPrompt }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <Sparkles className="w-8 h-8 text-theme-interactive-accent mb-3 opacity-70" />
      <h3 className="text-sm font-medium text-theme-text-primary mb-1">How can I help?</h3>
      <p className="text-xs text-theme-text-secondary mb-5 text-center max-w-[220px]">
        I can build workflows, add tools, write expressions, and inspect your data.
      </p>
      <SuggestedPrompts onSelect={onSelectPrompt} />
    </div>
  );
};

export default AIChatPanel;
