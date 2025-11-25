/**
 * tabStore - Multi-tab workflow management
 *
 * Manages multiple workflow tabs with isolated state for each tab.
 * Orchestrates workflow and history state synchronization when switching tabs.
 *
 * Architecture:
 * - Single tab store manages all tabs
 * - Each tab has isolated workflow and history snapshots
 * - workflowStore and historyStore represent the ACTIVE tab
 * - Tab switching saves current state and loads new tab state
 *
 * Key Features:
 * - Create/close/switch tabs
 * - Track dirty state (unsaved changes)
 * - File path association
 * - Confirmation dialogs for unsaved changes
 */

import {
  Tool,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createLogger } from "@utils/logger";
import { useWorkflowStore } from "./workflowStore";
import { useHistoryStore, type WorkflowSnapshot as HistoryWorkflowSnapshot } from "./historyStore";
import { v4 as uuidv4 } from "uuid";

/**
 * Tab metadata
 */
export interface Tab {
  id: string;
  name: string;
  filePath?: string; // Path to saved .swwf file
  isDirty: boolean; // Has unsaved changes
  createdAt: string;
  lastModified: string;
}

/**
 * Workflow snapshot for a tab
 */
export interface WorkflowSnapshot {
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

/**
 * History snapshot for a tab
 */
export interface HistorySnapshot {
  past: HistoryWorkflowSnapshot[];
  future: HistoryWorkflowSnapshot[];
}

/**
 * Complete tab data (workflow + history)
 */
export interface TabData {
  workflow: WorkflowSnapshot;
  history: HistorySnapshot;
}

/**
 * Tab store state
 */
interface TabState {
  // Tab list and active tab
  tabs: Tab[];
  activeTabId: string | null;

  // Tab data storage (workflow + history per tab)
  tabData: Record<string, TabData>;

  // Tab lifecycle
  createTab: (name?: string, workflow?: WorkflowSnapshot) => string;
  closeTab: (tabId: string) => boolean;
  switchTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;

  // Tab metadata operations
  renameTab: (tabId: string, name: string) => void;
  setTabFilePath: (tabId: string, path: string) => void;
  markTabDirty: (tabId: string) => void;
  markTabClean: (tabId: string) => void;

  // State synchronization
  saveCurrentTab: () => void;
  loadTab: (tabId: string) => void;

  // Queries
  getTabById: (tabId: string) => Tab | undefined;
  hasUnsavedChanges: (tabId: string) => boolean;
  getTabName: (tabId: string) => string;
}

/**
 * Create default workflow metadata
 */
const createDefaultMeta = (name: string): WorkflowMeta => ({
  name,
  description: "A new workflow",
  author: "SigilWeaver",
  workflowId: uuidv4(),
  created: new Date().toISOString(),
});

/**
 * Create default workflow snapshot
 */
const createDefaultWorkflow = (name: string): WorkflowSnapshot => ({
  tools: [],
  wires: [],
  workflowMeta: createDefaultMeta(name),
});

/**
 * Create default history snapshot
 */
const createDefaultHistory = (): HistorySnapshot => ({
  past: [],
  future: [],
});

/**
 * Deep clone using JSON serialization
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const logger = createLogger('TabStore');

/**
 * Tab store - manages multiple workflow tabs
 *
 * @example
 * // Create a new tab
 * const createTab = useTabStore(s => s.createTab);
 * const tabId = createTab("My Workflow");
 *
 * // Switch to a tab
 * const switchTab = useTabStore(s => s.switchTab);
 * switchTab(tabId);
 *
 * // Close a tab (shows confirmation if dirty)
 * const closeTab = useTabStore(s => s.closeTab);
 * const closed = closeTab(tabId); // Returns false if user cancels
 */
export const useTabStore = create<TabState>()(
  devtools(
    (set, get) => ({
      // Initial state
      tabs: [],
      activeTabId: null,
      tabData: {},

      /**
       * Create a new tab
       *
       * @param name - Tab name (defaults to workflow meta name or "Untitled Workflow")
       * @param workflow - Optional workflow to initialize with
       * @returns New tab ID
       */
      createTab: (name?: string, workflow?: WorkflowSnapshot) => {
        const now = new Date().toISOString();
        const tabId = uuidv4();
        
        // Use workflow meta name if provided, otherwise use passed name or default
        const tabName = workflow?.workflowMeta.name || name || "Untitled Workflow";

        logger.info("Creating new tab:", tabName);

        // Save current tab state before creating new one
        const currentTabId = get().activeTabId;
        if (currentTabId) {
          get().saveCurrentTab();
        }

        // Create new tab
        const newTab: Tab = {
          id: tabId,
          name: tabName,
          isDirty: false,
          createdAt: now,
          lastModified: now,
        };

        // Initialize tab data
        const tabData: TabData = {
          workflow: workflow || createDefaultWorkflow(tabName),
          history: createDefaultHistory(),
        };

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: tabId,
          tabData: { ...state.tabData, [tabId]: tabData },
        }));

        // Load the new tab into workflow/history stores
        get().loadTab(tabId);

        return tabId;
      },

      /**
       * Close a tab
       *
       * Shows confirmation dialog if tab has unsaved changes.
       * If closing the last tab, creates a new empty tab first.
       *
       * @param tabId - ID of tab to close
       * @returns true if closed, false if cancelled
       */
      closeTab: (tabId: string) => {
        const { tabs, activeTabId } = get();
        const tab = get().getTabById(tabId);

        if (!tab) {
          logger.warn("Attempted to close non-existent tab:", tabId);
          return false;
        }

        logger.info("Closing tab:", tab.name);

        // Check for unsaved changes
        if (tab.isDirty) {
          const confirmed = window.confirm(
            `"${tab.name}" has unsaved changes.\n\nClose without saving?`
          );
          if (!confirmed) {
            return false;
          }
        }

        // If this is the last tab, create a new one first
        if (tabs.length <= 1) {
          get().createTab("Untitled Workflow");
          // The new tab is now active, proceed to close the old one
        }

        // If closing active tab (and not the only tab), switch to another tab first
        if (tabId === activeTabId && tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === tabId);
          const nextIndex =
            currentIndex > 0 ? currentIndex - 1 : currentIndex + 1;
          const nextTab = tabs[nextIndex];

          if (nextTab) {
            get().switchTab(nextTab.id);
          }
        }

        // Remove tab and its data
        set((state) => {
          const newTabData = { ...state.tabData };
          delete newTabData[tabId];

          return {
            tabs: state.tabs.filter((t) => t.id !== tabId),
            tabData: newTabData,
          };
        });

        return true;
      },

