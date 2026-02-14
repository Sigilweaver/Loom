/**
 * AI Agent
 *
 * The agentic loop that powers the workflow builder.
 * Uses Vercel AI SDK's generateText with tool-use for multi-turn interaction.
 */

import { createLanguageModel } from './providers';
import { buildWorkflowSystemPrompt } from './prompts/system';
import { buildExpressionPrompt, buildBasicFilterPrompt, buildBasicFormulaPrompt } from './prompts/expression';
import { useAIStore, type ChatMessage, type TokenUsage } from '@state/aiStore';
import { useWorkflowStore } from '@state/workflowStore';
import { v4 as uuid } from 'uuid';

// Agent tools
import { getCanvasState, addTool, updateTool, removeTool, connectTools, disconnectTools } from './tools/canvas';
import { listAvailableFiles, previewToolOutput, getColumnMetadata } from './tools/data';
import { listToolTypesTool, getToolSchemaTool } from './tools/reference';
import { buildWorkflowTool } from './compilerTool';

// All tools available to the agent
const AGENT_TOOLS = {
  get_canvas_state: getCanvasState,
  add_tool: addTool,
  update_tool: updateTool,
  remove_tool: removeTool,
  connect_tools: connectTools,
  disconnect_tools: disconnectTools,
  list_available_files: listAvailableFiles,
  preview_tool_output: previewToolOutput,
  get_column_metadata: getColumnMetadata,
  list_tool_types: listToolTypesTool,
  get_tool_schema: getToolSchemaTool,
  build_workflow: buildWorkflowTool,
};

/**
 * Send a message to the AI agent and get a response.
 * Runs the full agentic loop with tool use.
 */
export async function sendAgentMessage(userPrompt: string): Promise<void> {
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

  // Add user message
  const userMsg: ChatMessage = {
    id: uuid(),
    role: 'user',
    content: userPrompt,
    timestamp: Date.now(),
  };
  store.addMessage(userMsg);

  // Set up generation state
  const abortController = new AbortController();
  store.setAbortController(abortController);
  store.setIsGenerating(true);
  store.setError(null);

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
    const systemPrompt = buildWorkflowSystemPrompt(tools, wires, workflowMeta);

    // Build message history for the LLM
    // Re-read state to include the user message we just added
    const messages = buildMessageHistory(useAIStore.getState().messages);

    // Dynamic import of generateText to keep AI SDK lazy
    const { generateText, stepCountIs } = await import('ai');

    // Run the agent loop
    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools: AGENT_TOOLS,
      stopWhen: stepCountIs(store.maxIterations),
      abortSignal: abortController.signal,
    });

    // Extract the response
    const assistantContent = result.text || '(No response)';

    // Collect tool call info from all steps
    const toolCallInfos = result.steps?.flatMap((step) =>
      (step.toolCalls ?? []).map((tc) => ({
        toolName: tc.toolName,
        args: tc.input as Record<string, unknown>,
        result: (step.toolResults ?? []).find((tr) => tr.toolCallId === tc.toolCallId)?.output,
      })),
    ) ?? [];

    // Calculate token usage
    const usage: TokenUsage = {
      promptTokens: result.usage?.inputTokens ?? 0,
      completionTokens: result.usage?.outputTokens ?? 0,
      totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
    };

    // Add assistant message
    const assistantMsg: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: assistantContent,
      timestamp: Date.now(),
      toolCalls: toolCallInfos.length > 0 ? toolCallInfos : [],
      usage,
    };
    store.addMessage(assistantMsg);
    store.addTokenUsage(usage);

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

  return relevant.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
}
