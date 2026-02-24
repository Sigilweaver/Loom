/**
 * AI Chat Panel
 *
 * Right-side panel that hosts the conversational AI workflow builder.
 * Shows chat history, tool call results, and a prompt input.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useAIStore, type ToolCallInfo, type MessageSegment, type ChatMessage as ChatMessageType } from '@state/aiStore';
import { useUIStore } from '@state/uiStore';
import { useWorkflowStore } from '@state/workflowStore';
import { sendAgentMessage } from '../../ai/agent';
import { buildWorkflowSystemPrompt } from '../../ai/prompts/system';
import ChatMessage from './ChatMessage';
import { MarkdownBlock } from './ChatMessage';
import FollowUpQuestion from './FollowUpQuestion';
import PromptInput from './PromptInput';
import { Trash2, Sparkles, PlayCircle, Bot, Wrench, X, Info, Bug, Download } from 'lucide-react';

interface AIChatPanelProps {
  onClose: () => void;
  /** When true, panel is rendered inside DeveloperPanel (no outer chrome/header). */
  embedded?: boolean;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ onClose, embedded = false }) => {
  const messages = useAIStore((s) => s.messages);
  const isGenerating = useAIStore((s) => s.isGenerating);
  const error = useAIStore((s) => s.error);
  const enabled = useAIStore((s) => s.enabled);
  const sessionUsage = useAIStore((s) => s.sessionUsage);
  const clearChat = useAIStore((s) => s.clearChat);
  const cancelGeneration = useAIStore((s) => s.cancelGeneration);
  const streamingText = useAIStore((s) => s.streamingText);
  const streamingSegments = useAIStore((s) => s.streamingSegments);
  const stoppedAtLimit = useAIStore((s) => s.stoppedAtLimit);
  const pendingQuestion = useAIStore((s) => s.pendingQuestion);
  const debugMode = useUIStore((s) => s.debugMode);
  const setDebugMode = useUIStore((s) => s.setDebugMode);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating, streamingText, streamingSegments.length, pendingQuestion]);

  const handleSend = useCallback(async (prompt: string) => {
    await sendAgentMessage(prompt);
  }, []);

  const handleContinue = useCallback(async () => {
    useAIStore.getState().setStoppedAtLimit(false);
    await sendAgentMessage();
  }, []);

  const docsBaseUrl = 'https://sigilweaver.app/docs/user/interface/ai-assistant';

  // Not configured state
  if (!enabled) {
    return (
      <div className="flex flex-col h-full bg-theme-surface-page">
        {!embedded && <PanelHeader onClose={onClose} onClear={clearChat} />}
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
    <div className="flex flex-col h-full bg-theme-surface-page">
      {!embedded && <PanelHeader onClose={onClose} onClear={clearChat} sessionUsage={sessionUsage} />}

      {/* Sub-header: debug toggle, export, token usage, clear */}
      {embedded && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-theme-border-primary bg-theme-surface-page">
          <div className="flex items-center gap-2">
            {sessionUsage && sessionUsage.totalTokens > 0 && (
              <span className="text-[10px] text-theme-text-tertiary">
                {sessionUsage.totalTokens.toLocaleString()} tokens
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`p-1 rounded transition-colors ${
                debugMode
                  ? 'bg-theme-interactive-accent/15 text-theme-interactive-accent'
                  : 'hover:bg-theme-surface-hover text-theme-text-tertiary'
              }`}
              title={debugMode ? 'Hide tool call details' : 'Show tool call details (debug mode)'}
            >
              <Bug className="w-3 h-3" />
            </button>
            <button
              onClick={() => exportChatLog(messages)}
              className="p-1 rounded hover:bg-theme-surface-hover transition-colors"
              title="Export chat log"
            >
              <Download className="w-3 h-3 text-theme-text-tertiary" />
            </button>
            <button
              onClick={clearChat}
              className="p-1 rounded hover:bg-theme-surface-hover transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="w-3 h-3 text-theme-text-tertiary" />
            </button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} debug={debugMode} />
            ))}

            {/* Streaming indicator — shows live segments and text as they arrive */}
            {isGenerating && (streamingSegments.length > 0 || streamingText) && (
              <StreamingMessage segments={streamingSegments} text={streamingText} />
            )}

            {/* Generating indicator (only when no streaming content yet) */}
            {isGenerating && streamingSegments.length === 0 && !streamingText && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-theme-text-tertiary">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-theme-text-tertiary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-theme-text-tertiary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-theme-text-tertiary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Thinking...
              </div>
            )}

            {/* Continue button — shown when agent hit max iterations */}
            {!isGenerating && stoppedAtLimit && (
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  onClick={handleContinue}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded
                    bg-theme-interactive-accent text-theme-text-on-accent
                    hover:opacity-90 transition-colors"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  Continue
                </button>
                <span className="text-xs text-theme-text-tertiary">
                  Agent reached the step limit. Click to let it continue.
                </span>
              </div>
            )}

            {/* Follow-up question from the agent */}
            {pendingQuestion && (
              <FollowUpQuestion
                question={pendingQuestion.question}
                options={pendingQuestion.options}
                multiSelect={pendingQuestion.multiSelect}
                onAnswer={pendingQuestion.resolve}
              />
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
      <div className="bg-theme-surface-elevated">
        <PromptInput
          onSend={handleSend}
          onCancel={cancelGeneration}
          isGenerating={isGenerating}
          disabled={!enabled}
        />
        <a
          href={docsBaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 px-4 pb-2 text-[10px] leading-tight text-theme-text-tertiary hover:text-theme-text-secondary transition-colors"
        >
          <Info className="w-3 h-3 flex-shrink-0" />
          <span>AI-generated workflows may be inaccurate. Always review results.</span>
        </a>
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

const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <Sparkles className="w-8 h-8 text-theme-interactive-accent mb-3 opacity-70" />
      <h3 className="text-sm font-medium text-theme-text-primary mb-1">How can I help?</h3>
      <p className="text-xs text-theme-text-secondary text-center max-w-[220px]">
        I can build workflows, add tools, write expressions, and inspect your data.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Streaming Message — shows interleaved segments from completed steps + live text
// ---------------------------------------------------------------------------

const StreamingMessage: React.FC<{ segments: MessageSegment[]; text: string }> = ({ segments, text }) => (
  <div className="flex gap-3 px-4 py-3 bg-theme-surface-elevated">
    {/* Avatar */}
    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-theme-surface-hover">
      <Bot className="w-4 h-4 text-theme-text-primary" />
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0 space-y-2">
      <div className="text-xs font-medium text-theme-text-tertiary">
        AI Assistant
      </div>

      {/* Completed step segments — interleaved text and tool calls */}
      {segments.map((seg, i) =>
        seg.type === 'tool-calls' ? (
          <div key={i} className="space-y-1">
            {seg.toolCalls.map((tc, j) => (
              <div key={j} className="flex items-center gap-2 px-2.5 py-1.5 text-xs border rounded bg-theme-surface-page border-theme-border-primary">
                <Wrench className="w-3 h-3 text-theme-text-secondary flex-shrink-0" />
                <span className="font-medium text-theme-text-secondary capitalize">
                  {tc.toolName.replace(/_/g, ' ')}
                </span>
                {tc.result != null && (
                  <span className="text-theme-text-tertiary truncate ml-1">
                    {summarizeStreamingResult(tc)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <MarkdownBlock key={i} content={seg.content} />
        ),
      )}

      {/* Live streaming text from the current (in-progress) step */}
      {text && (
        <div>
          <MarkdownBlock content={text} />
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-theme-text-tertiary animate-pulse align-text-bottom" />
        </div>
      )}

      {/* Thinking dots when no text yet but steps have completed */}
      {!text && segments.length > 0 && segments[segments.length - 1]!.type === 'tool-calls' && (
        <div className="flex gap-1 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-theme-text-tertiary animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-theme-text-tertiary animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-theme-text-tertiary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  </div>
);

function summarizeStreamingResult(tc: ToolCallInfo): string {
  if (!tc.result) return '';
  const r = tc.result as Record<string, unknown>;

  // Compact text format — new format from all tools
  if (typeof r.data === 'string') {
    const firstLine = (r.data as string).split('\n')[0] ?? '';
    return `→ ${firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine}`;
  }

  // Success with details (legacy)
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
    return `→ error: ${(r.error as string) ?? 'unknown'}`;
  }
  if (r.error) return `→ error: ${(r.error as string) ?? 'unknown'}`;

  // Data results (legacy)
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

  // Profiling (legacy)
  if (r.rowCount != null && r.columnCount != null) return `→ ${r.rowCount} rows, ${r.columnCount} cols`;

  return '';
}

export default AIChatPanel;

// ---------------------------------------------------------------------------
// Chat Export
// ---------------------------------------------------------------------------

/** Tool name → description, matching AGENT_TOOLS in agent.ts */
const TOOL_DESCRIPTIONS: Record<string, string> = {
  add_tool: 'Add a new tool to the workflow canvas. Optionally connect via "after". Returns inline preview of the tool output when connected.',
  update_tool: 'Update a tool\'s configuration. For Join: always set leftKeys and rightKeys.',
  update_tools: 'Batch-update multiple tools in one call. Use instead of multiple update_tool calls when fixing config across several tools.',
  remove_tool: 'Remove a tool from the canvas. Also removes any wires connected to it.',
  connect_tools: 'Connect two tools with a wire.',
  disconnect_tools: 'Remove a wire between two tools.',
  batch_canvas_ops: 'Execute multiple canvas operations (add, connect, update, remove) in a single call with deferred layout.',
  list_available_files: 'List data files. Omit directory to see roots, or pass a root to list its files.',
  search_files: 'Search for data files by name across all directories.',
  preview_tool_output: 'Execute a tool and preview its output as CSV with typed headers.',
  get_column_metadata: 'Get column names and types for a tool\'s output without executing.',
  profile_tool_data: 'Get column statistics (min, max, mean, nulls, uniques, top values) for a tool\'s output.',
  build_workflow: 'Build a complete workflow from a simplified specification. Returns idMap and a data profile.',
  ask_user: 'Ask the user a clarifying question before proceeding. Pauses the agent loop until the user responds.',
};

function exportChatLog(messages: ChatMessageType[]): void {
  // Gather context from stores
  const aiState = useAIStore.getState();
  const { tools, wires, workflowMeta } = useWorkflowStore.getState();

  // Build the system prompt exactly as the agent receives it
  const systemPrompt = buildWorkflowSystemPrompt(tools, wires, workflowMeta, {
    auditEnabled: aiState.useAudit,
  });

  const lines: string[] = [];
  lines.push('# AI Chat Log (Debug Export)');
  lines.push('');
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push(`Messages: ${messages.length}`);
  lines.push('');

  // -----------------------------------------------------------------------
  // 1. Session configuration
  // -----------------------------------------------------------------------
  lines.push('## Session Configuration');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Provider | ${aiState.provider} |`);
  lines.push(`| Model | ${aiState.model} |`);
  if (aiState.baseUrl) {
    lines.push(`| Base URL | ${aiState.baseUrl} |`);
  }
  lines.push(`| Max Iterations | ${aiState.maxIterations} |`);
  lines.push(`| Audit Enabled | ${aiState.useAudit} |`);
  if (aiState.useAudit && aiState.useAuditModel) {
    lines.push(`| Audit Model | ${aiState.auditProvider}/${aiState.auditModel} |`);
  }
  if (aiState.useExpressionModel) {
    lines.push(`| Expression Model | ${aiState.expressionProvider}/${aiState.expressionModel} |`);
  }
  if (aiState.stoppedAtLimit) {
    lines.push(`| Status | Stopped at iteration limit |`);
  }
  lines.push('');

  // Token usage summary
  const su = aiState.sessionUsage;
  if (su.totalTokens > 0) {
    lines.push('### Token Usage Summary');
    lines.push('');
    lines.push(`| Metric | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Prompt Tokens | ${su.promptTokens.toLocaleString()} |`);
    lines.push(`| Completion Tokens | ${su.completionTokens.toLocaleString()} |`);
    lines.push(`| **Total Tokens** | **${su.totalTokens.toLocaleString()}** |`);

    // Per-turn breakdown
    const assistantMsgs = messages.filter((m) => m.role === 'assistant' && m.usage);
    if (assistantMsgs.length > 0) {
      lines.push('');
      lines.push('#### Per-Turn Breakdown');
      lines.push('');
      lines.push('| Turn | Prompt | Completion | Total | Tool Calls |');
      lines.push('|------|--------|------------|-------|------------|');
      let turnIdx = 0;
      for (const m of assistantMsgs) {
        turnIdx++;
        const u = m.usage!;
        const tcCount = m.toolCalls?.length ?? 0;
        lines.push(`| ${turnIdx} | ${u.promptTokens.toLocaleString()} | ${u.completionTokens.toLocaleString()} | ${u.totalTokens.toLocaleString()} | ${tcCount} |`);
      }
    }
    lines.push('');
  }

  // -----------------------------------------------------------------------
  // 2. Registered tool definitions
  // -----------------------------------------------------------------------
  lines.push('## Agent Tool Definitions');
  lines.push('');
  lines.push('These are the tools available to the agent during this session:');
  lines.push('');
  for (const [name, desc] of Object.entries(TOOL_DESCRIPTIONS)) {
    lines.push(`- **${name}**: ${desc}`);
  }
  lines.push('');

  // -----------------------------------------------------------------------
  // 3. Full system prompt
  // -----------------------------------------------------------------------
  lines.push('## System Prompt');
  lines.push('');
  lines.push('The complete system prompt sent to the model (includes canvas state, tool reference, and rules):');
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Click to expand system prompt</summary>');
  lines.push('');
  lines.push('````');
  lines.push(systemPrompt);
  lines.push('````');
  lines.push('');
  lines.push('</details>');
  lines.push('');

  // -----------------------------------------------------------------------
  // 4. Workflow state snapshot
  // -----------------------------------------------------------------------
  lines.push('## Workflow State (at export time)');
  lines.push('');
  lines.push(`**${workflowMeta.name}** — ${tools.length} tool(s), ${wires.length} wire(s)`);
  lines.push('');
  if (tools.length > 0) {
    lines.push('```');
    for (const t of tools) {
      const configKeys = Object.keys(t.config).filter((k) => k !== '_emit' && k !== 'actions' && k !== 'conditionGroup' && k !== 'placeholder');
      const configSummary = configKeys.length > 0
        ? configKeys.map((k) => {
            const v = t.config[k];
            const s = JSON.stringify(v);
            return `${k}=${s.length > 60 ? s.slice(0, 60) + '...' : s}`;
          }).join(', ')
        : '(default)';
      lines.push(`[${t.id.slice(0, 8)}] ${t.type} — ${configSummary}`);
    }
    lines.push('');
    for (const w of wires) {
      const from = tools.find((t) => t.id === w.from.tool);
      const to = tools.find((t) => t.id === w.to.tool);
      lines.push(`${from?.type ?? '?'}[${w.from.tool.slice(0, 8)}].${w.from.socket} -> ${to?.type ?? '?'}[${w.to.tool.slice(0, 8)}].${w.to.socket}`);
    }
    lines.push('```');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // -----------------------------------------------------------------------
  // 5. Messages (with full tool I/O and per-message token counts)
  // -----------------------------------------------------------------------
  lines.push('## Conversation');
  lines.push('');

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const roleLabel = msg.role === 'user' ? 'User' : 'AI Assistant';

    // Build usage badge for assistant messages
    let usageBadge = '';
    if (msg.usage) {
      usageBadge = `  [${msg.usage.promptTokens.toLocaleString()}p + ${msg.usage.completionTokens.toLocaleString()}c = ${msg.usage.totalTokens.toLocaleString()} tokens]`;
    }
    lines.push(`### ${roleLabel}  \`${time}\`${usageBadge}`);
    lines.push('');

    // Segmented messages (interleaved text + tool calls)
    if (msg.segments && msg.segments.length > 0) {
      for (const seg of msg.segments) {
        if (seg.type === 'text') {
          lines.push(seg.content);
          lines.push('');
        } else {
          for (const tc of seg.toolCalls) {
            lines.push(`#### Tool: \`${tc.toolName}\``);
            lines.push('');
            lines.push('**Input:**');
            lines.push('```json');
            lines.push(JSON.stringify(tc.args, null, 2));
            lines.push('```');
            lines.push('');
            if (tc.result != null) {
              lines.push('**Output:**');
              const resultStr = typeof (tc.result as Record<string, unknown>)?.data === 'string'
                ? (tc.result as Record<string, unknown>).data as string
                : JSON.stringify(tc.result, null, 2);
              lines.push('```');
              lines.push(resultStr);
              lines.push('```');
              lines.push('');
            }
          }
        }
      }
    } else if (msg.toolCalls && msg.toolCalls.length > 0) {
      // Legacy format: text + separate tool calls array
      if (msg.content) {
        lines.push(msg.content);
        lines.push('');
      }
      for (const tc of msg.toolCalls) {
        lines.push(`#### Tool: \`${tc.toolName}\``);
        lines.push('');
        lines.push('**Input:**');
        lines.push('```json');
        lines.push(JSON.stringify(tc.args, null, 2));
        lines.push('```');
        lines.push('');
        if (tc.result != null) {
          lines.push('**Output:**');
          const resultStr = typeof (tc.result as Record<string, unknown>)?.data === 'string'
            ? (tc.result as Record<string, unknown>).data as string
            : JSON.stringify(tc.result, null, 2);
          lines.push('```');
          lines.push(resultStr);
          lines.push('```');
          lines.push('');
        }
      }
    } else {
      // Plain text message
      lines.push(msg.content);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `ai-chat-log-${dateStr}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