      /**
       * Switch to a different tab
       *
       * Saves current tab state and loads new tab state.
       *
       * @param tabId - ID of tab to switch to
       */
      switchTab: (tabId: string) => {
        const { activeTabId, tabs } = get();

        // Check if tab exists
        const targetTab = tabs.find((t) => t.id === tabId);
        if (!targetTab) {
          logger.warn("Tab not found:", tabId);
          return;
        }

        logger.info("Switching to tab:", targetTab.name);

        // No-op if already active
        if (tabId === activeTabId) {
          return;
        }

        // Save current tab state
        if (activeTabId) {
          get().saveCurrentTab();
        }

        // Update active tab
        set({ activeTabId: tabId });

        // Load new tab state
        get().loadTab(tabId);
      },

      /**
       * Close all tabs (with confirmation if any have unsaved changes)
       */
      closeAllTabs: () => {
        const { tabs } = get();
        const dirtyTabs = tabs.filter((t) => t.isDirty);

        if (dirtyTabs.length > 0) {
          const confirmed = window.confirm(
            `${dirtyTabs.length} tab(s) have unsaved changes. Close all anyway?`
          );
          if (!confirmed) {
            return;
          }
        }

        // Create one new clean tab
        const newTabId = uuidv4();
        const now = new Date().toISOString();

        set({
          tabs: [
            {
              id: newTabId,
              name: "Untitled Workflow",
              isDirty: false,
              createdAt: now,
              lastModified: now,
            },
          ],
          activeTabId: newTabId,
          tabData: {
            [newTabId]: {
              workflow: createDefaultWorkflow("Untitled Workflow"),
              history: createDefaultHistory(),
            },
          },
        });

        get().loadTab(newTabId);
      },

      /**
       * Close all tabs except the specified one
       *
       * @param tabId - ID of tab to keep open
       */
      closeOtherTabs: (tabId: string) => {
        const { tabs } = get();
        const otherTabs = tabs.filter((t) => t.id !== tabId);
        const dirtyTabs = otherTabs.filter((t) => t.isDirty);

        if (dirtyTabs.length > 0) {
          const confirmed = window.confirm(
            `${dirtyTabs.length} tab(s) have unsaved changes. Close anyway?`
          );
          if (!confirmed) {
            return;
          }
        }

        // Save target tab data before filtering
        const targetTabData = get().tabData[tabId];
        if (!targetTabData) {
          return;
        }

        set({
          tabs: tabs.filter((t) => t.id === tabId),
          activeTabId: tabId,
          tabData: { [tabId]: targetTabData },
        });

        get().loadTab(tabId);
      },

