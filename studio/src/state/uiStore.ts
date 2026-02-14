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

type LeftPaneTab = "tools" | "workflow" | "settings";

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface UIState {
  snapToGrid: boolean;
  minimapVisible: boolean;
  minimapPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  positionMenuOpen: boolean;
  positionMenuCoords: { x: number; y: number } | null;
  workflowViewerVisible: boolean;
  aiChatVisible: boolean;
  activeToolTab: ToolCategory;
  leftPaneTab: LeftPaneTab;
  favoriteTools: string[]; // Array of tool type names that are favorites
  collapsedCategories: string[]; // Array of category IDs that are collapsed
  bottomPaneOpen: boolean;
  bottomPaneHeight: number;
  activeBottomTab: BottomPaneTab;
  previewState: PreviewState | null;
  profileState: ProfileState | null;
  notification: NotificationState;
  viewport: ViewportState | null; // Current canvas viewport state
  // Development/debug mode - bypass backend cache (ephemeral, not persisted)
  bypassCache: boolean;
  toggleSnapToGrid: () => void;
  toggleMinimap: () => void;
  setMinimapPosition: (pos: UIState["minimapPosition"]) => void;
  openPositionMenu: (coords: { x: number; y: number }) => void;
  closePositionMenu: () => void;
  setWorkflowViewerVisible: (visible: boolean) => void;
  setAIChatVisible: (visible: boolean) => void;
  toggleAIChat: () => void;
  setActiveToolTab: (tab: ToolCategory) => void;
  setLeftPaneTab: (tab: LeftPaneTab) => void;
  toggleFavoriteTool: (toolType: string) => void;
  isFavorite: (toolType: string) => boolean;
  toggleCategory: (categoryId: string) => void;
  isCategoryCollapsed: (categoryId: string) => boolean;
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
  setViewport: (viewport: ViewportState | null) => void;
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

// Default favorite tools (used when no saved favorites exist)
const DEFAULT_FAVORITES = ['Input', 'Output', 'Filter', 'Select', 'Sort', 'Formula', 'Union', 'Join', 'Summarize'];

// Load persisted favorites (defaults to curated list)
const loadFavoriteTools = (): string[] => {
  const saved = localStorage.getItem("sigilweaver-favorite-tools");
  if (saved !== null) {
    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_FAVORITES;
    }
  }
  return DEFAULT_FAVORITES;
};

// Load persisted collapsed categories (default: none collapsed)
const loadCollapsedCategories = (): string[] => {
  const saved = localStorage.getItem("sigilweaver-collapsed-categories");
  if (saved !== null) {
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }
  return [];
};

export const useUIStore = create<UIState>()((set, get) => ({
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

  aiChatVisible: false,
  setAIChatVisible: (visible) => set({ aiChatVisible: visible }),
  toggleAIChat: () => set((s) => ({ aiChatVisible: !s.aiChatVisible })),

  activeToolTab: "favorites",
  setActiveToolTab: (tab) => set({ activeToolTab: tab }),

  leftPaneTab: "tools",
  setLeftPaneTab: (tab) => set({ leftPaneTab: tab }),

  favoriteTools: loadFavoriteTools(),
  toggleFavoriteTool: (toolType: string) =>
    set((s) => {
      const isFav = s.favoriteTools.includes(toolType);
      const newFavorites = isFav
        ? s.favoriteTools.filter((t) => t !== toolType)
        : [...s.favoriteTools, toolType];
      localStorage.setItem("sigilweaver-favorite-tools", JSON.stringify(newFavorites));
      return { favoriteTools: newFavorites };
    }),
  isFavorite: (toolType: string) => get().favoriteTools.includes(toolType),

  collapsedCategories: loadCollapsedCategories(),
  toggleCategory: (categoryId: string) =>
    set((s) => {
      const isCollapsed = s.collapsedCategories.includes(categoryId);
      const newCollapsed = isCollapsed
        ? s.collapsedCategories.filter((c) => c !== categoryId)
        : [...s.collapsedCategories, categoryId];
      localStorage.setItem("sigilweaver-collapsed-categories", JSON.stringify(newCollapsed));
      return { collapsedCategories: newCollapsed };
    }),
  isCategoryCollapsed: (categoryId: string) => get().collapsedCategories.includes(categoryId),

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

  viewport: null,
  setViewport: (viewport) => set({ viewport }),

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
