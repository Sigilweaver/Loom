/**
 * Tab - Individual tab component
 *
 * Displays a single workflow tab with:
 * - Tab name
 * - Dirty indicator (dot)
 * - Close button
 * - Active state styling
 * - Context menu support
 */

import { Tab as TabType } from "@state/tabStore";
import React from "react";

interface TabProps {
  tab: TabType;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export default function Tab({
  tab,
  isActive,
  onSelect,
  onClose,
  onContextMenu,
}: TabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent tab selection when closing
    onClose();
  };

  return (
    <div
      className={`
        group relative flex items-center gap-2 px-4 py-2 min-w-[120px]
        border-r border-theme-border-primary
        cursor-pointer select-none
        transition-colors
        whitespace-nowrap
        ${
          isActive
            ? "bg-theme-surface-page text-theme-text-primary"
            : "bg-theme-surface-elevated text-theme-text-secondary hover:bg-theme-surface-panel"
        }
      `}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      title={tab.filePath || tab.name}
    >
      {/* Dirty indicator */}
      {tab.isDirty && (
        <div
          className="w-2 h-2 rounded-full bg-theme-interactive-accent flex-shrink-0"
          title="Unsaved changes"
        />
      )}

      {/* Tab name */}
      <span className="text-sm font-medium flex-shrink-0 px-0.5">{tab.name}</span>

      {/* Close button */}
      <button
        onClick={handleClose}
        className={`
          flex-shrink-0 w-4 h-4 rounded
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          hover:bg-theme-surface-elevated
          transition-opacity
          ${isActive ? "text-theme-text-secondary" : "text-theme-text-tertiary"}
        `}
        title="Close tab"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M2 2 L10 10 M10 2 L2 10" />
        </svg>
      </button>

      {/* Active indicator (bottom border) */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-interactive-accent" />
      )}
    </div>
  );
}
