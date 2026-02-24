/**
 * Chat Message Component
 *
 * Renders a single message in the AI chat panel.
 * Supports interleaved tool calls and text blocks (segments),
 * with markdown rendering for assistant text.
 */

import React, { useState, useMemo } from 'react';
import type { ChatMessage as ChatMessageType, ToolCallInfo, MessageSegment } from '@state/aiStore';
import { User, Bot, ChevronDown, ChevronRight, Wrench, ShieldCheck, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';

/**
 * Normalize segments for display.
 *
 * agent.ts already emits text before tool-calls within each step, so no
 * reordering is needed.  An earlier version swapped adjacent tool-calls +
 * text pairs, but that incorrectly crossed step boundaries (e.g. pulling
 * step N+1's text ahead of step N's tool calls).  We now return segments
 * as-is to preserve the correct interleaved order.
 */
function normalizeSegments(raw: MessageSegment[]): MessageSegment[] {
  return raw;
}

interface ChatMessageProps {
  message: ChatMessageType;
  /** When true, tool call details are expanded by default (debug mode). */
  debug?: boolean;
}

/**
 * Detect if a message is an audit result by checking content prefix.
 * Returns { isAudit: true, isWarning, text } if it's an audit message.
 */
function parseAuditMessage(msg: ChatMessageType): { isAudit: boolean; isWarning: boolean; text: string } {
  const content = msg.content ?? '';
  if (content.startsWith('\u2705 Audit:') || content.startsWith('\u26A0\uFE0F Audit:')) {
    const isWarning = content.startsWith('\u26A0\uFE0F');
    const text = content.replace(/^(?:\u2705|\u26A0\uFE0F)\s*Audit:\s*/, '');
    return { isAudit: true, isWarning, text };
  }
  return { isAudit: false, isWarning: false, text: '' };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, debug = false }) => {
  const isUser = message.role === 'user';
  const audit = useMemo(() => parseAuditMessage(message), [message]);

  // Audit messages get a compact, collapsible treatment
  if (audit.isAudit) {
    return <AuditMessage isWarning={audit.isWarning} text={audit.text} />;
  }

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

        {/* Interleaved segments (preferred) or legacy flat layout */}
        {message.segments ? (
          <SegmentedContent segments={message.segments} debug={debug} />
        ) : (
          <LegacyContent message={message} debug={debug} />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Segmented Content — interleaved tool calls and text in execution order
// ---------------------------------------------------------------------------

const SegmentedContent: React.FC<{ segments: MessageSegment[]; debug: boolean }> = ({ segments, debug }) => {
  const normalized = useMemo(() => normalizeSegments(segments), [segments]);
  return (
    <div className="space-y-2">
      {normalized.map((seg, i) =>
        seg.type === 'tool-calls' ? (
          <div key={i} className="space-y-1">
            {seg.toolCalls.map((tc, j) => (
              <ToolCallDisplay key={j} toolCall={tc} defaultExpanded={debug} />
            ))}
          </div>
        ) : (
          <MarkdownBlock key={i} content={seg.content} />
        ),
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Legacy Content — flat tool calls then text (backward compat for old messages)
// ---------------------------------------------------------------------------

const LegacyContent: React.FC<{ message: ChatMessageType; debug: boolean }> = ({ message, debug }) => (
  <>
    {message.toolCalls && message.toolCalls.length > 0 && (
      <div className="space-y-1">
        {message.toolCalls.map((tc, i) => (
          <ToolCallDisplay key={i} toolCall={tc} defaultExpanded={debug} />
        ))}
      </div>
    )}
    {message.content && (
      message.role === 'assistant'
        ? <MarkdownBlock content={message.content} />
        : <div className="text-sm text-theme-text-primary whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
    )}
  </>
);

// ---------------------------------------------------------------------------
// Markdown Block — renders assistant text as markdown
// ---------------------------------------------------------------------------

export const MarkdownBlock: React.FC<{ content: string }> = ({ content }) => {
  const plugins = useMemo(() => [remarkGfm], []);

  return (
    <div className="ai-markdown text-sm text-theme-text-primary leading-relaxed">
      <ReactMarkdown remarkPlugins={plugins}>{content}</ReactMarkdown>
    </div>
  );
};

const ToolCallDisplay: React.FC<{ toolCall: ToolCallInfo; defaultExpanded?: boolean }> = ({
  toolCall,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const displayName = toolCall.toolName.replace(/_/g, ' ');
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

  // Success with details
  if (r.success === true) {
    if (r.toolId) return `→ ${(r.type as string) ?? 'tool'} (${(r.toolId as string).slice(0, 8)})`;
    if (r.toolCount) return `→ ${r.toolCount} tools, ${r.wireCount} wires`;
    if (r.removedType) return `→ removed ${r.removedType}`;
    if (r.updatedFields) return `→ updated ${(r.updatedFields as string[]).join(', ')}`;
    return '→ success';
  }
  // Failures
  if (r.success === false) {
    if (r.errors) return `→ ${(r.errors as string[]).length} error(s)`;
    return `→ error: ${r.error ?? 'unknown'}`;
  }
  if (r.error) return `→ error: ${r.error}`;

  // Data results
  if (r.rows) return `→ ${(r.rows as unknown[]).length} rows`;
  if (r.columns) return `→ ${(r.columns as unknown[]).length} columns`;
  if (r.results) return `→ ${(r.results as unknown[]).length} results`;
  if (r.toolTypes) return `→ ${(r.toolTypes as unknown[]).length} types`;
  if (r.schema) return '→ schema';

  // Canvas state
  if (r.totalTools != null) return `→ ${r.totalTools} tools, ${r.totalWires} wires`;

  // File listing
  if (r.roots) return '→ file roots';
  if (r.files) return `→ ${r.directory}`;

  // Profiling
  if (r.rowCount != null && r.columnCount != null) return `→ ${r.rowCount} rows, ${r.columnCount} cols`;

  return '';
}

// ---------------------------------------------------------------------------
// Audit Message — compact collapsible row for post-turn audit results
// ---------------------------------------------------------------------------

const AuditMessage: React.FC<{ isWarning: boolean; text: string }> = ({ isWarning, text }) => {
  // Warnings start expanded; passes start collapsed
  const [expanded, setExpanded] = useState(isWarning);

  const Icon = isWarning ? ShieldAlert : ShieldCheck;
  const label = isWarning ? 'Audit Warning' : 'Audit Passed';

  return (
    <div className="px-4 py-1.5 bg-theme-surface-elevated">
      <div className={clsx(
        'border rounded text-xs',
        isWarning
          ? 'text-theme-status-warning-text border-theme-status-warning-border'
          : 'text-theme-text-tertiary border-theme-border-primary',
      )}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
          ) : (
            <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />
          )}
          <Icon className="w-3 h-3 flex-shrink-0" />
          <span className="font-medium">{label}</span>
          {!expanded && (
            <span className="truncate opacity-70 ml-1">{text}</span>
          )}
        </button>
        {expanded && (
          <div className="px-2.5 pb-2 text-xs leading-relaxed">
            {text}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
