/** Helpers for showing the unified diff returned by the Hub. */

export type DiffLineKind = "meta" | "hunk" | "add" | "remove" | "context";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffSummary {
  added: number;
  removed: number;
}

/** Split a unified diff into typed lines. An empty diff (identical versions) gives no lines. */
export function parseUnifiedDiff(diff: string): DiffLine[] {
  if (!diff.trim()) return [];

  return diff
    .replace(/\n$/, "")
    .split("\n")
    .map((text): DiffLine => {
      if (text.startsWith("+++") || text.startsWith("---")) return { kind: "meta", text };
      if (text.startsWith("@@")) return { kind: "hunk", text };
      if (text.startsWith("+")) return { kind: "add", text };
      if (text.startsWith("-")) return { kind: "remove", text };
      return { kind: "context", text };
    });
}

export function summarizeDiff(lines: DiffLine[]): DiffSummary {
  return {
    added: lines.filter((line) => line.kind === "add").length,
    removed: lines.filter((line) => line.kind === "remove").length,
  };
}
