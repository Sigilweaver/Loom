import { useEffect, useRef } from "react";

interface LogViewerProps {
  logs?: string[];
}

const LogViewer = ({ logs = [] }: LogViewerProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-theme-text-secondary text-sm">
        No logs available.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3 bg-theme-surface-elevated rounded">
      <div className="font-mono text-xs leading-relaxed text-theme-text-primary whitespace-pre-wrap break-words">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className={`py-0.5 ${
              idx < logs.length - 1 ? "border-b border-theme-border-secondary" : ""
            }`}
          >
            {log}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LogViewer;
