import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "../uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useUIStore.setState({
      snapToGrid: false,
      minimapVisible: true,
      minimapPosition: "bottom-right",
      positionMenuOpen: false,
      positionMenuCoords: null,
      workflowViewerVisible: false,
      activeToolTab: "favorites",
      bottomPaneOpen: false,
      bottomPaneHeight: 300,
      activeBottomTab: "preview",
      previewState: null,
      profileState: null,
      bypassCache: false,
      notification: {
        message: "",
        type: "info",
        isVisible: false,
        duration: 4000,
      },
    });
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial State", () => {
    it("has correct default values", () => {
      const state = useUIStore.getState();

      expect(state.snapToGrid).toBe(false);
      expect(state.minimapVisible).toBe(true);
      expect(state.minimapPosition).toBe("bottom-right");
      expect(state.positionMenuOpen).toBe(false);
      expect(state.positionMenuCoords).toBeNull();
      expect(state.workflowViewerVisible).toBe(false);
      expect(state.activeToolTab).toBe("favorites");
      expect(state.notification).toEqual({
        message: "",
        type: "info",
        isVisible: false,
        duration: 4000,
      });
    });
  });

  describe("Snap to Grid", () => {
    it("toggles snapToGrid from true to false", () => {
      useUIStore.setState({ snapToGrid: true });
      expect(useUIStore.getState().snapToGrid).toBe(true);

      useUIStore.getState().toggleSnapToGrid();

      expect(useUIStore.getState().snapToGrid).toBe(false);
    });

    it("toggles snapToGrid from false to true", () => {
      useUIStore.setState({ snapToGrid: false });

      useUIStore.getState().toggleSnapToGrid();

      expect(useUIStore.getState().snapToGrid).toBe(true);
    });

    it("preserves other state when toggling snapToGrid", () => {
      useUIStore.setState({
        minimapVisible: true,
        positionMenuOpen: true,
        positionMenuCoords: { x: 100, y: 200 },
      });

      useUIStore.getState().toggleSnapToGrid();

      const state = useUIStore.getState();
      expect(state.minimapVisible).toBe(true);
      expect(state.positionMenuOpen).toBe(true);
      expect(state.positionMenuCoords).toEqual({ x: 100, y: 200 });
    });
  });

  describe("Minimap", () => {
    it("toggles minimap from false to true", () => {
      useUIStore.setState({ minimapVisible: false });
      expect(useUIStore.getState().minimapVisible).toBe(false);

      useUIStore.getState().toggleMinimap();

      expect(useUIStore.getState().minimapVisible).toBe(true);
    });

    it("toggles minimap from true to false", () => {
      useUIStore.setState({ minimapVisible: true });

      useUIStore.getState().toggleMinimap();

      expect(useUIStore.getState().minimapVisible).toBe(false);
    });

    it("sets minimap position to top-left", () => {
      useUIStore.getState().setMinimapPosition("top-left");

      expect(useUIStore.getState().minimapPosition).toBe("top-left");
    });

    it("sets minimap position to top-right", () => {
      useUIStore.getState().setMinimapPosition("top-right");

      expect(useUIStore.getState().minimapPosition).toBe("top-right");
    });

    it("sets minimap position to bottom-left", () => {
      useUIStore.getState().setMinimapPosition("bottom-left");

      expect(useUIStore.getState().minimapPosition).toBe("bottom-left");
    });

    it("sets minimap position to bottom-right", () => {
      useUIStore.getState().setMinimapPosition("bottom-right");

      expect(useUIStore.getState().minimapPosition).toBe("bottom-right");
    });

    it("closes position menu when setting minimap position", () => {
      useUIStore.setState({ positionMenuOpen: true });

      useUIStore.getState().setMinimapPosition("top-left");

      expect(useUIStore.getState().positionMenuOpen).toBe(false);
    });

    it("preserves other state when toggling minimap", () => {
      useUIStore.setState({
        snapToGrid: false,
        positionMenuCoords: { x: 50, y: 75 },
      });

      useUIStore.getState().toggleMinimap();

      const state = useUIStore.getState();
      expect(state.snapToGrid).toBe(false);
      expect(state.positionMenuCoords).toEqual({ x: 50, y: 75 });
    });
  });

  describe("Position Menu", () => {
    it("opens position menu with coordinates", () => {
      const coords = { x: 150, y: 250 };

      useUIStore.getState().openPositionMenu(coords);

      const state = useUIStore.getState();
      expect(state.positionMenuOpen).toBe(true);
      expect(state.positionMenuCoords).toEqual(coords);
    });

    it("closes position menu", () => {
      useUIStore.setState({
        positionMenuOpen: true,
        positionMenuCoords: { x: 100, y: 200 },
      });

      useUIStore.getState().closePositionMenu();

      const state = useUIStore.getState();
      expect(state.positionMenuOpen).toBe(false);
      // Note: coords are preserved when closing
      expect(state.positionMenuCoords).toEqual({ x: 100, y: 200 });
    });

    it("updates coordinates when opening position menu multiple times", () => {
      useUIStore.getState().openPositionMenu({ x: 100, y: 200 });
      useUIStore.getState().openPositionMenu({ x: 300, y: 400 });

      const state = useUIStore.getState();
      expect(state.positionMenuOpen).toBe(true);
      expect(state.positionMenuCoords).toEqual({ x: 300, y: 400 });
    });

    it("preserves other state when managing position menu", () => {
      useUIStore.setState({
        snapToGrid: false,
        minimapVisible: true,
        minimapPosition: "top-left",
      });

      useUIStore.getState().openPositionMenu({ x: 50, y: 50 });

      const state = useUIStore.getState();
      expect(state.snapToGrid).toBe(false);
      expect(state.minimapVisible).toBe(true);
      expect(state.minimapPosition).toBe("top-left");
    });
  });

  describe("Notifications", () => {
    it("shows notification with default type and duration", () => {
      const message = "Test notification";

      useUIStore.getState().showNotification(message);

      const notification = useUIStore.getState().notification;
      expect(notification.message).toBe(message);
      expect(notification.type).toBe("info");
      expect(notification.isVisible).toBe(true);
      expect(notification.duration).toBe(4000);
      expect(notification.expiresAt).toBeGreaterThan(Date.now() - 100);
    });

    it("shows notification with custom type", () => {
      const message = "Error message";

      useUIStore.getState().showNotification(message, "error");

      const notification = useUIStore.getState().notification;
      expect(notification.message).toBe(message);
      expect(notification.type).toBe("error");
      expect(notification.isVisible).toBe(true);
    });

    it("shows notification with custom duration", () => {
      const message = "Custom duration";
      const duration = 3000;

      useUIStore.getState().showNotification(message, "warning", duration);

      const notification = useUIStore.getState().notification;
      expect(notification.message).toBe(message);
      expect(notification.type).toBe("warning");
      expect(notification.duration).toBe(duration);
    });

    it("shows success notification", () => {
      useUIStore.getState().showNotification("Success!", "success");

      const notification = useUIStore.getState().notification;
      expect(notification.type).toBe("success");
    });

    it("shows info notification", () => {
      useUIStore.getState().showNotification("Information", "info");

      const notification = useUIStore.getState().notification;
      expect(notification.type).toBe("info");
    });

    it("hides notification", () => {
      useUIStore.getState().showNotification("Will be hidden", "info", 50);
      expect(useUIStore.getState().notification.isVisible).toBe(true);

      useUIStore.getState().hideNotification();

      const notification = useUIStore.getState().notification;
      expect(notification.isVisible).toBe(false);
      // Other properties preserved
      expect(notification.message).toBe("Will be hidden");
      expect(notification.type).toBe("info");
    });

    it("calculates expiration time correctly", () => {
      const beforeTime = Date.now();
      const duration = 2000;

      useUIStore.getState().showNotification("Timed", "info", duration);

      const notification = useUIStore.getState().notification;
      const afterTime = Date.now();

      expect(notification.expiresAt).toBeGreaterThanOrEqual(
        beforeTime + duration
      );
      expect(notification.expiresAt).toBeLessThanOrEqual(afterTime + duration);
    });

    it("replaces existing notification", () => {
      useUIStore.getState().showNotification("First message", "error");
      useUIStore.getState().showNotification("Second message", "success");

      const notification = useUIStore.getState().notification;
      expect(notification.message).toBe("Second message");
      expect(notification.type).toBe("success");
    });

    it("preserves other state when showing notifications", () => {
      useUIStore.setState({
        snapToGrid: false,
        minimapVisible: true,
        positionMenuOpen: true,
      });

      useUIStore.getState().showNotification("Test");

      const state = useUIStore.getState();
      expect(state.snapToGrid).toBe(false);
      expect(state.minimapVisible).toBe(true);
      expect(state.positionMenuOpen).toBe(true);
    });
  });

  describe("Auto-hide Notifications", () => {
    it("auto-hides expired notifications", () => {
      vi.useFakeTimers();
      const pastTime = Date.now() - 1000; // 1 second ago

      useUIStore.setState({
        notification: {
          message: "Expired",
          type: "info",
          isVisible: true,
          duration: 500,
          expiresAt: pastTime,
        },
      });

      useUIStore.getState().maybeAutoHide();

      expect(useUIStore.getState().notification.isVisible).toBe(false);

      vi.useRealTimers();
    });

    it("does not hide non-expired notifications", () => {
      vi.useFakeTimers();
      const futureTime = Date.now() + 5000; // 5 seconds from now

      useUIStore.setState({
        notification: {
          message: "Not expired",
          type: "info",
          isVisible: true,
          duration: 6000,
          expiresAt: futureTime,
        },
      });

      useUIStore.getState().maybeAutoHide();

      expect(useUIStore.getState().notification.isVisible).toBe(true);

      vi.useRealTimers();
    });

    it("does not hide notifications without expiration time", () => {
      useUIStore.setState({
        notification: {
          message: "No expiration",
          type: "info",
          isVisible: true,
          duration: 6000,
          // No expiresAt property
        },
      });

      useUIStore.getState().maybeAutoHide();

      expect(useUIStore.getState().notification.isVisible).toBe(true);
    });

    it("does not hide notifications that are already hidden", () => {
      const pastTime = Date.now() - 1000;

      useUIStore.setState({
        notification: {
          message: "Already hidden",
          type: "info",
          isVisible: false,
          duration: 500,
          expiresAt: pastTime,
        },
      });

      useUIStore.getState().maybeAutoHide();

      // Should remain hidden
      expect(useUIStore.getState().notification.isVisible).toBe(false);
    });

    it("preserves notification properties when auto-hiding", () => {
      vi.useFakeTimers();
      const pastTime = Date.now() - 1000;

      useUIStore.setState({
        notification: {
          message: "Will be auto-hidden",
          type: "warning",
          isVisible: true,
          duration: 500,
          expiresAt: pastTime,
        },
      });

      useUIStore.getState().maybeAutoHide();

      const notification = useUIStore.getState().notification;
      expect(notification.isVisible).toBe(false);
      expect(notification.message).toBe("Will be auto-hidden");
      expect(notification.type).toBe("warning");
      expect(notification.duration).toBe(500);
      expect(notification.expiresAt).toBe(pastTime);

      vi.useRealTimers();
    });
  });

  describe("Auto-hide Timer Setup", () => {
    it("starts notification auto-hide interval", async () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, "setInterval");

      // Reset the module state by clearing the already started flag
      vi.resetModules();
      const { startNotificationAutoHide } = await import("../uiStore");

      startNotificationAutoHide(500);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 500);

      vi.useRealTimers();
    });

    it("uses default interval when none specified", async () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, "setInterval");

      // Reset the module state
      vi.resetModules();
      const { startNotificationAutoHide } = await import("../uiStore");

      startNotificationAutoHide();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      vi.useRealTimers();
    });

    it("prevents multiple auto-hide timers", async () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, "setInterval");

      // Reset the module state
      vi.resetModules();
      const { startNotificationAutoHide } = await import("../uiStore");

      startNotificationAutoHide();
      startNotificationAutoHide();
      startNotificationAutoHide();

      // Should only be called once despite multiple invocations
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("Store Integration", () => {
    it("handles multiple operations together correctly", () => {
      // Perform multiple operations
      useUIStore.getState().toggleSnapToGrid(); // true (was false)
      useUIStore.getState().toggleMinimap(); // false (was true)
      useUIStore.getState().openPositionMenu({ x: 123, y: 456 }); // Opens menu
      useUIStore.getState().setMinimapPosition("top-right"); // Closes menu
      useUIStore
        .getState()
        .showNotification("Integration test", "success", 3000);

      const state = useUIStore.getState();

      expect(state.snapToGrid).toBe(true);
      expect(state.minimapVisible).toBe(false);
      expect(state.minimapPosition).toBe("top-right");
      expect(state.positionMenuOpen).toBe(false); // Closed by setMinimapPosition
      expect(state.positionMenuCoords).toEqual({ x: 123, y: 456 });
      expect(state.notification.message).toBe("Integration test");
      expect(state.notification.type).toBe("success");
      expect(state.notification.isVisible).toBe(true);
    });

    it("maintains state consistency across operations", () => {
      // Start with custom state
      useUIStore.setState({
        snapToGrid: true,
        minimapVisible: false,
        minimapPosition: "top-left",
        positionMenuOpen: true,
        positionMenuCoords: { x: 100, y: 200 },
        workflowViewerVisible: false,
        activeToolTab: "inout",
        notification: {
          message: "Initial",
          type: "info",
          isVisible: true,
          duration: 1000,
        },
      });

      // Perform operations that should preserve unrelated state
      useUIStore.getState().hideNotification();
      useUIStore.getState().toggleSnapToGrid();

      const state = useUIStore.getState();

      // Changed state
      expect(state.notification.isVisible).toBe(false);
      expect(state.snapToGrid).toBe(false);

      // Preserved state
      expect(state.minimapVisible).toBe(false);
      expect(state.minimapPosition).toBe("top-left");
      expect(state.positionMenuOpen).toBe(true);
      expect(state.positionMenuCoords).toEqual({ x: 100, y: 200 });
      expect(state.notification.message).toBe("Initial"); // Message preserved
    });
  });

  describe("Preview State", () => {
    it("has null previewState by default", () => {
      expect(useUIStore.getState().previewState).toBeNull();
    });

    it("sets preview state", () => {
      const previewState = {
        toolId: "tool1",
        socketId: "output",
        socketDirection: "output" as const,
        data: [{ name: "Alice", age: 30 }],
        schema: [{ name: "name", dtype: "String", nullable: false }],
        loading: false,
        error: null,
      };

      useUIStore.getState().setPreviewState(previewState);

      expect(useUIStore.getState().previewState).toEqual(previewState);
    });

    it("clears preview state with null", () => {
      useUIStore.setState({
        previewState: {
          toolId: "tool1",
          socketId: "output",
          socketDirection: "output",
          data: [],
          schema: [],
          loading: false,
          error: null,
        },
      });

      useUIStore.getState().setPreviewState(null);

      expect(useUIStore.getState().previewState).toBeNull();
    });

    it("sets preview loading state", () => {
      useUIStore.setState({
        previewState: {
          toolId: "tool1",
          socketId: "output",
          socketDirection: "output",
          data: [],
          schema: [],
          loading: false,
          error: null,
        },
      });

      useUIStore.getState().setPreviewLoading(true);

      expect(useUIStore.getState().previewState?.loading).toBe(true);
    });

    it("sets preview error state", () => {
      useUIStore.setState({
        previewState: {
          toolId: "tool1",
          socketId: "output",
          socketDirection: "output",
          data: [],
          schema: [],
          loading: true,
          error: null,
        },
      });

      useUIStore.getState().setPreviewError("Failed to load");

      const state = useUIStore.getState().previewState;
      expect(state?.error).toBe("Failed to load");
      expect(state?.loading).toBe(false);
    });

    it("does not set preview loading if previewState is null", () => {
      useUIStore.setState({ previewState: null });

      useUIStore.getState().setPreviewLoading(true);

      expect(useUIStore.getState().previewState).toBeNull();
    });
  });

  describe("Profile State", () => {
    it("has null profileState by default", () => {
      expect(useUIStore.getState().profileState).toBeNull();
    });

    it("sets profile state", () => {
      const profileState = {
        toolId: "tool1",
        socketId: "input",
        socketDirection: "input" as const,
        profile: {
          tool_id: "tool1",
          socket_id: "input",
          row_count: 100,
          column_count: 3,
          columns: {
            name: {
              column: "name",
              dtype: "String",
              count: 100,
              null_count: 0,
              null_percent: 0,
              unique_count: 95,
            },
          },
        },
        loading: false,
        error: null,
      };

      useUIStore.getState().setProfileState(profileState);

      expect(useUIStore.getState().profileState).toEqual(profileState);
    });

    it("clears profile state with null", () => {
      useUIStore.setState({
        profileState: {
          toolId: "tool1",
          socketId: "input",
          socketDirection: "input",
          profile: null,
          loading: false,
          error: null,
        },
      });

      useUIStore.getState().setProfileState(null);

      expect(useUIStore.getState().profileState).toBeNull();
    });

    it("sets profile loading state", () => {
      useUIStore.setState({
        profileState: {
          toolId: "tool1",
          socketId: "input",
          socketDirection: "input",
          profile: null,
          loading: false,
          error: null,
        },
      });

      useUIStore.getState().setProfileLoading(true);

      expect(useUIStore.getState().profileState?.loading).toBe(true);
    });

    it("sets profile error state", () => {
      useUIStore.setState({
        profileState: {
          toolId: "tool1",
          socketId: "input",
          socketDirection: "input",
          profile: null,
          loading: true,
          error: null,
        },
      });

      useUIStore.getState().setProfileError("Failed to profile");

      const state = useUIStore.getState().profileState;
      expect(state?.error).toBe("Failed to profile");
      expect(state?.loading).toBe(false);
    });

    it("does not set profile loading if profileState is null", () => {
      useUIStore.setState({ profileState: null });

      useUIStore.getState().setProfileLoading(true);

      expect(useUIStore.getState().profileState).toBeNull();
    });
  });

  describe("Bottom Pane Tabs", () => {
    it("has preview as default active tab", () => {
      expect(useUIStore.getState().activeBottomTab).toBe("preview");
    });

    it("can switch to profile tab", () => {
      useUIStore.getState().setActiveBottomTab("profile");

      expect(useUIStore.getState().activeBottomTab).toBe("profile");
    });

    it("can switch between all tabs", () => {
      useUIStore.getState().setActiveBottomTab("logs");
      expect(useUIStore.getState().activeBottomTab).toBe("logs");

      useUIStore.getState().setActiveBottomTab("network");
      expect(useUIStore.getState().activeBottomTab).toBe("network");

      useUIStore.getState().setActiveBottomTab("profile");
      expect(useUIStore.getState().activeBottomTab).toBe("profile");

      useUIStore.getState().setActiveBottomTab("preview");
      expect(useUIStore.getState().activeBottomTab).toBe("preview");
    });
  });
});
