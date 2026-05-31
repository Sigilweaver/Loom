/**
 * AI Agent
 *
 * The agentic loop that powers the workflow builder.
 * Uses Vercel AI SDK's generateText with tool-use for multi-turn interaction.
 */

import { createLanguageModel } from './providers';
import { buildWorkflowSystemPrompt } from './prompts/system';
import { buildExpressionPrompt, buildBasicFilterPrompt, buildBasicFormulaPrompt } from './prompts/expression';
import { runAudit } from './audit';
import { useAIStore, type ChatMessage, type TokenUsage, type MessageSegment } from '@state/aiStore';
import { useWorkflowStore } from '@state/workflowStore';
import { useTabStore } from '@state/tabStore';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

// Agent tools
import { addTool, updateTool, updateTools, patchToolConfig, insertToolBetween, removeTool, connectTools, disconnectTools, batchCanvasOps } from './tools/canvas';
import { listAvailableFiles, previewToolOutput, getColumnMetadata, searchFilesTool, profileToolData, listDatabaseConnections, describeSchema, queryDatabase } from './tools/data';
import { askUser } from './tools/interaction';
import { buildWorkflowTool } from './compilerTool';

// All tools available to the agent
const AGENT_TOOLS = {
  add_tool: addTool,
  update_tool: updateTool,
  update_tools: updateTools,
  patch_tool_config: patchToolConfig,
  insert_tool_between: insertToolBetween,
  remove_tool: removeTool,
  connect_tools: connectTools,
  disconnect_tools: disconnectTools,
  batch_canvas_ops: batchCanvasOps,
  list_available_files: listAvailableFiles,
  search_files: searchFilesTool,
  preview_tool_output: previewToolOutput,
  get_column_metadata: getColumnMetadata,
  profile_tool_data: profileToolData,
  list_database_connections: listDatabaseConnections,
  describe_schema: describeSchema,
  query_database: queryDatabase,
  build_workflow: buildWorkflowTool,
  ask_user: askUser,
};

/**
 * Get the tab ID that currently owns the running agent.
 * Canvas tools use this to verify they're writing to the correct tab.
 * Returns null when no agent is running.
 */
export function getAgentTabId(): string | null {
  return useAIStore.getState().agentTabId;
}

/**
 * Send a message to the AI agent and get a response.
 * Uses streamText for real-time streaming of text and tool calls.
 *
 * **Per-tab concurrency**: Only one agent run is allowed per tab at a time.
 * If the agent is already generating, the prompt is queued and will be
 * sent automatically when the current run finishes.
 *
 * @param userPrompt - The user's message, or undefined to continue from where the agent left off.
 */
