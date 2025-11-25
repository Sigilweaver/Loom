/**
 * TabBar - Horizontal tab bar for managing workflow tabs
 *
 * Features:
 * - Display all open tabs
 * - Switch between tabs
 * - Close tabs (with confirmation for dirty tabs)
 * - New tab button
 * - Tab context menu (right-click)
 * - Keyboard navigation
 */

import { useTabStore } from "@state/tabStore";
import { useWorkflowStore } from "@state/workflowStore";
import React, { useState } from "react";
import Tab from "./Tab";

interface TabContextMenuProps {
  x: number;
  y: number;
  tabId: string;
  onClose: () => void;
}

function TabContextMenu({ x, y, tabId, onClose }: TabContextMenuProps) {
  const closeTab = useTabStore((s) => s.closeTab);
  const closeOtherTabs = useTabStore((s) => s.closeOtherTabs);
  const tabs = useTabStore((s) => s.tabs);

  const handleClose = () => {
    closeTab(tabId);
    onClose();
  };

  const handleCloseOthers = () => {
    closeOtherTabs(tabId);
    onClose();
  };

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 bg-theme-surface-panel border border-theme-border-primary rounded shadow-lg py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleClose}
        className="w-full px-4 py-2 text-left text-sm text-theme-text-primary hover:bg-theme-surface-elevated transition-colors"
      >
        Close
      </button>
      <button
        onClick={handleCloseOthers}
        className="w-full px-4 py-2 text-left text-sm text-theme-text-primary hover:bg-theme-surface-elevated transition-colors"
        disabled={tabs.length <= 1}
      >
        Close Others
      </button>
    </div>
  );
}

export default function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const createTab = useTabStore((s) => s.createTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const switchTab = useTabStore((s) => s.switchTab);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const handleNewTab = () => {
    createTab();
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Get display name for a tab - use workflow metadata for active tab
  const getTabDisplayName = (tab: typeof tabs[0]) => {
    if (tab.id === activeTabId) {
      return workflowMeta.name;
    }
    return tab.name;
  };

  return (
    <div className="flex items-center bg-theme-surface-elevated border-b border-theme-border-primary">
      {/* Scrollable tab list - hide scrollbar but keep scroll functionality */}
      <div className="flex overflow-x-auto overflow-y-hidden scrollbar-hide">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={{ ...tab, name: getTabDisplayName(tab) }}
            isActive={tab.id === activeTabId}
            onSelect={() => switchTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
          />
        ))}
      </div>
        
      {/* New tab button - always visible, never scrolls */}
      <button
        onClick={handleNewTab}
        className="flex-shrink-0 px-3 py-2 text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-panel transition-colors border-l border-theme-border-primary"
        title="New tab (Ctrl+T)"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M8 3 L8 13 M3 8 L13 8" />
        </svg>
      </button>

      {/* Context menu */}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabId={contextMenu.tabId}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
