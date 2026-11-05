/**
 * Agent tool registry checks.
 *
 * The chat export and the model both read tool descriptions from AGENT_TOOLS
 * itself, so there is no second registry to keep in sync. These tests guard
 * the remaining drift points: tool names the system prompt and tool
 * descriptions mention must exist, and every tool must summarize into chat
 * history.
 */

import { describe, expect, it } from 'vitest';
import { getAgentToolDescriptions, summarizeToolResult } from '../agent';
import { buildWorkflowSystemPrompt } from '../prompts/system';
import type { WorkflowMeta } from '@domain/workflow/entities/workflow';

const tools = getAgentToolDescriptions();
const names = new Set(tools.map(([name]) => name));

const meta: WorkflowMeta = {
  name: 'Test',
  description: '',
  author: '',
  workflowId: 'w',
  created: '2026-01-01T00:00:00Z',
  defaultEngine: 'core/polars',
};

/** snake_case identifiers in backticks or bare that look like agent tool names. */
function mentionedToolNames(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)) found.add(m[1]!);
  for (const m of text.matchAll(/\b((?:add|update|patch|insert|remove|connect|disconnect|batch|list|search|preview|get|profile|describe|query|build|ask|validate|run)_[a-z_]+)\b/g)) {
    found.add(m[1]!);
  }
  return [...found];
}

describe('agent tool registry', () => {
  it('registers tools with snake_case names and real descriptions', () => {
    expect(tools.length).toBeGreaterThan(10);
    for (const [name, description] of tools) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(description.length, name).toBeGreaterThan(20);
    }
  });

  it('every tool name the system prompt mentions exists', () => {
    const prompt = buildWorkflowSystemPrompt([], [], meta, { auditEnabled: true });
    const unknown = mentionedToolNames(prompt).filter((n) => !names.has(n) && !NON_TOOL_IDENTIFIERS.has(n));
    expect(unknown).toEqual([]);
  });

  it('every tool name a tool description mentions exists', () => {
    const unknown: string[] = [];
    for (const [name, description] of tools) {
      for (const n of mentionedToolNames(description)) {
        if (!names.has(n) && !NON_TOOL_IDENTIFIERS.has(n)) unknown.push(`${name} -> ${n}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('summarizeToolResult handles every registered tool', () => {
    for (const [name] of tools) {
      expect(typeof summarizeToolResult(name, { success: true })).toBe('string');
    }
  });
});

/** snake_case words that appear in prompts but are config keys, not tools. */
const NON_TOOL_IDENTIFIERS = new Set([
  'column_name', 'is_null', 'is_not_null', 'not_contains', 'starts_with', 'ends_with',
  'has_header', 'sheet_name', 'sheet_id', 'include_header', 'is_true', 'is_false',
  'count_distinct',
]);
