import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTabStore } from "../tabStore";
import { useWorkflowStore } from "../workflowStore";
import { useHistoryStore } from "../historyStore";
import { useUIStore, PreviewState } from "../uiStore";
import { Tool, WorkflowMeta } from "../../domain/workflow/entities/workflow";

// Mock uuid for predictable IDs
vi.mock("uuid", () => ({
  v4: vi.fn(() => `tab-${Math.random().toString(36).substring(7)}`),
}));

// Mock window.confirm for dirty tab confirmation
const mockConfirm = vi.spyOn(window, "confirm");

// Mock the cache clearing
vi.mock("../../api/cache", () => ({
  clearWorkflowCache: vi.fn(),
}));

// Helper to create test tools
const createTestTool = (id: string, type = "Input"): Tool => ({
  id,
  type,
  x: 100,
  y: 100,
  config: {},
  sockets: [{ id: "output", direction: "output", multiple: false }],
});

// Helper to create test workflow meta
const createTestMeta = (name: string): WorkflowMeta => ({
  name,
  description: "Test workflow",
  author: "Test User",
  workflowId: `wf-${name}`,
  created: new Date().toISOString(),
});

// Helper to create a mock preview state
const createMockPreviewState = (): PreviewState => ({
  toolId: "tool1",
  socketId: "output",
  socketDirection: "output",
  data: [],
  schema: [],
  loading: false,
  error: null,
});

