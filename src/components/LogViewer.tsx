import { useEffect, useRef } from "react";
import { useExecutionStore } from "@state/executionStore";

const LogViewer = () => {
  const logs = useExecutionStore((s) => s.logs);
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
        No logs available. Execute a workflow to see logs here.
      </div>
    );
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      case "success":
        return "text-green-400";
      default:
        return "text-theme-text-primary";
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <div className="h-full overflow-auto p-3 bg-theme-surface-elevated rounded">
      <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className={`py-1 flex gap-2 ${
              idx < logs.length - 1 ? "border-b border-theme-border-secondary" : ""
            }`}
          >
            <span className="text-theme-text-secondary shrink-0">
              {formatTimestamp(log.timestamp)}
            </span>
            <span className={`font-medium shrink-0 ${getLevelColor(log.level)}`}>
              [{log.level.toUpperCase()}]
            </span>
            {log.toolId && (
              <span className="text-theme-text-secondary shrink-0">
                [{log.toolId}]
              </span>
            )}
            <span className="text-theme-text-primary">
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LogViewer;
