import { create } from "zustand";
import type { ToolCategory } from "../domain/workflow/entities/workflow";
import type { ProfileResponse } from "../api/backend";

type NotificationType = "error" | "warning" | "success" | "info";

type BottomPaneTab = "preview" | "logs" | "network" | "profile";

export interface PreviewState {
  toolId: string;
  socketId: string;
  socketDirection: "input" | "output";
  data: Record<string, unknown>[];
  schema: Array<{ name: string; dtype: string; nullable: boolean }>;
  loading: boolean;
  error: string | null;
}

export interface ProfileState {
  toolId: string;
  socketId: string;
  socketDirection: "input" | "output";
  profile: ProfileResponse | null;
  loading: boolean;
  error: string | null;
}

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
  bottomPaneOpen: boolean;
  bottomPaneHeight: number;
  activeBottomTab: BottomPaneTab;
  previewState: PreviewState | null;
  profileState: ProfileState | null;
  notification: NotificationState;
  // Development/debug mode - bypass backend cache (ephemeral, not persisted)
  bypassCache: boolean;
  toggleSnapToGrid: () => void;
  toggleMinimap: () => void;
  setMinimapPosition: (pos: UIState["minimapPosition"]) => void;
  openPositionMenu: (coords: { x: number; y: number }) => void;
  closePositionMenu: () => void;
  setWorkflowViewerVisible: (visible: boolean) => void;
  setActiveToolTab: (tab: ToolCategory) => void;
  setBottomPaneOpen: (open: boolean) => void;
  toggleBottomPane: () => void;
  setBottomPaneHeight: (height: number) => void;
  setActiveBottomTab: (tab: BottomPaneTab) => void;
  setPreviewState: (state: PreviewState | null) => void;
  setPreviewLoading: (loading: boolean) => void;
  setPreviewError: (error: string | null) => void;
  setProfileState: (state: ProfileState | null) => void;
  setProfileLoading: (loading: boolean) => void;
  setProfileError: (error: string | null) => void;
  setBypassCache: (bypass: boolean) => void;
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

  bottomPaneOpen: false,
  bottomPaneHeight: 300,
  activeBottomTab: "preview",
  setBottomPaneOpen: (open) => set({ bottomPaneOpen: open }),
  toggleBottomPane: () => set((s) => ({ bottomPaneOpen: !s.bottomPaneOpen })),
  setBottomPaneHeight: (height) =>
    set({ bottomPaneHeight: Math.max(100, Math.min(height, window.innerHeight * 0.6)) }),
  setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),

  previewState: null,
  setPreviewState: (state) => set({ previewState: state }),
  setPreviewLoading: (loading) =>
    set((s) => (s.previewState ? { previewState: { ...s.previewState, loading } } : {})),
  setPreviewError: (error) =>
    set((s) => (s.previewState ? { previewState: { ...s.previewState, error, loading: false } } : {})),

  profileState: null,
  setProfileState: (state) => set({ profileState: state }),
  setProfileLoading: (loading) =>
    set((s) => (s.profileState ? { profileState: { ...s.profileState, loading } } : {})),
  setProfileError: (error) =>
    set((s) => (s.profileState ? { profileState: { ...s.profileState, error, loading: false } } : {})),

  // Development/debug mode - bypass backend cache (ephemeral, not persisted)
  bypassCache: false,
  setBypassCache: (bypass) => set({ bypassCache: bypass }),

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