describe("TabStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true); // Default to confirming

    // Reset all stores
    useTabStore.setState({
      tabs: [],
      activeTabId: null,
      tabData: {},
    });

    useWorkflowStore.setState({
      tools: [],
      wires: [],
      edges: [],
      workflowMeta: {
        name: "New Workflow",
        description: "",
        author: "User",
        workflowId: "default",
        created: new Date().toISOString(),
      },
      selectedTool: null,
    });

    useHistoryStore.setState({
      past: [],
      future: [],
    });

    useUIStore.setState({
      previewState: null,
    });
  });

  describe("Initial State", () => {
    it("has empty tabs array initially", () => {
      const state = useTabStore.getState();
      expect(state.tabs).toEqual([]);
      expect(state.activeTabId).toBeNull();
      expect(state.tabData).toEqual({});
    });
  });

  describe("createTab", () => {
    it("creates a new tab with default name", () => {
      const tabId = useTabStore.getState().createTab();

      const state = useTabStore.getState();
      expect(state.tabs.length).toBe(1);
      expect(state.activeTabId).toBe(tabId);
      
      const tab = state.tabs[0];
      expect(tab).toBeDefined();
      expect(tab?.name).toBe("Untitled Workflow");
      expect(tab?.isDirty).toBe(false);
    });

    it("creates a tab with custom name", () => {
      const tabId = useTabStore.getState().createTab("My Workflow");

      const tab = useTabStore.getState().getTabById(tabId);
      expect(tab?.name).toBe("My Workflow");
    });

    it("creates a tab with initial workflow", () => {
      const workflow = {
        tools: [createTestTool("tool1")],
        wires: [],
        workflowMeta: createTestMeta("Test Workflow"),
      };

      const tabId = useTabStore.getState().createTab(undefined, workflow);

      const state = useTabStore.getState();
      const tab = state.getTabById(tabId);
      expect(tab?.name).toBe("Test Workflow"); // Should use workflow meta name

      const tabData = state.tabData[tabId];
      expect(tabData?.workflow.tools.length).toBe(1);
    });

    it("switches to newly created tab", () => {
      useTabStore.getState().createTab("Tab 1");
      const tab2Id = useTabStore.getState().createTab("Tab 2");

      expect(useTabStore.getState().activeTabId).toBe(tab2Id);
    });

    it("saves current tab before creating new one", () => {
      // Create first tab and add content
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      
      // Modify workflow store (simulating user work)
      useWorkflowStore.getState().addTool(createTestTool("new-tool"));

      // Create second tab
      useTabStore.getState().createTab("Tab 2");

      // Check that first tab's data was saved
      const tab1Data = useTabStore.getState().tabData[tab1Id];
      expect(tab1Data?.workflow.tools.length).toBe(1);
    });

    it("initializes tab with empty history", () => {
      const tabId = useTabStore.getState().createTab();

      const tabData = useTabStore.getState().tabData[tabId];
      expect(tabData?.history.past).toEqual([]);
      expect(tabData?.history.future).toEqual([]);
    });

    it("sets createdAt and lastModified timestamps", () => {
      const beforeTime = new Date().toISOString();
      const tabId = useTabStore.getState().createTab();
      const afterTime = new Date().toISOString();

      const tab = useTabStore.getState().getTabById(tabId);
      expect(tab).toBeDefined();
      if (tab) {
        expect(tab.createdAt >= beforeTime).toBe(true);
        expect(tab.createdAt <= afterTime).toBe(true);
        expect(tab.lastModified).toBe(tab.createdAt);
      }
    });
  });

  describe("closeTab", () => {
    it("closes a tab and removes its data", () => {
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useTabStore.getState().createTab("Tab 2");

      const closed = useTabStore.getState().closeTab(tab1Id);

      expect(closed).toBe(true);
      expect(useTabStore.getState().tabs.length).toBe(1);
      expect(useTabStore.getState().tabData[tab1Id]).toBeUndefined();
    });

    it("creates new tab when closing the last tab", () => {
      const tabId = useTabStore.getState().createTab("Only Tab");
      
      useTabStore.getState().closeTab(tabId);

      const state = useTabStore.getState();
      expect(state.tabs.length).toBe(1);
      expect(state.tabs[0]?.name).toBe("Untitled Workflow");
    });

    it("switches to adjacent tab when closing active tab", () => {
      useTabStore.getState().createTab("Tab 1");
      const tab2Id = useTabStore.getState().createTab("Tab 2");
      const tab3Id = useTabStore.getState().createTab("Tab 3");

      // tab3 is active, close it
      useTabStore.getState().closeTab(tab3Id);

      // Should switch to tab2
      expect(useTabStore.getState().activeTabId).toBe(tab2Id);
    });

    it("shows confirmation for dirty tab", () => {
      const tabId = useTabStore.getState().createTab("Dirty Tab");
      useTabStore.getState().markTabDirty(tabId);

      mockConfirm.mockReturnValue(true);
      useTabStore.getState().closeTab(tabId);

      expect(mockConfirm).toHaveBeenCalled();
    });

    it("cancels close when user declines confirmation", () => {
      const tabId = useTabStore.getState().createTab("Dirty Tab");
      useTabStore.getState().markTabDirty(tabId);

      mockConfirm.mockReturnValue(false);
      const closed = useTabStore.getState().closeTab(tabId);

      expect(closed).toBe(false);
      expect(useTabStore.getState().tabs.length).toBe(1);
    });

    it("returns false for non-existent tab", () => {
      const closed = useTabStore.getState().closeTab("non-existent");
      expect(closed).toBe(false);
    });
  });

  describe("switchTab", () => {
    it("switches to specified tab", () => {
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useTabStore.getState().createTab("Tab 2");

      useTabStore.getState().switchTab(tab1Id);

      expect(useTabStore.getState().activeTabId).toBe(tab1Id);
    });

    it("saves current tab state before switching", () => {
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      
      // Add tool to tab1
      useWorkflowStore.getState().addTool(createTestTool("tool1"));

      useTabStore.getState().createTab("Tab 2");
      
      // Switch back to tab1
      useTabStore.getState().switchTab(tab1Id);

      // Check tab1's data was preserved
      const tab1Data = useTabStore.getState().tabData[tab1Id];
      expect(tab1Data?.workflow.tools.length).toBe(1);
    });

    it("loads target tab state into stores", () => {
      // Create tab1 with a tool
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useWorkflowStore.getState().addTool(createTestTool("tool1"));

      // Create tab2 (empty)
      useTabStore.getState().createTab("Tab 2");

      // Verify tab2 is empty
      expect(useWorkflowStore.getState().tools.length).toBe(0);

      // Switch back to tab1
      useTabStore.getState().switchTab(tab1Id);

      // Tab1's tool should be loaded
      expect(useWorkflowStore.getState().tools.length).toBe(1);
    });

    it("no-ops when switching to already active tab", () => {
      const tabId = useTabStore.getState().createTab("Tab 1");
      
      const saveSpy = vi.spyOn(useTabStore.getState(), "saveCurrentTab");
      
      useTabStore.getState().switchTab(tabId);

      // Should not call save since we're already on this tab
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("ignores switch to non-existent tab", () => {
      const tabId = useTabStore.getState().createTab("Tab 1");

      useTabStore.getState().switchTab("non-existent");

      expect(useTabStore.getState().activeTabId).toBe(tabId);
    });

    it("clears preview state when switching tabs", () => {
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useTabStore.getState().createTab("Tab 2");

      // Set some preview state using proper type
      useUIStore.setState({ previewState: createMockPreviewState() });

      useTabStore.getState().switchTab(tab1Id);

      expect(useUIStore.getState().previewState).toBeNull();
    });
  });

  describe("closeAllTabs", () => {
    it("closes all tabs and creates a new empty one", () => {
      useTabStore.getState().createTab("Tab 1");
      useTabStore.getState().createTab("Tab 2");
      useTabStore.getState().createTab("Tab 3");

      useTabStore.getState().closeAllTabs();

      const state = useTabStore.getState();
      expect(state.tabs.length).toBe(1);
      expect(state.tabs[0]?.name).toBe("Untitled Workflow");
    });

    it("shows confirmation when dirty tabs exist", () => {
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useTabStore.getState().markTabDirty(tab1Id);
      useTabStore.getState().createTab("Tab 2");

      mockConfirm.mockReturnValue(true);
      useTabStore.getState().closeAllTabs();

      expect(mockConfirm).toHaveBeenCalled();
    });

    it("cancels when user declines confirmation", () => {
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useTabStore.getState().markTabDirty(tab1Id);

      mockConfirm.mockReturnValue(false);
      useTabStore.getState().closeAllTabs();

      expect(useTabStore.getState().tabs.length).toBe(1);
    });
  });

  describe("closeOtherTabs", () => {
    it("closes all tabs except specified one", () => {
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useTabStore.getState().createTab("Tab 2");
      useTabStore.getState().createTab("Tab 3");

      useTabStore.getState().closeOtherTabs(tab1Id);

      const state = useTabStore.getState();
      expect(state.tabs.length).toBe(1);
      expect(state.tabs[0]?.id).toBe(tab1Id);
    });

    it("shows confirmation for dirty other tabs", () => {
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      const tab2Id = useTabStore.getState().createTab("Tab 2");
      useTabStore.getState().markTabDirty(tab2Id);

      mockConfirm.mockReturnValue(true);
      useTabStore.getState().closeOtherTabs(tab1Id);

      expect(mockConfirm).toHaveBeenCalled();
    });
  });

  describe("Tab Metadata Operations", () => {
    describe("renameTab", () => {
      it("renames active tab by updating workflow meta", () => {
        const tabId = useTabStore.getState().createTab("Original Name");

        useTabStore.getState().renameTab(tabId, "New Name");

        // For active tab, it should update workflow meta
        expect(useWorkflowStore.getState().workflowMeta.name).toBe("New Name");
      });

      it("renames inactive tab directly", () => {
        const tab1Id = useTabStore.getState().createTab("Tab 1");
        useTabStore.getState().createTab("Tab 2");

        // tab2 is active, rename tab1
        useTabStore.getState().renameTab(tab1Id, "Renamed Tab 1");

        const tab1 = useTabStore.getState().getTabById(tab1Id);
        expect(tab1?.name).toBe("Renamed Tab 1");
      });
    });

    describe("setTabFilePath", () => {
      it("sets file path and updates tab name", () => {
        const tabId = useTabStore.getState().createTab();

        useTabStore.getState().setTabFilePath(tabId, "/path/to/MyWorkflow.swwf");

        const tab = useTabStore.getState().getTabById(tabId);
        expect(tab?.filePath).toBe("/path/to/MyWorkflow.swwf");
        expect(tab?.name).toBe("MyWorkflow");
      });
    });

    describe("markTabDirty", () => {
      it("marks tab as dirty", () => {
        const tabId = useTabStore.getState().createTab();
        
        expect(useTabStore.getState().getTabById(tabId)?.isDirty).toBe(false);

        useTabStore.getState().markTabDirty(tabId);

        expect(useTabStore.getState().getTabById(tabId)?.isDirty).toBe(true);
      });

      it("updates lastModified", () => {
        const tabId = useTabStore.getState().createTab();
        const originalTime = useTabStore.getState().getTabById(tabId)?.lastModified;

        useTabStore.getState().markTabDirty(tabId);

        const newTime = useTabStore.getState().getTabById(tabId)?.lastModified;
        expect(newTime).toBeDefined();
        if (originalTime && newTime) {
          // Time should be same or later
          expect(newTime >= originalTime).toBe(true);
        }
      });
    });

    describe("markTabClean", () => {
      it("marks tab as clean", () => {
        const tabId = useTabStore.getState().createTab();
        useTabStore.getState().markTabDirty(tabId);

        useTabStore.getState().markTabClean(tabId);

        expect(useTabStore.getState().getTabById(tabId)?.isDirty).toBe(false);
      });
    });
  });

  describe("State Synchronization", () => {
    describe("saveCurrentTab", () => {
      it("saves workflow state to tabData", () => {
        const tabId = useTabStore.getState().createTab("Test Tab");

        // Modify workflow store
        useWorkflowStore.getState().addTool(createTestTool("tool1"));

        useTabStore.getState().saveCurrentTab();

        const tabData = useTabStore.getState().tabData[tabId];
        expect(tabData?.workflow.tools.length).toBe(1);
      });

      it("no-ops when no active tab", () => {
        useTabStore.setState({ activeTabId: null });

        // Should not throw
        useTabStore.getState().saveCurrentTab();
      });
    });

    describe("loadTab", () => {
      it("loads workflow into workflowStore", () => {
        const workflow = {
          tools: [createTestTool("tool1"), createTestTool("tool2")],
          wires: [],
          workflowMeta: createTestMeta("Loaded Workflow"),
        };
        const tabId = useTabStore.getState().createTab(undefined, workflow);

        // Clear and reload
        useWorkflowStore.setState({ tools: [] });
        useTabStore.getState().loadTab(tabId);

        expect(useWorkflowStore.getState().tools.length).toBe(2);
        expect(useWorkflowStore.getState().workflowMeta.name).toBe("Loaded Workflow");
      });

      it("syncs tab name with workflow meta name on load", () => {
        // Create a tab with an initial workflow that has a specific name
        const workflow = {
          tools: [],
          wires: [],
          workflowMeta: createTestMeta("Loaded Workflow Name"),
        };
        const tabId = useTabStore.getState().createTab(undefined, workflow);

        // The tab name should match the workflow meta name
        const tab = useTabStore.getState().getTabById(tabId);
        expect(tab?.name).toBe("Loaded Workflow Name");
      });
    });
  });

  describe("Queries", () => {
    describe("getTabById", () => {
      it("returns tab when found", () => {
        const tabId = useTabStore.getState().createTab("Test Tab");

        const tab = useTabStore.getState().getTabById(tabId);

        expect(tab?.id).toBe(tabId);
        expect(tab?.name).toBe("Test Tab");
      });

      it("returns undefined for non-existent tab", () => {
        const tab = useTabStore.getState().getTabById("non-existent");
        expect(tab).toBeUndefined();
      });
    });

    describe("hasUnsavedChanges", () => {
      it("returns true for dirty tab", () => {
        const tabId = useTabStore.getState().createTab();
        useTabStore.getState().markTabDirty(tabId);

        expect(useTabStore.getState().hasUnsavedChanges(tabId)).toBe(true);
      });

      it("returns false for clean tab", () => {
        const tabId = useTabStore.getState().createTab();

        expect(useTabStore.getState().hasUnsavedChanges(tabId)).toBe(false);
      });

      it("returns false for non-existent tab", () => {
        expect(useTabStore.getState().hasUnsavedChanges("non-existent")).toBe(false);
      });
    });

    describe("getTabName", () => {
      it("returns tab name", () => {
        const tabId = useTabStore.getState().createTab("My Tab");

        expect(useTabStore.getState().getTabName(tabId)).toBe("My Tab");
      });

      it("returns 'Unknown' for non-existent tab", () => {
        expect(useTabStore.getState().getTabName("non-existent")).toBe("Unknown");
      });
    });
  });

  describe("Tab Data Isolation", () => {
    it("maintains isolated workflow state per tab", () => {
      // Create tab1 with tool
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useWorkflowStore.getState().addTool(createTestTool("tool1"));

      // Create tab2 with different tool
      const tab2Id = useTabStore.getState().createTab("Tab 2");
      useWorkflowStore.getState().addTool(createTestTool("tool2"));

      // Switch back to tab1
      useTabStore.getState().switchTab(tab1Id);

      // Should have tab1's tool
      const tools = useWorkflowStore.getState().tools;
      expect(tools.length).toBe(1);
      expect(tools[0]?.id).toBe("tool1");

      // Switch to tab2
      useTabStore.getState().switchTab(tab2Id);

      // Should have tab2's tool
      const tools2 = useWorkflowStore.getState().tools;
      expect(tools2.length).toBe(1);
      expect(tools2[0]?.id).toBe("tool2");
    });

    it("maintains isolated viewport state per tab", () => {
      // Create tab1 with a specific viewport
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useUIStore.getState().setViewport({ x: 100, y: 200, zoom: 1.5 });

      // Create tab2 with a different viewport
      const tab2Id = useTabStore.getState().createTab("Tab 2");
      useUIStore.getState().setViewport({ x: 500, y: 600, zoom: 0.8 });

      // Switch back to tab1
      useTabStore.getState().switchTab(tab1Id);

      // Should have tab1's viewport
      const viewport1 = useUIStore.getState().viewport;
      expect(viewport1).toEqual({ x: 100, y: 200, zoom: 1.5 });

      // Switch to tab2
      useTabStore.getState().switchTab(tab2Id);

      // Should have tab2's viewport
      const viewport2 = useUIStore.getState().viewport;
      expect(viewport2).toEqual({ x: 500, y: 600, zoom: 0.8 });
    });

    it("preserves null viewport for new tabs", () => {
      // Create tab1 and set a viewport
      const tab1Id = useTabStore.getState().createTab("Tab 1");
      useUIStore.getState().setViewport({ x: 100, y: 200, zoom: 1.0 });

      // Create tab2 (should have null viewport initially)
      const tab2Id = useTabStore.getState().createTab("Tab 2");
      
      // Tab2 starts with null viewport
      expect(useUIStore.getState().viewport).toBeNull();

      // Switch back to tab1
      useTabStore.getState().switchTab(tab1Id);

      // Tab1 should have its viewport restored
      expect(useUIStore.getState().viewport).toEqual({ x: 100, y: 200, zoom: 1.0 });

      // Switch to tab2
      useTabStore.getState().switchTab(tab2Id);

      // Tab2 should still have null viewport
      expect(useUIStore.getState().viewport).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("handles creating many tabs", () => {
      for (let i = 0; i < 20; i++) {
        useTabStore.getState().createTab(`Tab ${i}`);
      }

      expect(useTabStore.getState().tabs.length).toBe(20);
    });

    it("handles rapid tab switching", () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        ids.push(useTabStore.getState().createTab(`Tab ${i}`));
      }

      // Rapidly switch between tabs
      for (let i = 0; i < 10; i++) {
        const targetId = ids[i % ids.length];
        if (targetId) {
          useTabStore.getState().switchTab(targetId);
        }
      }

      // Should still work correctly
      expect(useTabStore.getState().tabs.length).toBe(5);
    });
  });
});
