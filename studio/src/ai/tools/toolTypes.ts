/**
 * Tool type resolution for agent tool calls.
 *
 * Models often use the display name shown on the canvas ("Aggregate",
 * "Read") instead of the internal type ("Summarize", "Input"), or get the
 * casing wrong. Resolve those to the internal type instead of failing.
 */

import { TOOL_DEFINITIONS } from '@data/tools';

/** Internal tool type for a type or display name, or undefined if unknown. */
export function resolveToolType(name: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  const def = TOOL_DEFINITIONS.find((d) => d.type.toLowerCase() === wanted)
    ?? TOOL_DEFINITIONS.find((d) => d.name.toLowerCase() === wanted);
  return def?.type;
}

/** Error text for an unknown tool type, listing what is available. */
export function unknownToolTypeError(name: string): string {
  const available = TOOL_DEFINITIONS
    .map((d) => (d.name !== d.type ? `${d.type} ("${d.name}")` : d.type))
    .join(', ');
  return `Unknown tool type: "${name}". Available types: ${available}`;
}

/**
 * Output socket used when a tool call names none. The first output is the
 * default except for Join, whose first output is the unmatched left rows:
 * an unqualified "after the join" means the matched rows.
 */
const DEFAULT_OUTPUT_SOCKET: Record<string, string> = {
  Join: 'output-match',
};

interface SocketLike {
  id: string;
  direction: 'input' | 'output';
}

export function defaultOutputSocket(tool: { type: string; sockets: SocketLike[] }): string | undefined {
  const outputs = tool.sockets.filter((s) => s.direction === 'output').map((s) => s.id);
  const preferred = DEFAULT_OUTPUT_SOCKET[tool.type];
  return preferred && outputs.includes(preferred) ? preferred : outputs[0];
}
