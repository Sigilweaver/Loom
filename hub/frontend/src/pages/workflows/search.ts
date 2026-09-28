/**
 * Fuzzy search for the workflows list.
 *
 * Scores are only meaningful relative to each other: exact and prefix matches
 * beat substring matches, which beat loose "letters appear in order" matches.
 */

import type { WorkflowMetadata } from "@api";

/**
 * Score how well `query` matches `target` (0 = no match).
 *
 *   fuzzyMatch("fltr", "filter") -> matches (letters appear in order)
 *   fuzzyMatch("abc", "aXbXc")   -> matches, but scores lower than a substring hit
 */
export function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q.length === 0) return 1;
  if (q.length > t.length) return 0;

  if (t === q) return 100;
  if (t.startsWith(q)) return 90;

  if (t.includes(q)) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}`).test(t) ? 75 : 60;
  }

  // Subsequence match: every query letter must appear, in order.
  let qIdx = 0;
  let score = 0;
  let consecutiveBonus = 0;
  let firstMatchIdx = -1;
  let lastMatchIdx = -2;

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] !== q[qIdx]) continue;

    score += 10;
    if (firstMatchIdx === -1) firstMatchIdx = tIdx;
    if (tIdx === lastMatchIdx + 1) consecutiveBonus += 5;

    // Bonus for matching at the start or after a separator.
    const prev = t[tIdx - 1];
    if (tIdx === 0 || (prev && /[\s_\-./]/.test(prev))) score += 8;

    // Bonus for matching a capital letter inside a camelCase word.
    const original = target[tIdx];
    const prevOriginal = target[tIdx - 1];
    if (original && prevOriginal && original === original.toUpperCase() && /[a-z]/.test(prevOriginal)) {
      score += 5;
    }

    lastMatchIdx = tIdx;
    qIdx++;
  }

  if (qIdx < q.length) return 0;

  score += consecutiveBonus;

  // Prefer compact matches over ones spread across the whole string.
  const spread = lastMatchIdx - firstMatchIdx + 1 - q.length;
  score += Math.max(0, 20 - spread);

  // Keep subsequence matches below substring matches.
  return Math.min(50, score * 0.5);
}

/**
 * Score a workflow against a whitespace-separated query. Every term must match
 * somewhere (name, description, author, tags or folder) or the workflow is
 * excluded (0). Name and tag matches count most.
 */
export function fuzzyScore(workflow: WorkflowMetadata, query: string): number {
  if (!query) return 1;

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let total = 0;

  for (const term of terms) {
    let best = fuzzyMatch(term, workflow.name) * 1.5;
    if (workflow.description) best = Math.max(best, fuzzyMatch(term, workflow.description) * 0.6);
    if (workflow.author) best = Math.max(best, fuzzyMatch(term, workflow.author) * 0.8);
    for (const tag of workflow.tags) best = Math.max(best, fuzzyMatch(term, tag) * 1.2);
    best = Math.max(best, fuzzyMatch(term, workflow.folder_path) * 0.4);

    if (best === 0) return 0;
    total += best;
  }

  return total;
}

/** Filter workflows by a query and order them best match first. */
export function searchWorkflows(workflows: WorkflowMetadata[], query: string): WorkflowMetadata[] {
  if (!query.trim()) return workflows;
  return workflows
    .map((workflow) => ({ workflow, score: fuzzyScore(workflow, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.workflow);
}
