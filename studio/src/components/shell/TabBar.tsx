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
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@components/ui/ContextMenu";

export default function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const createTab = useTabStore((s) => s.createTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const switchTab = useTabStore((s) => s.switchTab);
  const reorderTab = useTabStore((s) => s.reorderTab);
  const closeOtherTabs = useTabStore((s) => s.closeOtherTabs);
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleNewTab = () => {
    createTab();
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    if (draggedIndex !== null && index !== draggedIndex) {
      // Determine if we should show indicator before or after this tab
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX;
      const tabMiddle = rect.left + rect.width / 2;
      
      // If dragging to the right half of the last tab, show indicator after it
      if (index === tabs.length - 1 && mouseX > tabMiddle) {
        setDropTargetIndex(index + 1);
      } else if (mouseX < tabMiddle) {
        setDropTargetIndex(index);
      } else {
        setDropTargetIndex(index + 1);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null) {
      // Use dropTargetIndex if available, otherwise use toIndex
      const finalIndex = dropTargetIndex !== null ? dropTargetIndex : toIndex;
      
      if (draggedIndex !== finalIndex) {
        // Adjust target index if dragging from before to after
        const adjustedIndex = draggedIndex < finalIndex ? finalIndex - 1 : finalIndex;
        reorderTab(draggedIndex, adjustedIndex);
      }
    }
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
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
      <div className="flex overflow-x-auto overflow-y-hidden scrollbar-hide relative">
        {tabs.map((tab, index) => (
          <ContextMenu key={tab.id}>
            <div className="relative">
              {/* Drop indicator line - show before this tab if it's the drop target */}
              {dropTargetIndex === index && draggedIndex !== null && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-theme-interactive-accent z-10" />
              )}
              <ContextMenuTrigger asChild>
                <div>
                  <Tab
                    tab={{ ...tab, name: getTabDisplayName(tab) }}
                    isActive={tab.id === activeTabId}
                    onSelect={() => switchTab(tab.id)}
                    onClose={() => closeTab(tab.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  />
                </div>
              </ContextMenuTrigger>
              {/* Drop indicator line - show after last tab if dropping at the end */}
              {dropTargetIndex === index + 1 && index === tabs.length - 1 && draggedIndex !== null && (
                <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-theme-interactive-accent z-10" />
              )}
            </div>
            <ContextMenuContent className="min-w-[160px]">
              <ContextMenuItem onSelect={() => closeTab(tab.id)}>
                Close
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => closeOtherTabs(tab.id)}
                disabled={tabs.length <= 1}
              >
                Close Others
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
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
    </div>
  );
}