      /**
       * Rename a tab
       * 
       * Note: This updates the workflow metadata, which is the source of truth.
       * The workflow metadata update will then sync the tab name back.
       *
       * @param tabId - ID of tab to rename
       * @param name - New name
       */
      renameTab: (tabId, name) => {
        // For the active tab, update the workflow metadata (source of truth)
        if (get().activeTabId === tabId) {
          const workflowStore = useWorkflowStore.getState();
          // Only update if the workflow meta name is different
          if (workflowStore.workflowMeta.name !== name) {
            workflowStore.updateWorkflowMeta({ name });
          }
        } else {
          // For inactive tabs, update the tab name directly
          // (they don't have active workflow state)
          const currentTab = get().tabs.find((t) => t.id === tabId);
          if (currentTab?.name !== name) {
            set((state) => ({
              tabs: state.tabs.map((t) =>
                t.id === tabId
                  ? { ...t, name, lastModified: new Date().toISOString() }
                  : t
              ),
            }));
            
            // Also update the stored workflow metadata for this tab
            const tabData = get().tabData[tabId];
            if (tabData) {
              tabData.workflow.workflowMeta.name = name;
            }
          }
        }
      },

      /**
       * Set the file path for a tab (after save/open)
       *
       * @param tabId - ID of tab
       * @param path - File system path
       */
      setTabFilePath: (tabId, path) => {
        // Extract filename from path for tab name
        const fileName = path.split("/").pop()?.replace(".swwf", "") || path;

        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  filePath: path,
                  name: fileName,
                  lastModified: new Date().toISOString(),
                }
              : t
          ),
        }));
      },

      /**
       * Mark tab as dirty (has unsaved changes)
       *
       * @param tabId - ID of tab
       */
      markTabDirty: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId
              ? { ...t, isDirty: true, lastModified: new Date().toISOString() }
              : t
          ),
        }));
      },

      /**
       * Mark tab as clean (no unsaved changes)
       *
       * @param tabId - ID of tab
       */
      markTabClean: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, isDirty: false } : t
          ),
        }));
      },

      /**
       * Save current active tab's state to tabData
       *
       * Reads from workflowStore and historyStore and saves to tabData.
       * Call this before switching tabs or closing the app.
       */
      saveCurrentTab: () => {
        const { activeTabId, tabData } = get();
        if (!activeTabId) {
          return;
        }

        const workflowStore = useWorkflowStore.getState();
        const historyStore = useHistoryStore.getState();

        const snapshot: TabData = {
          workflow: {
            tools: deepClone(workflowStore.tools),
            wires: deepClone(workflowStore.wires),
            workflowMeta: deepClone(workflowStore.workflowMeta),
          },
          history: {
            past: deepClone(historyStore.past),
            future: deepClone(historyStore.future),
          },
        };

        set({
          tabData: { ...tabData, [activeTabId]: snapshot },
        });
      },

      /**
       * Load a tab's state into workflowStore and historyStore
       *
       * @param tabId - ID of tab to load
       */
      loadTab: (tabId: string) => {
        const { tabData } = get();
        const data = tabData[tabId];

        if (!data) {
          console.warn(`No data found for tab ${tabId}`);
          return;
        }

        // Load into workflow store
        const workflowStore = useWorkflowStore.getState();
        workflowStore.loadWorkflow(
          data.workflow.tools,
          data.workflow.wires,
          data.workflow.workflowMeta
        );

        // Load into history store - use Zustand's setState
        useHistoryStore.setState({
          past: deepClone(data.history.past),
          future: deepClone(data.history.future),
        });

        // Sync tab name with workflow meta name
        const workflowName = data.workflow.workflowMeta.name;
        const currentTab = get().getTabById(tabId);
        if (currentTab && currentTab.name !== workflowName) {
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.id === tabId ? { ...t, name: workflowName } : t
            ),
          }));
        }
      },

      /**
       * Get tab by ID
       *
       * @param tabId - Tab ID
       * @returns Tab or undefined
       */
      getTabById: (tabId) => {
        return get().tabs.find((t) => t.id === tabId);
      },

      /**
       * Check if tab has unsaved changes
       *
       * @param tabId - Tab ID
       * @returns true if dirty
       */
      hasUnsavedChanges: (tabId) => {
        const tab = get().getTabById(tabId);
        return tab?.isDirty ?? false;
      },

      /**
       * Get tab name
       *
       * @param tabId - Tab ID
       * @returns Tab name
       */
      getTabName: (tabId) => {
        const tab = get().getTabById(tabId);
        return tab?.name ?? "Unknown";
      },
    }),
    { name: "TabStore" }
  )
);

// Selector hooks for optimized subscriptions
export const useTabs = () => useTabStore((state) => state.tabs);
export const useActiveTabId = () => useTabStore((state) => state.activeTabId);
export const useActiveTab = () => {
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  return tabs.find((t) => t.id === activeTabId);
};
