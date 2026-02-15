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
import { v4 as uuid } from 'uuid';

// Agent tools
import { addTool, updateTool, removeTool, connectTools, disconnectTools } from './tools/canvas';
import { listAvailableFiles, previewToolOutput, getColumnMetadata, searchFilesTool, profileToolData } from './tools/data';
import { buildWorkflowTool } from './compilerTool';

// All tools available to the agent
const AGENT_TOOLS = {
  add_tool: addTool,
  update_tool: updateTool,
  remove_tool: removeTool,
  connect_tools: connectTools,
  disconnect_tools: disconnectTools,
  list_available_files: listAvailableFiles,
  search_files: searchFilesTool,
  preview_tool_output: previewToolOutput,
  get_column_metadata: getColumnMetadata,
  profile_tool_data: profileToolData,
  build_workflow: buildWorkflowTool,
};

/**
 * Send a message to the AI agent and get a response.
 * Uses streamText for real-time streaming of text and tool calls.
 *
 * @param userPrompt - The user's message, or undefined to continue from where the agent left off.
 */
export async function sendAgentMessage(userPrompt?: string): Promise<void> {
  const store = useAIStore.getState();

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
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
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
        // Reset streaming text since it was for this step — next step starts fresh
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

    // Run post-turn audit if enabled (async, non-blocking on the main response)
    if (userPrompt && !abortController.signal.aborted) {
      await runAudit(userPrompt, assistantMsg);
    }

    // Check if we stopped because we hit the iteration limit.
    // finishReason === 'tool-calls' means the model wanted to make more tool calls
    // but was stopped by our stopWhen condition. We also defensively check the
    // step count and whether the last step had tool calls, because some providers
    // may report a different finishReason even when interrupted mid-tool-calling.
    const lastStepToolCalls = steps[steps.length - 1]?.toolCalls ?? [];
    const hitIterationLimit = steps.length >= store.maxIterations;
    if (finishReason === 'tool-calls' || (hitIterationLimit && lastStepToolCalls.length > 0)) {
      store.setStoppedAtLimit(true);
    }

  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      store.setError('Generation cancelled.');
    } else {
      const message = err instanceof Error ? err.message : String(err);
      store.setError(`Agent error: ${message}`);

      // Add error as assistant message so user sees it in chat
      const errorMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: `Error: ${message}`,
        timestamp: Date.now(),
      };
      store.addMessage(errorMsg);
    }
  } finally {
    store.setIsGenerating(false);
    store.setAbortController(null);
    store.setStreamingText('');
    store.setStreamingSegments([]);
  }
}

/**
 * Generate a Polars expression using AI.
 * Lighter-weight than the full agent — no tool use, just prompt-in/expression-out.
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
 * Returns JSON conditions — not raw Polars expressions.
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
    const parsed = JSON.parse(cleaned) as BasicFilterResult;
    return { result: parsed };
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
 * Returns JSON operation configs — not raw Polars expressions.
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
    const parsed = JSON.parse(cleaned) as BasicFormulaOperation[];
    return { result: parsed };
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
 * For assistant messages that include tool calls, a summary of each tool
 * invocation and its result is appended to the content. This ensures the
 * model retains context about what actions it performed when continuing
 * after a turn limit or when referencing earlier turns.
 */
function buildMessageHistory(
  messages: ChatMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Only send user and assistant messages (skip tool messages)
  // Keep the last N messages to avoid exceeding context limits
  const MAX_HISTORY = 40;
  const relevant = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_HISTORY);

  return relevant.map((m) => {
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const toolSummaries = m.toolCalls.map((tc) => {
        const resultSummary = summarizeToolResult(tc.toolName, tc.result);
        return `[${tc.toolName} → ${resultSummary}]`;
      }).join('\n');

      const textPart = m.content && m.content !== '(No response)' ? m.content : '';
      const content = textPart
        ? `${textPart}\n\n${toolSummaries}`
        : toolSummaries;

      return { role: 'assistant' as const, content };
    }

    return {
      role: m.role as 'user' | 'assistant',
      content: m.content,
    };
  });
}

/**
 * Produce a compact summary of a tool result for message history.
 * Avoids sending raw JSON — extracts the key facts instead.
 */
function summarizeToolResult(toolName: string, result: unknown): string {
  if (result == null) return '(no result)';
  const r = result as Record<string, unknown>;

  // Error result
  if (r.error) return `error: ${truncateStr(String(r.error), 150)}`;

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
    case 'remove_tool':
      return `removed ${r.removedType}`;
    case 'connect_tools':
    case 'disconnect_tools':
      return r.success ? 'ok' : 'failed';
    case 'profile_tool_data':
      return `${r.rowCount} rows, ${r.columnCount} cols profiled`;
    case 'list_available_files':
      if (r.roots) return `roots: ${(r.roots as string[]).join(', ')}`;
      return `${((r.files as unknown[]) ?? []).length} files`;
    default:
      return truncateStr(JSON.stringify(r), 200);
  }
}

/** Truncate a string to a maximum length, appending "…" if truncated. */
function truncateStr(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '…';
}
