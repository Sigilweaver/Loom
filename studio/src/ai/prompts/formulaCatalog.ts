/**
 * Formula Operation Catalog for AI Prompts
 *
 * Builds a concise text catalog of available formula operations
 * for inclusion in the agent's system prompt. This tells the AI
 * what structured operations are available so it can use operationId
 * instead of writing raw Polars expressions.
 */

import { ALL_OPERATIONS, OPERATION_CATEGORY_LABELS, type OperationCategory } from '@components/config/prepare/formulaOperations';

/**
 * Build a compact operation catalog string for the system prompt.
 *
 * Groups operations by category and shows their IDs, applicable types,
 * and parameter keys. Designed to be token-efficient while giving the
 * agent enough information to use operations correctly.
 *
 * Example output:
 *   Math: add(operand, mode), subtract(operand, mode), round(decimals), abs(), ...
 *   Text: uppercase(), lowercase(), replace(pattern, replacement), ...
 */
export function buildFormulaCatalogForPrompt(): string {
  // Group operations by category
  const groups = new Map<OperationCategory, string[]>();

  for (const op of ALL_OPERATIONS) {
    const entries = groups.get(op.category) ?? [];

    // Build param hint
    const paramKeys = op.params
      .filter((p) => p.key !== 'mode') // mode is usually internal (value/column toggle)
      .map((p) => p.key);

    const paramHint = paramKeys.length > 0
      ? `(${paramKeys.join(', ')})`
      : '()';

    // Add type hint for operations that only work on specific types
    const typeHint = op.applicableTypes.includes('any')
      ? ''
      : ` [${op.applicableTypes.join('/')}]`;

    // Note if no source column needed
    const noSource = op.needsSourceColumn === false ? ' *no sourceColumn*' : '';

    entries.push(`${op.id}${paramHint}${typeHint}${noSource}`);
    groups.set(op.category, entries);
  }

  // Build output grouped by category
  const order: OperationCategory[] = ['math', 'text', 'datetime', 'type', 'null', 'conditional', 'other'];
  const lines: string[] = [];

  for (const cat of order) {
    const entries = groups.get(cat);
    if (entries && entries.length > 0) {
      lines.push(`  ${OPERATION_CATEGORY_LABELS[cat]}: ${entries.join(', ')}`);
    }
  }

  // Add param notes
  lines.push('');
  lines.push('  Params with mode: "value" (default) uses operand as literal, "column" uses it as column reference.');
  lines.push('  All param values must be strings. sourceColumn is the column the operation applies to.');

  return lines.join('\n');
}
