/**
 * RuntimeLogViewer - Displays application-wide network/runtime logs
 *
 * Shows all API requests, responses, cache hits/misses with filtering
 * and real-time updates.
 */

import { useRuntimeLogStore, type RuntimeLogType } from "@state/runtimeLogStore";
import { useState } from "react";

/**
 * Color classes for each log type
 */
const typeColors: Record<RuntimeLogType, string> = {
  request: "text-theme-log-request",
  response: "text-theme-log-response",
  error: "text-theme-log-error",
  "cache-hit": "text-theme-log-cache-hit",
  "cache-miss": "text-theme-log-cache-miss",
};

/**
 * Type labels for display
 */
const typeLabels: Record<RuntimeLogType, string> = {
  request: "REQ",
  response: "RES",
  error: "ERR",
  "cache-hit": "HIT",
  "cache-miss": "MISS",
};

/**
 * Filter options
 */
const filterOptions: { value: RuntimeLogType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "request", label: "Requests" },
  { value: "response", label: "Responses" },
  { value: "error", label: "Errors" },
  { value: "cache-hit", label: "Cache Hits" },
  { value: "cache-miss", label: "Cache Misses" },
];

const RuntimeLogViewer = () => {
  const logs = useRuntimeLogStore((s) => s.logs);
  const clearLogs = useRuntimeLogStore((s) => s.clearLogs);
  const [filter, setFilter] = useState<RuntimeLogType | "all">("all");

  // Filter logs
  const filteredLogs = filter === "all" 
    ? logs 
    : logs.filter((log) => log.type === filter);

  // Count by type for badges
  const counts = {
    all: logs.length,
    request: logs.filter((l) => l.type === "request").length,
    response: logs.filter((l) => l.type === "response").length,
    error: logs.filter((l) => l.type === "error").length,
    "cache-hit": logs.filter((l) => l.type === "cache-hit").length,
    "cache-miss": logs.filter((l) => l.type === "cache-miss").length,
  };

  // Format timestamp for display
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-theme-border-secondary">
        {/* Filter buttons */}
        <div className="flex gap-1">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filter === option.value
                  ? "bg-theme-surface-panel text-theme-text-primary border border-theme-border-primary"
                  : "bg-transparent text-theme-text-secondary border border-transparent hover:bg-theme-surface-panel/50"
              }`}
            >
              {option.label}
              {counts[option.value] > 0 && (
                <span className="ml-1 text-theme-text-muted">
                  ({counts[option.value]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear button */}
        <button
          onClick={clearLogs}
          disabled={logs.length === 0}
          className="px-2 py-1 text-xs transition-colors rounded text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-panel disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-theme-text-muted">
            {logs.length === 0
              ? "No network activity yet"
              : "No logs match the current filter"}
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Show newest first */}
            {[...filteredLogs].reverse().map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-theme-surface-panel/50"
              >
                {/* Timestamp */}
                <span className="text-theme-text-muted w-18 shrink-0">
                  {formatTime(log.timestamp)}
                </span>

                {/* Type badge */}
                <span
                  className={`w-10 shrink-0 font-semibold ${typeColors[log.type]}`}
                >
                  {typeLabels[log.type]}
                </span>

                {/* Duration (if available) */}
                <span className="w-14 shrink-0 text-theme-text-muted text-right">
                  {log.duration !== undefined ? `${log.duration}ms` : "-"}
                </span>

                {/* Status (if available) */}
                <span
                  className={`w-10 shrink-0 ${
                    log.status && log.status >= 400
                      ? "text-theme-log-error"
                      : "text-theme-text-muted"
                  }`}
                >
                  {log.status ?? "-"}
                </span>

                {/* Message */}
                <span className="flex-1 truncate text-theme-text-primary">
                  {log.message}
                </span>

                {/* Tool ID (if available) */}
                {log.toolId && (
                  <span className="text-theme-text-muted shrink-0">
                    [{log.toolId.slice(0, 8)}]
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="pt-2 mt-2 text-xs border-t border-theme-border-secondary text-theme-text-muted">
        {logs.length} log entries
        {filteredLogs.length !== logs.length &&
          ` (${filteredLogs.length} shown)`}
      </div>
    </div>
  );
};

export default RuntimeLogViewer;
