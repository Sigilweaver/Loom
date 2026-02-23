/**
 * Settings Store
 * 
 * Manages application settings with persistence via platform adapter.
 * Uses Electron Store in desktop mode, localStorage in browser mode.
 */

import { create } from 'zustand';
import { platform } from '@platform';
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

interface SettingsState extends AppSettings {
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateAuthor: (author: string) => Promise<void>;
  updateExecutionMode: (mode: AppSettings['executionMode']) => Promise<void>;
  updateBackendUrl: (url: string) => Promise<void>;
  updateBackendAutoStart: (autoStart: boolean) => Promise<void>;
  updateBackendPreviewRows: (previewRows: number) => Promise<void>;
  updateHubUrl: (url: string) => Promise<void>;
  updateHubRememberLogin: (rememberLogin: boolean) => Promise<void>;
  updateHubSessionToken: (token: string | null) => Promise<void>;
  updateTheme: (themeId: string) => Promise<void>;
  updateSnapToGrid: (enabled: boolean) => Promise<void>;
  updateMinimapVisible: (visible: boolean) => Promise<void>;
  updateMinimapPosition: (position: AppSettings['ui']['minimapPosition']) => Promise<void>;
  updateEdgeStyle: (edgeStyle: AppSettings['ui']['edgeStyle']) => Promise<void>;
  updateAutoConnect: (autoConnect: boolean) => Promise<void>;
  updateAutoConnectRadius: (radius: number) => Promise<void>;
  updateCommentsVisible: (visible: boolean) => Promise<void>;
  updateCommentsAlignment: (alignment: AppSettings['comments']['alignment']) => Promise<void>;
  updateCommentsMaxWidth: (maxWidth: number) => Promise<void>;
  updateCommentsMaxHeight: (maxHeight: number) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

/**
 * Load settings from platform storage
 */
async function loadFromStorage(): Promise<AppSettings> {
  return platform.settings.getSettings();
}

/**
 * Save settings to platform storage
 */
async function saveToStorage(settings: AppSettings): Promise<void> {
  await platform.settings.setSettings(settings);
}

/**
 * Build AppSettings object from current state
 */
function buildSettings(state: SettingsState): AppSettings {
  return {
    author: state.author,
    executionMode: state.executionMode,
    backend: state.backend,
    hub: state.hub,
    theme: state.theme,
    ui: state.ui,
    behavior: state.behavior,
    comments: state.comments,
  };
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  loadSettings: async () => {
    const settings = await loadFromStorage();
    set({ ...settings, loaded: true });
  },

  updateAuthor: async (author) => {
    set({ author });
    await saveToStorage(buildSettings(get()));
  },

  updateExecutionMode: async (executionMode) => {
    set({ executionMode });
    await saveToStorage(buildSettings(get()));
  },

  updateBackendUrl: async (url) => {
    const state = get();
    const newBackend = { ...state.backend, url };
    set({ backend: newBackend });
    await saveToStorage(buildSettings(get()));
  },

  updateBackendAutoStart: async (autoStart) => {
    const state = get();
    const newBackend = { ...state.backend, autoStart };
    set({ backend: newBackend });
    await saveToStorage(buildSettings(get()));
  },

  updateBackendPreviewRows: async (previewRows) => {
    const state = get();
    const newBackend = { ...state.backend, previewRows };
    set({ backend: newBackend });
    await saveToStorage(buildSettings(get()));
  },

  updateHubUrl: async (url) => {
    const state = get();
    const newHub = { ...state.hub, url };
    set({ hub: newHub });
    await saveToStorage(buildSettings(get()));
  },

  updateHubRememberLogin: async (rememberLogin) => {
    const state = get();
    const newHub = { ...state.hub, rememberLogin };
    set({ hub: newHub });
    await saveToStorage(buildSettings(get()));
  },

  updateHubSessionToken: async (sessionToken) => {
    const state = get();
    const newHub = { ...state.hub, sessionToken };
    set({ hub: newHub });
    await saveToStorage(buildSettings(get()));
  },

  updateTheme: async (themeId) => {
    const newTheme = { id: themeId };
    set({ theme: newTheme });
    await saveToStorage(buildSettings(get()));
  },

  updateSnapToGrid: async (snapToGrid) => {
    const state = get();
    const newUI = { ...state.ui, snapToGrid };
    set({ ui: newUI });
    await saveToStorage(buildSettings(get()));
    
    // Sync with uiStore
    const { useUIStore } = await import('./uiStore');
    const currentSnap = useUIStore.getState().snapToGrid;
    if (currentSnap !== snapToGrid) {
      useUIStore.getState().toggleSnapToGrid();
    }
  },

  updateMinimapVisible: async (minimapVisible) => {
    const state = get();
    const newUI = { ...state.ui, minimapVisible };
    set({ ui: newUI });
    await saveToStorage(buildSettings(get()));
    
    // Sync with uiStore
    const { useUIStore } = await import('./uiStore');
    const currentVisible = useUIStore.getState().minimapVisible;
    if (currentVisible !== minimapVisible) {
      useUIStore.getState().toggleMinimap();
    }
  },

  updateMinimapPosition: async (minimapPosition) => {
    const state = get();
    const newUI = { ...state.ui, minimapPosition };
    set({ ui: newUI });
    await saveToStorage(buildSettings(get()));
    
    // Sync with uiStore
    const { useUIStore } = await import('./uiStore');
    useUIStore.getState().setMinimapPosition(minimapPosition);
  },

  updateEdgeStyle: async (edgeStyle) => {
    const state = get();
    const newUI = { ...state.ui, edgeStyle };
    set({ ui: newUI });
    await saveToStorage(buildSettings(get()));
    
    // Trigger edge resync to apply new style
    const { useWorkflowStore } = await import('./workflowStore');
    useWorkflowStore.getState().syncEdges();
  },

  updateAutoConnect: async (autoConnect) => {
    const state = get();
    const newBehavior = { ...state.behavior, autoConnect };
    set({ behavior: newBehavior });
    await saveToStorage(buildSettings(get()));
  },

  updateAutoConnectRadius: async (autoConnectRadius) => {
    const state = get();
    const newBehavior = { ...state.behavior, autoConnectRadius };
    set({ behavior: newBehavior });
    await saveToStorage(buildSettings(get()));
  },

  updateCommentsVisible: async (visible) => {
    const state = get();
    const newComments = { ...state.comments, visible };
    set({ comments: newComments });
    await saveToStorage(buildSettings(get()));
  },

  updateCommentsAlignment: async (alignment) => {
    const state = get();
    const newComments = { ...state.comments, alignment };
    set({ comments: newComments });
    await saveToStorage(buildSettings(get()));
  },

  updateCommentsMaxWidth: async (maxWidth) => {
    const state = get();
    const newComments = { ...state.comments, maxWidth };
    set({ comments: newComments });
    await saveToStorage(buildSettings(get()));
  },

  updateCommentsMaxHeight: async (maxHeight) => {
    const state = get();
    const newComments = { ...state.comments, maxHeight };
    set({ comments: newComments });
    await saveToStorage(buildSettings(get()));
  },

  resetToDefaults: async () => {
    set({ ...DEFAULT_SETTINGS, loaded: true });
    await saveToStorage(DEFAULT_SETTINGS);
  },
}));
