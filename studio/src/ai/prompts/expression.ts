/**
 * System Prompt — Expression Assist
 *
 * Constructs the prompt for AI-assisted Polars expression writing.
 * Used in Formula and Filter configuration panels (advanced/custom mode only).
 */

interface ColumnInfo {
  name: string;
  dtype: string;
  nullable?: boolean;
}

/**
 * Build the prompt for expression assistance.
 */
export function buildExpressionPrompt(
  columns: ColumnInfo[],
  userRequest: string,
  toolType: 'Filter' | 'Formula',
  polarsFunctions?: string[],
): string {
  const columnList = columns
    .map((c) => `  - ${c.name} (${c.dtype}${c.nullable ? ', nullable' : ''})`)
    .join('\n');

  const expressionHint = toolType === 'Filter'
    ? 'Return a boolean Polars expression that filters rows. Use `pl.col()` syntax.'
    : 'Return a Polars expression for computing a new column value. Use `pl.col()` syntax.';

  const functionsSection = polarsFunctions && polarsFunctions.length > 0
    ? `\nAvailable Polars functions:\n${polarsFunctions.slice(0, 50).join(', ')}${polarsFunctions.length > 50 ? '...' : ''}\n`
    : '';

  return `You are an expression assistant for Sigilweaver Loom Studio, a visual data pipeline tool.

You write Polars Python expressions for ${toolType} tools.

Available columns:
${columnList}
${functionsSection}
${expressionHint}

## Syntax Rules (CRITICAL)

1. **Always wrap each comparison in parentheses** when using \`&\` or \`|\`:
   WRONG:  \`pl.col("a") > 10 & pl.col("b") < 5\`
   CORRECT: \`(pl.col("a") > 10) & (pl.col("b") < 5)\`

2. **Add inline comments** explaining each part of the expression:
   \`(pl.col("Age") > 18) & (pl.col("Survived") == 1)  # Adults who survived\`

   For multi-condition expressions, comment each condition:
   \`(pl.col("Survived") == 1   # Survivors only\n) & (pl.col("Sex") == "female"  # Female passengers\n)\`

3. **Handle nullable columns** — when a column is nullable, guard with \`.fill_null()\` or \`.is_not_null()\`.

## Output Format

- Return ONLY the expression, no explanation or markdown formatting.
- Do not wrap in quotes or backticks.
- Include inline comments as shown above.
- Column names are case-sensitive — use exactly as listed.
- Expressions must be valid Polars lazy-compatible Python.

User request: ${userRequest}`;
}

/**
 * Build a prompt for generating structured filter conditions (basic mode).
 * Returns JSON instead of raw expressions.
 */
export function buildBasicFilterPrompt(
  columns: ColumnInfo[],
  userRequest: string,
): string {
  const columnList = columns
    .map((c) => `  - ${c.name} (${c.dtype}${c.nullable ? ', nullable' : ''})`)
    .join('\n');

  return `You are a filter condition builder for Sigilweaver Loom Studio, a visual data pipeline tool.

Given a natural-language request, produce a JSON array of structured filter conditions.
Do NOT write Polars expressions — output JSON only.

Available columns:
${columnList}

## Operators

Numeric/temporal columns: eq, neq, gt, lt, gte, lte, is_null, is_not_null
String columns: eq, neq, contains, not_contains, starts_with, ends_with, is_null, is_not_null
Boolean columns: is_true, is_false, is_null, is_not_null

## Output Format

Return a JSON object with this exact shape:
{
  "conditions": [
    { "column": "Age", "operator": "gt", "value": "18" },
    { "column": "Status", "operator": "eq", "value": "active" }
  ],
  "combinator": "and"
}

For mixed AND/OR logic, use groups:
{
  "conditions": [
    { "column": "Status", "operator": "eq", "value": "active" }
  ],
  "groups": [
    {
      "conditions": [
        { "column": "Priority", "operator": "eq", "value": "high" },
        { "column": "Priority", "operator": "eq", "value": "critical" }
      ],
      "combinator": "or"
    }
  ],
  "combinator": "and"
}

Rules:
- Column names are case-sensitive — use exactly as listed.
- All values must be strings (e.g. "18" not 18).
- Use the simplest combinator structure possible.
- Return ONLY the JSON object. No explanation, no markdown, no code fences.

User request: ${userRequest}`;
}

/**
 * Build a prompt for generating structured formula operations (basic mode).
 * Returns JSON operation configs instead of raw expressions.
 */
export function buildBasicFormulaPrompt(
  columns: ColumnInfo[],
  userRequest: string,
  operationCatalog: string,
): string {
  const columnList = columns
    .map((c) => `  - ${c.name} (${c.dtype}${c.nullable ? ', nullable' : ''})`)
    .join('\n');

  return `You are a formula operation builder for Sigilweaver Loom Studio, a visual data pipeline tool.

Given a natural-language request, produce a JSON array of structured formula operations.
Do NOT write Polars expressions — output JSON only.

Available columns:
${columnList}

## Available operations and their parameters:
${operationCatalog}

## Output Format

Return a JSON array of operations:
[
  {
    "operationId": "multiply",
    "sourceColumn": "Price",
    "params": { "mode": "value", "operand": "1.1" },
    "columnName": "Price_adjusted"
  }
]

Multiple operations example (add two new columns):
[
  {
    "operationId": "uppercase",
    "sourceColumn": "Name",
    "params": {},
    "columnName": "Name_upper"
  },
  {
    "operationId": "round",
    "sourceColumn": "Score",
    "params": { "decimals": "2" },
    "columnName": "Score_rounded"
  }
]

Rules:
- Column names are case-sensitive — use exactly as listed.
- All param values must be strings.
- Choose an appropriate output columnName that describes the result.
- Return ONLY the JSON array. No explanation, no markdown, no code fences.

User request: ${userRequest}`;
}
