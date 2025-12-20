/**
 * ProfileViewer Component
 * 
 * Displays column profiling data in a columnar layout (left to right).
 * Each data column is shown as a visual column with header, quality bar, and stats.
 * Automatically fetches profile data based on the currently previewed socket.
 */

import { useEffect, useRef } from "react";
import { useUIStore } from "@state/uiStore";
import { useWorkflowStore } from "@state/workflowStore";
import { useSocketProfile } from "@hooks/useSocketProfile";
import type { ColumnProfile, TopValueEntry } from "@api/backend";

// Format numeric values for display (handles Decimal artifacts)
const formatNumericDisplay = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  
  // Handle scientific notation zeros like "0E-10"
  if (/^-?0E[+-]?\d+$/i.test(str)) {
    return '0';
  }
  
  // Handle trailing zeros like "3327.540000000000" or "9.0000000000000"
  // Only if it looks like a decimal number with excessive trailing zeros
  if (/^-?\d+\.\d*0{4,}$/.test(str)) {
    // Parse and format to remove trailing zeros
    const num = parseFloat(str);
    if (!isNaN(num)) {
      return num.toString();
    }
  }
  
  return str;
};

// Minimum percentage threshold for displaying frequent values
const MIN_FREQUENCY_PERCENT = 0.1;

/**
 * Horizontal quality bar showing data quality distribution
 */
function QualityBar({ 
  okPercent, 
  okCount,
  blankPercent,
  blankCount,
  issuePercent,
  issueCount,
  nullPercent, 
  nullCount,
}: { 
  okPercent: number;
  okCount: number;
  blankPercent: number;
  blankCount: number;
  issuePercent: number;
  issueCount: number;
  nullPercent: number;
  nullCount: number;
}) {
  return (
    <div className="flex w-full h-2 overflow-hidden rounded bg-theme-surface-panel">
      {okPercent > 0 && (
        <div 
          className="h-full bg-green-500" 
          style={{ width: `${okPercent}%` }}
          title={`OK: ${okCount.toLocaleString()} (${okPercent.toFixed(1)}%)`}
        />
      )}
      {blankPercent > 0 && (
        <div 
          className="h-full bg-yellow-500" 
          style={{ width: `${blankPercent}%` }}
          title={`Blank: ${blankCount.toLocaleString()} (${blankPercent.toFixed(1)}%)`}
        />
      )}
      {issuePercent > 0 && (
        <div 
          className="h-full bg-red-500" 
          style={{ width: `${issuePercent}%` }}
          title={`Issues: ${issueCount.toLocaleString()} (${issuePercent.toFixed(1)}%)`}
        />
      )}
      {nullPercent > 0 && (
        <div 
          className="h-full bg-gray-400" 
          style={{ width: `${nullPercent}%` }}
          title={`Null: ${nullCount.toLocaleString()} (${nullPercent.toFixed(1)}%)`}
        />
      )}
    </div>
  );
}

/**
 * Compact top values display for a column
 * Returns null if no values meet the minimum frequency threshold
 */
