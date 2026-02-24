/**
 * Agent Audit
 *
 * Post-turn audit that reviews what the agent did against the user's request.
 * Uses a (potentially different) model to produce a verdict: pass or warning.
 */

import { createLanguageModel } from './providers';
import { useAIStore, type ChatMessage } from '@state/aiStore';
import { useWorkflowStore } from '@state/workflowStore';
import { v4 as uuid } from 'uuid';
import { createLogger } from '../utils/logger';

const logger = createLogger('AI:Audit');

/**
 * Run an audit of the agent's work after a turn completes.
 *
 * Compares the user's original request against what the agent actually did
 * (tool calls, final canvas state, agent's explanation) and produces either
 * a "pass" with a short confirmation, or a "warning" with what seems off.
 *
 * The audit result is appended as a special assistant message with a
 * distinctive prefix so the UI can render it differently.
 */
export async function runAudit(
  userMessage: string,
  agentMessage: ChatMessage,
): Promise<void> {
  const store = useAIStore.getState();

  if (!store.useAudit) return;

  const cfg = store.getAuditModelConfig();
  if (!cfg.model) {
    logger.warn('Audit enabled but no model configured — skipping');
    return;
  }

  try {
    const model = await createLanguageModel(
      cfg.provider,
      cfg.model,
      cfg.apiKey,
      cfg.baseUrl || undefined,
    );

    // Build context for the auditor
    const { tools, wires } = useWorkflowStore.getState();
    const canvasSummary = tools.length > 0
      ? tools.map((t) => {
          const commentNote = t.comment ? ` // "${t.comment}"` : ' // (no comment)';
          return `  ${t.type} [${t.id.slice(0, 8)}]${commentNote}`;
        }).join('\n')
      : '  (empty canvas)';
    const toolsWithoutComments = tools.filter((t) => !t.comment).length;
    const wireSummary = wires.length > 0
      ? wires.map((w) => {
          const from = tools.find((t) => t.id === w.from.tool);
          const to = tools.find((t) => t.id === w.to.tool);
          return `  ${from?.type ?? '?'} → ${to?.type ?? '?'}`;
        }).join('\n')
      : '  (no connections)';

    // Summarize what the agent did
    const toolCallSummary = (agentMessage.toolCalls ?? [])
      .map((tc) => `  ${tc.toolName}(${JSON.stringify(tc.args).slice(0, 200)})`)
      .join('\n');

    const systemPrompt = `You are an auditor reviewing an AI agent's work in a visual data pipeline builder (Sigilweaver Studio).

Your job is to compare what the USER asked for against what the AGENT actually did.

Respond with EXACTLY one of these formats:

If the work looks correct:
PASS: <one sentence explaining why the result matches the request>

If something seems wrong or incomplete:
WARNING: <one sentence explaining what's wrong or missing>

Rules:
- Be concise — one sentence only after PASS: or WARNING:
- Focus on whether the agent addressed the user's actual request
- Check that the right tool types were used (e.g. Aggregate for aggregation, not Calculate)
- Check that the workflow is structurally sound (tools are connected, data flows correctly)
- Check that ALL tools have descriptive comments — ${toolsWithoutComments > 0 ? `WARNING: ${toolsWithoutComments} tool(s) are missing comments, which is a quality issue` : 'all tools have comments (good)'}. Every tool must have a comment explaining what it does.
- If the agent created tools for multiple analyses, check they branch correctly from the Read
- Do NOT warn about stylistic choices, naming preferences, or minor variations
- Do NOT re-examine data correctness — only whether the pipeline design matches the request`;

    const userPrompt = `## User Request
${userMessage}

## Agent's Response
${agentMessage.content}

## Agent's Tool Calls
${toolCallSummary || '(none)'}

## Final Canvas State
Tools:
${canvasSummary}
Wires:
${wireSummary}`;

    const { generateText } = await import('ai');
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 200,
    });

    const auditText = (result.text ?? '').trim();
    if (!auditText) return;

    // Parse the verdict
    const isWarning = auditText.startsWith('WARNING:');
    const prefix = isWarning ? '⚠️ Audit' : '✅ Audit';

    const auditMsg: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: `${prefix}: ${auditText.replace(/^(PASS|WARNING):\s*/, '')}`,
      timestamp: Date.now(),
      segments: [{ type: 'text', content: `${prefix}: ${auditText.replace(/^(PASS|WARNING):\s*/, '')}` }],
    };

    store.addMessage(auditMsg);

    // Track token usage from the audit call
    if (result.usage) {
      store.addTokenUsage({
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      });
    }

    logger.info('Audit complete:', auditText.slice(0, 80));
  } catch (err) {
    logger.error('Audit failed:', err);
    // Non-fatal — don't surface audit failures to the user
  }
}