export async function sendAgentMessage(userPrompt?: string): Promise<void> {
  const store = useAIStore.getState();
  const tabId = useTabStore.getState().activeTabId;

  // --- Re-entrancy guard: one run per tab at a time ---
  if (store.isGenerating) {
    if (userPrompt && tabId) {
      store.enqueuePrompt(tabId, userPrompt);
    }
    return;
  }

  if (!store.enabled) {
    store.setError('AI features are not enabled. Enable them in Settings.');
    return;
  }

  if (!store.apiKey && store.provider !== 'openai-compatible') {
    store.setError('No API key configured. Add one in Settings → AI.');
    return;
  }

  if (!store.model) {
    store.setError('No model selected. Choose one in Settings → AI.');
    return;
  }

  // Add user message (only if this is a new prompt, not a continuation)
  if (userPrompt) {
    const userMsg: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: userPrompt,
      timestamp: Date.now(),
    };
    store.addMessage(userMsg);
  }

  // Set up generation state
  const abortController = new AbortController();
  store.setAbortController(abortController);
  store.setIsGenerating(true);
  store.setAgentTabId(tabId);
  store.setError(null);
  store.setStreamingText('');
  store.setStreamingSegments([]);
  store.setStoppedAtLimit(false);

  try {
    // Create the language model
    const model = await createLanguageModel(
      store.provider,
      store.model,
      store.apiKey,
      store.baseUrl || undefined,
    );

    // Build system prompt with current canvas context
    const { tools, wires, workflowMeta } = useWorkflowStore.getState();
    const systemPrompt = buildWorkflowSystemPrompt(tools, wires, workflowMeta, {
      auditEnabled: store.useAudit,
    });

    // Build message history for the LLM
    // Re-read state to include the user message we just added
    const messages = buildMessageHistory(useAIStore.getState().messages);

    // Dynamic import of streamText to keep AI SDK lazy
    const { streamText, stepCountIs } = await import('ai');

    // Run the agent loop with streaming
    // System prompt is passed as a message (not the `system` param) so we can
    // attach Anthropic cacheControl. Other providers ignore providerOptions.
    const result = streamText({
      model,
      messages: [
        {
          role: 'system' as const,
          content: systemPrompt,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        ...messages,
      ],
      tools: AGENT_TOOLS,
      stopWhen: stepCountIs(store.maxIterations),
      abortSignal: abortController.signal,
      onStepFinish: (step) => {
        // Build interleaved segments from each step as it completes
        const stepToolCalls = (step.toolCalls ?? []).map((tc) => ({
          toolName: tc.toolName,
          args: tc.input as Record<string, unknown>,
          result: (step.toolResults ?? []).find((tr) => tr.toolCallId === tc.toolCallId)?.output,
        }));
        // Push the completed step's segments (text then tool calls)
        // Reset streaming text since it was for this step - next step starts fresh
        useAIStore.getState().addStreamingStepSegments(step.text || '', stepToolCalls);
        useAIStore.getState().setStreamingText('');
      },
    });

    // Stream text deltas into the store
    for await (const delta of result.textStream) {
      if (abortController.signal.aborted) break;
      useAIStore.getState().appendStreamingText(delta);
    }

    // Wait for all steps to complete to get final data
    const [, steps, totalUsage, finishReason] = await Promise.all([
      result.text,
      result.steps,
      result.totalUsage,
      result.finishReason,
    ]);

    // Collect all tool calls from all steps
    const toolCallInfos = steps.flatMap((step) =>
      (step.toolCalls ?? []).map((tc) => ({
        toolName: tc.toolName,
        args: tc.input as Record<string, unknown>,
        result: (step.toolResults ?? []).find((tr) => tr.toolCallId === tc.toolCallId)?.output,
      })),
    );

    // Build interleaved segments from steps so tool calls appear where they happened
    const segments: MessageSegment[] = [];
    for (const step of steps) {
      const stepToolCalls = (step.toolCalls ?? []).map((tc) => ({
        toolName: tc.toolName,
        args: tc.input as Record<string, unknown>,
        result: (step.toolResults ?? []).find((tr) => tr.toolCallId === tc.toolCallId)?.output,
      }));
      // Text first (model "says" something), then tool calls (model "does" something)
      if (step.text) {
        segments.push({ type: 'text', content: step.text });
      }
      if (stepToolCalls.length > 0) {
        segments.push({ type: 'tool-calls', toolCalls: stepToolCalls });
      }
    }

    // Calculate token usage
    const usage: TokenUsage = {
      promptTokens: totalUsage.inputTokens ?? 0,
      completionTokens: totalUsage.outputTokens ?? 0,
      totalTokens: (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0),
    };

    // Add assistant message with all tool calls and final text.
    // Collect ALL text from every step (not just the last one) so the message
    // content is meaningful even when the final step had only tool calls.
    const allStepTexts = steps.map((s) => s.text).filter(Boolean);
    const combinedText = allStepTexts.join('\n\n');
    const assistantContent = combinedText || (toolCallInfos.length > 0
      ? `Performed ${toolCallInfos.length} tool call${toolCallInfos.length > 1 ? 's' : ''}.`
      : '(No response)');
    const assistantMsg: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: assistantContent,
      timestamp: Date.now(),
      toolCalls: toolCallInfos.length > 0 ? toolCallInfos : [],
      ...(segments.length > 0 ? { segments } : {}),
      usage,
    };
    store.addMessage(assistantMsg);
    store.addTokenUsage(usage);

    // Check if we stopped because we hit the iteration limit.
    // finishReason === 'tool-calls' means the model wanted to make more tool calls
    // but was stopped by our stopWhen condition. We also defensively check the
    // step count and whether the last step had tool calls, because some providers
    // may report a different finishReason even when interrupted mid-tool-calling.
    const lastStepToolCalls = steps[steps.length - 1]?.toolCalls ?? [];
    const hitIterationLimit = steps.length >= store.maxIterations;
    const stoppedEarly = finishReason === 'tool-calls' || (hitIterationLimit && lastStepToolCalls.length > 0);
    if (stoppedEarly) {
      store.setStoppedAtLimit(true);
    }

    // Run post-turn audit only when the agent completed its work naturally
    // (not when it was stopped at the iteration limit or aborted by the user)
    if (userPrompt && !abortController.signal.aborted && !stoppedEarly) {
      await runAudit(userPrompt, assistantMsg);
    }

  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      store.setError('Generation cancelled.');
    } else {
      const message = err instanceof Error ? err.message : String(err);
      const classified = classifyError(message);
      store.setError(`Agent error: ${classified.displayMessage}`);

      // Add error as assistant message so user sees it in chat
      const errorMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: `Error: ${classified.displayMessage}`,
        timestamp: Date.now(),
      };
      store.addMessage(errorMsg);
    }
  } finally {
    // Capture the tab this agent was running on before clearing state
    const finishedTabId = useAIStore.getState().agentTabId;

    store.setIsGenerating(false);
    store.setAbortController(null);
    store.setAgentTabId(null);
    store.setStreamingText('');
    store.setStreamingSegments([]);

    // Auto-dequeue: if there's a queued prompt for this tab and the tab
    // is still active, send it automatically.
    if (finishedTabId) {
      const activeTab = useTabStore.getState().activeTabId;
      if (activeTab === finishedTabId) {
        const next = useAIStore.getState().dequeuePrompt(finishedTabId);
        if (next) {
          // Fire-and-forget - don't await to avoid recursive stack growth
          void sendAgentMessage(next);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

interface ClassifiedError {
  category: 'auth' | 'rate-limit' | 'network' | 'overloaded' | 'unknown';
  displayMessage: string;
  retryable: boolean;
}

/**
 * Classify an error message into a user-friendly category.
 * Helps users understand whether to fix config, wait, or retry.
 */
export function classifyError(message: string): ClassifiedError {
  const lower = message.toLowerCase();

  // Authentication / authorization errors
  if (lower.includes('401') || lower.includes('403') || lower.includes('invalid api key')
      || lower.includes('unauthorized') || lower.includes('authentication')
      || lower.includes('permission denied')) {
    return {
      category: 'auth',
      displayMessage: 'Authentication failed - check your API key in Settings → AI.',
      retryable: false,
    };
  }

  // Rate limiting
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')
      || lower.includes('quota exceeded')) {
    return {
      category: 'rate-limit',
      displayMessage: 'Rate limited by provider - wait a moment and try again.',
      retryable: true,
    };
  }

  // Provider overloaded
  if (lower.includes('503') || lower.includes('overloaded') || lower.includes('capacity')
      || lower.includes('temporarily unavailable')) {
    return {
      category: 'overloaded',
      displayMessage: 'Provider temporarily overloaded - try again in a few seconds.',
      retryable: true,
    };
  }

  // Network / connection errors
  if (lower.includes('502') || lower.includes('504') || lower.includes('could not connect')
      || lower.includes('econnrefused') || lower.includes('enotfound')
      || lower.includes('network') || lower.includes('timeout')
      || lower.includes('fetch failed') || lower.includes('econnreset')) {
    return {
      category: 'network',
      displayMessage: `Connection error: ${message}. Is the Sigilweaver Loom Server running?`,
      retryable: true,
    };
  }

  // Unknown
  return {
    category: 'unknown',
    displayMessage: message,
    retryable: false,
  };
}

/**
 * Generate a Polars expression using AI.
 * Lighter-weight than the full agent - no tool use, just prompt-in/expression-out.
 */
export async function generateExpression(
  userRequest: string,
  columns: Array<{ name: string; dtype: string; nullable?: boolean }>,
  toolType: 'Filter' | 'Formula',
  polarsFunctions?: string[],
): Promise<{ expression?: string; error?: string }> {
  const store = useAIStore.getState();

  if (!store.enabled || !store.model) {
    return { error: 'AI is not configured. Enable it in Settings.' };
  }

  try {
    const cfg = store.getExpressionModelConfig();
    const model = await createLanguageModel(
      cfg.provider,
      cfg.model,
      cfg.apiKey,
      cfg.baseUrl || undefined,
    );

    const prompt = buildExpressionPrompt(columns, userRequest, toolType, polarsFunctions);

    const { generateText } = await import('ai');

    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 500,
    });

    const expression = result.text?.trim() ?? '';
    return { expression };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Parsed basic filter output. */
export interface BasicFilterResult {
  conditions: Array<{ column: string; operator: string; value: string }>;
  groups?: Array<{ conditions: Array<{ column: string; operator: string; value: string }>; combinator: string }>;
  combinator: string;
}

/**
 * Generate structured filter conditions from natural language (basic mode).
 * Returns JSON conditions - not raw Polars expressions.
 */
export async function generateBasicFilter(
  userRequest: string,
  columns: Array<{ name: string; dtype: string; nullable?: boolean }>,
): Promise<{ result?: BasicFilterResult; error?: string }> {
  const store = useAIStore.getState();

  if (!store.enabled || !store.model) {
    return { error: 'AI is not configured. Enable it in Settings.' };
  }

  try {
    const cfg = store.getExpressionModelConfig();
    const model = await createLanguageModel(
      cfg.provider,
      cfg.model,
      cfg.apiKey,
      cfg.baseUrl || undefined,
    );

    const prompt = buildBasicFilterPrompt(columns, userRequest);
    const { generateText } = await import('ai');

    const response = await generateText({
      model,
      prompt,
      maxOutputTokens: 1000,
    });

    const text = (response.text ?? '').trim();
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Schema-validate the parsed output
    const filterSchema = z.object({
      conditions: z.array(z.object({
        column: z.string(),
        operator: z.string(),
        value: z.string().optional(),
      })),
      groups: z.array(z.object({
        conditions: z.array(z.object({
          column: z.string(),
          operator: z.string(),
          value: z.string().optional(),
        })),
        combinator: z.string().optional(),
      })).optional(),
      combinator: z.string(),
    });

    const validated = filterSchema.safeParse(parsed);
    if (!validated.success) {
      const issues = validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { error: `Invalid filter structure from AI: ${issues}` };
    }

    return { result: validated.data as BasicFilterResult };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Parsed basic formula operation output. */
export interface BasicFormulaOperation {
  operationId: string;
  sourceColumn: string;
  params: Record<string, string>;
  columnName: string;
}

/**
 * Generate structured formula operations from natural language (basic mode).
 * Returns JSON operation configs - not raw Polars expressions.
 */
export async function generateBasicFormula(
  userRequest: string,
  columns: Array<{ name: string; dtype: string; nullable?: boolean }>,
  operationCatalog: string,
): Promise<{ result?: BasicFormulaOperation[]; error?: string }> {
  const store = useAIStore.getState();

  if (!store.enabled || !store.model) {
    return { error: 'AI is not configured. Enable it in Settings.' };
  }

  try {
    const cfg = store.getExpressionModelConfig();
    const model = await createLanguageModel(
      cfg.provider,
      cfg.model,
      cfg.apiKey,
      cfg.baseUrl || undefined,
    );

    const prompt = buildBasicFormulaPrompt(columns, userRequest, operationCatalog);
    const { generateText } = await import('ai');

    const response = await generateText({
      model,
      prompt,
      maxOutputTokens: 1000,
    });

    const text = (response.text ?? '').trim();
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Schema-validate the parsed output
    const formulaOpSchema = z.object({
      operationId: z.string(),
      sourceColumn: z.string(),
      params: z.record(z.string(), z.string()).default({}),
      columnName: z.string(),
    });
    const formulaArraySchema = z.array(formulaOpSchema);

    const validated = formulaArraySchema.safeParse(parsed);
    if (!validated.success) {
      const issues = validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { error: `Invalid formula structure from AI: ${issues}` };
    }

    return { result: validated.data as BasicFormulaOperation[] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert chat messages to the format expected by the Vercel AI SDK.
 *
 * Uses **token-budgeted packing** instead of a fixed message count.
 * Estimates token usage per message and packs as many recent messages
 * as fit within the budget, ensuring the most recent context is always
 * included.
 *
 * For assistant messages that include tool calls, a summary of each tool
 * invocation and its result is appended to the content. This ensures the
 * model retains context about what actions it performed.
 *
 * @internal Exported for testing only.
 */
export function buildMessageHistory(
  messages: ChatMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Only send user and assistant messages (skip tool messages)
  const relevant = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant');

  // Token budget for message history (approximate chars ÷ 4 ≈ tokens)
  // Reserve ~60k tokens for history, which is comfortable for most models
  const TOKEN_BUDGET = 60_000;
  // Rough estimate: 1 token ≈ 4 characters (conservative for English text)
  const CHARS_PER_TOKEN = 4;
  const CHAR_BUDGET = TOKEN_BUDGET * CHARS_PER_TOKEN;

  // Build formatted messages from most recent first, stopping when budget is exhausted
  const formatted: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let charCount = 0;

  for (let i = relevant.length - 1; i >= 0; i--) {
    const m = relevant[i]!;
    let content: string;

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const toolSummaries = m.toolCalls.map((tc) => {
        const resultSummary = summarizeToolResult(tc.toolName, tc.result);
        return `[${tc.toolName} → ${resultSummary}]`;
      }).join('\n');

      const textPart = m.content && m.content !== '(No response)' ? m.content : '';
      content = textPart
        ? `${textPart}\n\n${toolSummaries}`
        : toolSummaries;
    } else {
      content = m.content;
    }

    const msgChars = content.length;

    // Always include the most recent message (first iteration)
    if (formatted.length > 0 && charCount + msgChars > CHAR_BUDGET) {
      break;
    }

    charCount += msgChars;
    formatted.unshift({
      role: m.role as 'user' | 'assistant',
      content,
    });
  }

  return formatted;
}

/**
 * Produce a compact summary of a tool result for message history.
 * Avoids sending raw output - extracts the key facts instead.
 *
 * Most tools now return `{ data: "compact text" }`. For those, we
 * extract the first line (or truncate) as the summary. Legacy JSON
 * result shapes are still handled for backward compat.
 * @internal Exported for testing only.
 */
export function summarizeToolResult(toolName: string, result: unknown): string {
  if (result == null) return '(no result)';
  const r = result as Record<string, unknown>;

  // Error result
  if (r.error) return `error: ${truncateStr(String(r.error), 150)}`;

  // Compact text format - used by preview, add_tool, build_workflow, profile
  if (typeof r.data === 'string') {
    // For message history, take just the first line as a summary
    const firstLine = (r.data as string).split('\n')[0] ?? '';
    return truncateStr(firstLine, 200);
  }

  // Legacy JSON result shapes (backward compat)
  switch (toolName) {
    case 'build_workflow':
      return `${r.toolCount} tools, ${r.wireCount} wires` +
        (r.inputColumns ? `, columns: ${(r.inputColumns as Array<{name: string}>).map(c => c.name).join(', ')}` : '');
    case 'preview_tool_output':
      return `${r.rowCount ?? '?'} rows, schema: ${((r.schema as Array<{name: string}>) ?? []).map(c => c.name).join(', ')}`;
    case 'get_column_metadata':
      return `cols: ${((r.columns as Array<{name: string; dtype: string}>) ?? []).map(c => `${c.name}(${c.dtype})`).join(', ')}`;
    case 'search_files':
      return `${((r.results as unknown[]) ?? []).length} results` +
        ((r.results as Array<{path: string}>) ?? []).slice(0, 3).map(f => ` ${f.path}`).join(',');
    case 'add_tool':
      return `${r.type} [${r.toolId}]${r.connected ? ' connected' : ''}`;
    case 'update_tool':
      return `updated ${(r.updatedFields as string[] ?? []).join(', ')}`;
    case 'update_tools':
      return r.summary ? String(r.summary) : `batch update: ${((r.results as unknown[]) ?? []).length} tools`;
    case 'batch_canvas_ops': {
      const opsResults = (r.results as Array<{ success: boolean }>) ?? [];
      const succeeded = opsResults.filter((o) => o.success).length;
      const mapEntries = r.idMap ? Object.keys(r.idMap as Record<string, string>).length : 0;
      return `batch: ${succeeded}/${opsResults.length} ops${mapEntries > 0 ? `, ${mapEntries} refs` : ''}`;
    }
    case 'ask_user': {
      const ans = r.answer;
      const display = Array.isArray(ans) ? (ans as string[]).join(', ') : String(ans ?? '');
      return `user answered: ${truncateStr(display, 100)}`;
    }
    case 'remove_tool':
      return `removed ${r.removedType}`;
    case 'connect_tools':
    case 'disconnect_tools':
      return r.success ? 'ok' : 'failed';
    case 'profile_tool_data':
      return `${r.rowCount} rows, ${r.columnCount} cols profiled`;
    case 'list_available_files':
      if (r.roots) return `${(r.roots as string[]).length} roots: ${(r.roots as string[]).join(', ')}`;
      return `${r.count ?? ((r.files as unknown[]) ?? []).length} files in ${r.directory ?? 'unknown'}`;
    default:
      return truncateStr(JSON.stringify(r), 200);
  }
}

/** Truncate a string to a maximum length, appending "…" if truncated. */
function truncateStr(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '…';
}
