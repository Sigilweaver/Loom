/**
 * Chat Message Component
 *
 * Renders a single message in the AI chat panel.
 * Handles user messages, assistant responses, and tool call displays.
 */

import React, { useState } from 'react';
import type { ChatMessage as ChatMessageType, ToolCallInfo } from '@state/aiStore';
import { User, Bot, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import clsx from 'clsx';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={clsx('flex gap-3 px-4 py-3', isUser ? 'bg-theme-surface-page' : 'bg-theme-surface-elevated')}>
      {/* Avatar */}
      <div className={clsx(
        'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
        isUser ? 'bg-theme-interactive-accent' : 'bg-theme-surface-hover',
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-theme-text-on-accent" />
        ) : (
          <Bot className="w-4 h-4 text-theme-text-primary" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Role label */}
        <div className="text-xs font-medium text-theme-text-tertiary">
          {isUser ? 'You' : 'AI Assistant'}
          {message.usage && (
            <span className="ml-2 text-theme-text-tertiary opacity-60">
              ({message.usage.totalTokens} tokens)
            </span>
          )}
        </div>

        {/* Tool calls (shown before text for assistant messages) */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1">
            {message.toolCalls.map((tc, i) => (
              <ToolCallDisplay key={i} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Message text */}
        {message.content && (
          <div className="text-sm text-theme-text-primary whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tool Call Display
// ---------------------------------------------------------------------------

const ToolCallDisplay: React.FC<{ toolCall: ToolCallInfo }> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);

  // Format tool name for display
  const displayName = toolCall.toolName.replace(/_/g, ' ');

  // Summarize the result
  const resultSummary = summarizeResult(toolCall);

  return (
    <div className="border rounded bg-theme-surface-page border-theme-border-primary">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-left hover:bg-theme-surface-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-theme-text-tertiary flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-theme-text-tertiary flex-shrink-0" />
        )}
        <Wrench className="w-3 h-3 text-theme-text-secondary flex-shrink-0" />
        <span className="font-medium text-theme-text-secondary capitalize">{displayName}</span>
        {resultSummary && (
          <span className="text-theme-text-tertiary truncate ml-1">{resultSummary}</span>
        )}
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 space-y-2 border-t border-theme-border-primary">
          {/* Arguments */}
          {Object.keys(toolCall.args).length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium text-theme-text-tertiary mb-1">Arguments:</div>
              <pre className="text-xs bg-theme-bg-input rounded p-2 overflow-x-auto text-theme-text-secondary">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {toolCall.result !== undefined && (
            <div>
              <div className="text-xs font-medium text-theme-text-tertiary mb-1">Result:</div>
              <pre className="text-xs bg-theme-bg-input rounded p-2 overflow-x-auto text-theme-text-secondary max-h-48 overflow-y-auto">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Create a short summary of a tool call result for inline display.
 */
function summarizeResult(tc: ToolCallInfo): string {
  if (!tc.result) return '';
  const r = tc.result as Record<string, unknown>;

  if (r.success === true) {
    if (r.toolId) return `→ ${(r.type as string) ?? 'tool'} (${(r.toolId as string).slice(0, 8)})`;
    if (r.toolCount) return `→ ${r.toolCount} tools, ${r.wireCount} wires`;
    return '→ success';
  }
  if (r.success === false) return `→ error: ${r.error ?? 'unknown'}`;
  if (r.error) return `→ error: ${r.error}`;
  if (r.columns) return `→ ${(r.columns as unknown[]).length} columns`;
  if (r.rows) return `→ ${(r.rows as unknown[]).length} rows`;
  if (r.toolTypes) return `→ ${(r.toolTypes as unknown[]).length} types`;
  return '';
}

export default ChatMessage;
