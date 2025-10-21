import { create } from "zustand";
import type { ToolCategory } from "../domain/workflow/entities/workflow";

type NotificationType = "error" | "warning" | "success" | "info";

interface NotificationState {
  message: string;
  type: NotificationType;
  isVisible: boolean;
  duration: number; // ms
  expiresAt?: number; // timestamp when it should auto-hide
}

interface UIState {
  snapToGrid: boolean;
  minimapVisible: boolean;
  minimapPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  positionMenuOpen: boolean;
  positionMenuCoords: { x: number; y: number } | null;
  workflowViewerVisible: boolean;
  activeToolTab: ToolCategory;
  notification: NotificationState;
  toggleSnapToGrid: () => void;
  toggleMinimap: () => void;
  setMinimapPosition: (pos: UIState["minimapPosition"]) => void;
  openPositionMenu: (coords: { x: number; y: number }) => void;
  closePositionMenu: () => void;
  setWorkflowViewerVisible: (visible: boolean) => void;
  setActiveToolTab: (tab: ToolCategory) => void;
  showNotification: (
    message: string,
    type?: NotificationType,
    duration?: number
  ) => void;
  hideNotification: () => void;
  maybeAutoHide: () => void;
}

// Load persisted snap state (default: true)
const loadSnapToGrid = (): boolean => {
  const saved = localStorage.getItem("sigilweaver-snap-to-grid");
  return saved !== null ? saved === "true" : true; // Default: ON
};

export const useUIStore = create<UIState>()((set) => ({
  snapToGrid: loadSnapToGrid(),
  toggleSnapToGrid: () =>
    set((s) => {
      const newValue = !s.snapToGrid;
      localStorage.setItem("sigilweaver-snap-to-grid", String(newValue));
      return { snapToGrid: newValue };
    }),

  minimapVisible: true,
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
  minimapPosition: "bottom-right",
  setMinimapPosition: (pos) =>
    set({ minimapPosition: pos, positionMenuOpen: false }),

  positionMenuOpen: false,
  positionMenuCoords: null,
  openPositionMenu: (coords) =>
    set({ positionMenuOpen: true, positionMenuCoords: coords }),
  closePositionMenu: () => set({ positionMenuOpen: false }),

  workflowViewerVisible: false,
  setWorkflowViewerVisible: (visible) =>
    set({ workflowViewerVisible: visible }),

  activeToolTab: "favorites",
  setActiveToolTab: (tab) => set({ activeToolTab: tab }),

  notification: {
    message: "",
    type: "info",
    isVisible: false,
    duration: 4000,
  },
  showNotification: (message, type = "info", duration = 4000) => {
    const expiresAt = Date.now() + duration;
    set({
      notification: { message, type, isVisible: true, duration, expiresAt },
    });
  },
  hideNotification: () =>
    set((s) => ({
      notification: { ...s.notification, isVisible: false },
    })),
  maybeAutoHide: () => {
    const state = useUIStore.getState();
    if (
      state.notification.isVisible &&
      state.notification.expiresAt &&
      Date.now() >= state.notification.expiresAt
    ) {
      state.hideNotification();
    }
  },
}));

let autoHideStarted = false;
export function startNotificationAutoHide(intervalMs = 1000) {
  if (autoHideStarted) return;
  autoHideStarted = true;
  setInterval(() => {
    useUIStore.getState().maybeAutoHide();
  }, intervalMs);
}
