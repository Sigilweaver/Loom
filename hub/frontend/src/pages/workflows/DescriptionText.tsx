import type { ReactNode } from "react";

/** Inline formatting: **bold** and `code`. Everything else is plain text (never HTML). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*.+?\*\*|`.+?`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={index} className="rounded bg-surface-hover px-1 py-0.5 font-mono text-sm">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Renders a workflow description written in a small subset of Markdown:
 * headings (#, ##, ###), bullet and numbered lists, **bold** and `code`.
 */
export function DescriptionText({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div className="space-y-2 text-sm text-ink-muted">
      {text.split(/\n\n+/).map((block, index) => {
        if (block.startsWith("### ")) {
          return (
            <h4 key={index} className="pt-1 text-sm font-semibold text-ink">
              {inline(block.slice(4))}
            </h4>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h3 key={index} className="pt-1 text-base font-semibold text-ink">
              {inline(block.slice(3))}
            </h3>
          );
        }
        if (block.startsWith("# ")) {
          return (
            <h3 key={index} className="pt-1 text-lg font-bold text-ink">
              {inline(block.slice(2))}
            </h3>
          );
        }
        if (/^[-*] /m.test(block)) {
          return (
            <ul key={index} className="list-inside list-disc space-y-1">
              {block
                .split("\n")
                .filter(Boolean)
                .map((item, i) => (
                  <li key={i}>{inline(item.replace(/^[-*] /, ""))}</li>
                ))}
            </ul>
          );
        }
        if (/^\d+\. /m.test(block)) {
          return (
            <ol key={index} className="list-inside list-decimal space-y-1">
              {block
                .split("\n")
                .filter(Boolean)
                .map((item, i) => (
                  <li key={i}>{inline(item.replace(/^\d+\. /, ""))}</li>
                ))}
            </ol>
          );
        }
        return <p key={index}>{inline(block)}</p>;
      })}
    </div>
  );
}
