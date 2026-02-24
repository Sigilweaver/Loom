/**
 * Tool-Registry Parity Test
 *
 * Validates that the runtime AGENT_TOOLS registry and the UI TOOL_DESCRIPTIONS
 * map stay in sync. This prevents drift where a tool is added to the agent
 * but not described in the UI (or vice versa).
 *
 * Strategy: Read the source files at test time and extract object keys via
 * regex. This avoids importing the modules (which pull in heavy AI SDK deps)
 * while still catching real drift automatically — no hardcoded canonical list
 * that a developer could forget to update.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Extract object keys from a source file section.
 * Matches lines like `  key_name: someValue,` within the first
 * occurrence of `const <objectName> = {` ... `};`.
 */
function extractObjectKeys(source: string, objectName: string): string[] {
  // Find the object declaration and its body
  const pattern = new RegExp(
    `(?:const|let|var)\\s+${objectName}\\s*(?::[^=]+=|=)\\s*\\{([^}]+)\\}`,
    's',
  );
  const match = source.match(pattern);
  if (!match) return [];

  const body = match[1]!;
  const keys: string[] = [];
  // Match keys like `  key_name:` (with optional quotes)
  for (const line of body.split('\n')) {
    const keyMatch = line.match(/^\s+['"]?([a-z][a-z0-9_]*)['"]?\s*:/);
    if (keyMatch) {
      keys.push(keyMatch[1]!);
    }
  }
  return keys;
}

// Read source files once
const agentSource = readFileSync(resolve(__dirname, '../agent.ts'), 'utf-8');
const chatPanelSource = readFileSync(
  resolve(__dirname, '../../components/ai/AIChatPanel.tsx'),
  'utf-8',
);

const agentToolKeys = extractObjectKeys(agentSource, 'AGENT_TOOLS');
const toolDescriptionKeys = extractObjectKeys(chatPanelSource, 'TOOL_DESCRIPTIONS');

describe('tool-registry parity', () => {
  it('should extract AGENT_TOOLS keys from source', () => {
    expect(agentToolKeys.length).toBeGreaterThan(0);
  });

  it('should extract TOOL_DESCRIPTIONS keys from source', () => {
    expect(toolDescriptionKeys.length).toBeGreaterThan(0);
  });

  it('AGENT_TOOLS and TOOL_DESCRIPTIONS should have the same keys', () => {
    const agentSet = new Set(agentToolKeys);
    const descSet = new Set(toolDescriptionKeys);

    const missingFromDescriptions = agentToolKeys.filter((k) => !descSet.has(k));
    const extraInDescriptions = toolDescriptionKeys.filter((k) => !agentSet.has(k));

    expect(missingFromDescriptions).toEqual([]);
    expect(extraInDescriptions).toEqual([]);
    expect(agentToolKeys.sort()).toEqual(toolDescriptionKeys.sort());
  });

  it('should have no duplicate entries in either registry', () => {
    expect(new Set(agentToolKeys).size).toBe(agentToolKeys.length);
    expect(new Set(toolDescriptionKeys).size).toBe(toolDescriptionKeys.length);
  });

  it('summarizeToolResult should handle every registered tool', async () => {
    // Dynamic import — only loads the summarize function
    const { summarizeToolResult } = await import('../agent');
    for (const tool of agentToolKeys) {
      const result = summarizeToolResult(tool, { success: true });
      expect(typeof result).toBe('string');
    }
  });

  it('tool names should be valid snake_case identifiers', () => {
    for (const tool of agentToolKeys) {
      expect(tool).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