function TopValuesList({ topValues, totalCount }: { topValues: TopValueEntry[]; totalCount: number }) {
  if (!topValues || topValues.length === 0) return null;
  
  // Filter to only values meeting minimum threshold
  const significantValues = topValues.filter(
    (tv) => (tv.count / totalCount) * 100 >= MIN_FREQUENCY_PERCENT
  ).slice(0, 5);
  
  // If no values meet threshold, return null (component won't render)
  if (significantValues.length === 0) return null;
  
  return (
    <div className="space-y-0.5">
      {significantValues.map((tv, idx) => {
        const displayValue = formatNumericDisplay(tv.value);
        return (
          <div key={idx} className="flex items-center justify-between gap-1 text-[10px]">
            <span className="truncate text-theme-text-secondary max-w-[100px]" title={displayValue}>
              {displayValue}
            </span>
            <span className="text-theme-text-tertiary whitespace-nowrap">
              {((tv.count / totalCount) * 100).toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Stat row component for consistent formatting
 */
function StatRow({ label, value, className = "" }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="flex justify-between items-center text-[10px]">
      <span className="text-theme-text-tertiary">{label}</span>
      <span className={`font-mono text-theme-text-primary ${className}`}>{value}</span>
    </div>
  );
}

/**
 * Single column profile - displayed as a vertical strip
 */
function ColumnProfileStrip({ profile }: { profile: ColumnProfile }) {
  const count = profile.count ?? 0;
  const nullCount = profile.null_count ?? 0;
  const nullPercent = profile.null_percent ?? 0;
  
  // Calculate blank count (empty strings) - only for string types
  const emptyCount = profile.empty_count ?? 0;
  const blankPercent = count > 0 ? (emptyCount / count) * 100 : 0;
  
  // Calculate issue count from string quality metrics (whitespace issues)
  const issueCount = (profile.whitespace_leading ?? 0) + 
                     (profile.whitespace_trailing ?? 0);
  const issuePercent = count > 0 ? (issueCount / count) * 100 : 0;
  
  // OK = everything that's not null, blank, or has issues
  const okPercent = Math.max(0, 100 - nullPercent - blankPercent - issuePercent);
  const okCount = Math.max(0, count - nullCount - emptyCount - issueCount);
  
  // Determine column type
  const isNumeric = ['Int', 'UInt', 'Float', 'Decimal'].some(t => profile.dtype.includes(t));
  const isString = profile.dtype.includes('Utf8') || profile.dtype.includes('String');

  return (
    <div className="flex flex-col w-40 min-w-[160px] h-full border rounded bg-theme-surface-elevated border-theme-border-secondary">
      {/* Column header with quality bar - sticky */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-theme-border-secondary bg-theme-surface-panel/50 space-y-1.5">
        <div className="text-sm font-medium truncate text-theme-text-primary" title={profile.column}>
          {profile.column}
        </div>
        <div className="text-[10px] text-theme-text-tertiary">{profile.dtype}</div>
        <QualityBar 
          okPercent={okPercent}
          okCount={okCount}
          blankPercent={blankPercent}
          blankCount={emptyCount}
          issuePercent={issuePercent}
          issueCount={issueCount}
          nullPercent={nullPercent}
          nullCount={nullCount}
        />
      </div>
      
      {/* Stats section - scrollable */}
      <div className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {/* Count stats with quality breakdown */}
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-theme-text-secondary tracking-wide">Count</div>
          <StatRow label="Total" value={count.toLocaleString()} />
          <StatRow label="Unique" value={(profile.unique_count ?? 0).toLocaleString()} />
          <div className="flex items-center gap-1.5 text-[10px]">
            <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-theme-text-tertiary">OK</span>
            <span className="ml-auto font-mono text-theme-text-primary">{okCount.toLocaleString()}</span>
          </div>
          {issueCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-theme-text-tertiary">Issues</span>
              <span className="ml-auto font-mono text-red-400">{issueCount.toLocaleString()}</span>
            </div>
          )}
          {emptyCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="flex-shrink-0 w-2 h-2 bg-yellow-500 rounded-full" />
              <span className="text-theme-text-tertiary">Blank</span>
              <span className="ml-auto font-mono text-yellow-500">{emptyCount.toLocaleString()}</span>
            </div>
          )}
          {nullCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full" />
              <span className="text-theme-text-tertiary">Null</span>
              <span className="ml-auto font-mono text-gray-400">{nullCount.toLocaleString()}</span>
            </div>
          )}
        </div>
        
        {/* Numeric aggregation stats */}
        {isNumeric && (profile.min !== undefined || profile.max !== undefined) && (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-theme-text-secondary tracking-wide">Aggregation</div>
            {profile.min !== undefined && <StatRow label="Min" value={formatNumericDisplay(profile.min)} />}
            {profile.max !== undefined && <StatRow label="Max" value={formatNumericDisplay(profile.max)} />}
            {profile.mean !== undefined && <StatRow label="Mean" value={formatNumericDisplay(profile.mean.toFixed(2))} />}
            {profile.median !== undefined && <StatRow label="Median" value={formatNumericDisplay(profile.median.toFixed(2))} />}
            {profile.std !== undefined && <StatRow label="Std Dev" value={formatNumericDisplay(profile.std.toFixed(2))} />}
          </div>
        )}
        
        {/* Most frequent values - only show if any values meet threshold */}
        {profile.top_values && profile.top_values.length > 0 && 
          profile.top_values.some((tv) => (tv.count / count) * 100 >= MIN_FREQUENCY_PERCENT) && (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-theme-text-secondary tracking-wide">Most Frequent</div>
            <TopValuesList topValues={profile.top_values} totalCount={count} />
          </div>
        )}
        
        {/* Min values for numeric columns */}
        {isNumeric && profile.min_values && profile.min_values.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-theme-text-secondary tracking-wide">Smallest</div>
            <div className="space-y-0.5">
              {profile.min_values.map((val, idx) => {
                const displayValue = formatNumericDisplay(val);
                return (
                  <div key={idx} className="text-[10px] font-mono text-theme-text-primary truncate" title={displayValue}>
                    {displayValue}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Max values for numeric columns */}
        {isNumeric && profile.max_values && profile.max_values.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-theme-text-secondary tracking-wide">Largest</div>
            <div className="space-y-0.5">
              {profile.max_values.map((val, idx) => {
                const displayValue = formatNumericDisplay(val);
                return (
                  <div key={idx} className="text-[10px] font-mono text-theme-text-primary truncate" title={displayValue}>
                    {displayValue}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* String quality issue details */}
        {isString && issueCount > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-red-400 tracking-wide">Issue Details</div>
            {(profile.whitespace_leading ?? 0) > 0 && (
              <StatRow label="Leading WS" value={profile.whitespace_leading ?? 0} className="text-red-400" />
            )}
            {(profile.whitespace_trailing ?? 0) > 0 && (
              <StatRow label="Trailing WS" value={profile.whitespace_trailing ?? 0} className="text-red-400" />
            )}
            {(profile.contains_linebreaks ?? 0) > 0 && (
              <StatRow label="Linebreaks" value={profile.contains_linebreaks ?? 0} className="text-red-400" />
            )}
            {(profile.contains_non_ascii ?? 0) > 0 && (
              <StatRow label="Non-ASCII" value={profile.contains_non_ascii ?? 0} className="text-red-400" />
            )}
          </div>
        )}
        
      </div>
    </div>
  );
}

/**
 * Main ProfileViewer component
 */
const ProfileViewer = () => {
  const profileState = useUIStore((s) => s.profileState);
  const previewState = useUIStore((s) => s.previewState);
  const activeBottomTab = useUIStore((s) => s.activeBottomTab);
  const tools = useWorkflowStore((s) => s.tools);
  const { profileSocket } = useSocketProfile();
  
  // Track which socket we've fetched profile for to avoid re-fetching
  const lastProfiledSocketRef = useRef<string | null>(null);
  
  // Auto-fetch profile when switching to profile tab with a previewed socket
  useEffect(() => {
    // Only act when profile tab is active
    if (activeBottomTab !== "profile") return;
    
    // Need a preview state to know which socket to profile
    if (!previewState?.toolId || !previewState?.socketId || !previewState?.socketDirection) return;
    
    // Validate the tool still exists in the current workflow (prevents stale state issues)
    const toolExists = tools.some((t) => t.id === previewState.toolId);
    if (!toolExists) return;
    
    // Build a key to track what we've already profiled
    const socketKey = `${previewState.toolId}-${previewState.socketId}-${previewState.socketDirection}`;
    
    // Skip if we already have profile data for this exact socket
    if (
      profileState?.toolId === previewState.toolId &&
      profileState?.socketId === previewState.socketId &&
      profileState?.socketDirection === previewState.socketDirection
    ) {
      return;
    }
    
    // Skip if we're currently loading profile for this socket
    if (profileState?.loading && lastProfiledSocketRef.current === socketKey) {
      return;
    }
    
    // Fetch profile data
    lastProfiledSocketRef.current = socketKey;
    profileSocket(previewState.toolId, previewState.socketId, previewState.socketDirection);
  }, [activeBottomTab, previewState?.toolId, previewState?.socketId, previewState?.socketDirection, profileState?.toolId, profileState?.socketId, profileState?.socketDirection, profileState?.loading, profileSocket, tools]);

  if (!profileState) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-theme-text-secondary">
        Select a socket to view column statistics.
      </div>
    );
  }

  if (profileState.loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-theme-text-secondary">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Profiling columns...
        </div>
      </div>
    );
  }

  if (profileState.error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-theme-notification-error-text">
        Error: {profileState.error}
      </div>
    );
  }

  const { profile } = profileState;

  if (!profile || Object.keys(profile.columns).length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-theme-text-secondary">
        No columns to profile in this data.
      </div>
    );
  }

  const columnProfiles = Object.values(profile.columns);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 p-2 mb-2 border rounded bg-theme-surface-elevated border-theme-border-primary">
        <div className="flex items-center gap-3 text-xs text-theme-text-secondary">
          <span>
            <strong>{profile.row_count.toLocaleString()}</strong> rows
          </span>
          <span>
            <strong>{profile.column_count}</strong> columns
          </span>
        </div>
        {/* Quality legend */}
        <div className="flex items-center gap-3 text-xs text-theme-text-tertiary">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-green-500" />
            <span>OK</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-yellow-500" />
            <span>Blank</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-red-400" />
            <span>Issues</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-gray-400" />
            <span>Null</span>
          </div>
        </div>
      </div>

      {/* Columnar profile display - horizontal scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-2 p-1">
          {columnProfiles.map((col) => (
            <ColumnProfileStrip
              key={col.column}
              profile={col}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileViewer;
