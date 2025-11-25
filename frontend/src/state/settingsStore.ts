/**
 * Settings Store
 * 
 * Manages application settings with persistence via Electron Store.
 * Falls back to localStorage in browser mode.
 */

import { create } from 'zustand';
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

interface SettingsState extends AppSettings {
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateAuthor: (author: string) => Promise<void>;
  updateBackendUrl: (url: string) => Promise<void>;
  updateBackendAutoStart: (autoStart: boolean) => Promise<void>;
  updateTheme: (themeId: string) => Promise<void>;
  updateSnapToGrid: (enabled: boolean) => Promise<void>;
  updateMinimapVisible: (visible: boolean) => Promise<void>;
  updateMinimapPosition: (position: AppSettings['ui']['minimapPosition']) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

/**
 * Load settings from Electron Store or localStorage
 */
async function loadFromStorage(): Promise<AppSettings> {
  if (window.electronAPI?.getSettings) {
    return await window.electronAPI.getSettings();
  }
  
  // Fallback to localStorage for browser mode
  const stored = localStorage.getItem('sigilweaver-settings');
  if (stored) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (error) {
      console.error('Failed to parse settings from localStorage:', error);
      return DEFAULT_SETTINGS;
    }
  }
  
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to Electron Store or localStorage
 */
async function saveToStorage(settings: AppSettings): Promise<void> {
  if (window.electronAPI?.setSettings) {
    await window.electronAPI.setSettings(settings);
  } else {
    // Fallback to localStorage for browser mode
    localStorage.setItem('sigilweaver-settings', JSON.stringify(settings));
  }
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
    const state = get();
    const settings: AppSettings = {
      author,
      backend: state.backend,
      theme: state.theme,
      ui: state.ui,
    };
    await saveToStorage(settings);
  },

  updateBackendUrl: async (url) => {
    const state = get();
    const newBackend = { ...state.backend, url };
    set({ backend: newBackend });
    const settings: AppSettings = {
      author: state.author,
      backend: newBackend,
      theme: state.theme,
      ui: state.ui,
    };
    await saveToStorage(settings);
  },

  updateBackendAutoStart: async (autoStart) => {
    const state = get();
    const newBackend = { ...state.backend, autoStart };
    set({ backend: newBackend });
    const settings: AppSettings = {
      author: state.author,
      backend: newBackend,
      theme: state.theme,
      ui: state.ui,
    };
    await saveToStorage(settings);
  },

  updateTheme: async (themeId) => {
    const state = get();
    const newTheme = { id: themeId };
    set({ theme: newTheme });
    const settings: AppSettings = {
      author: state.author,
      backend: state.backend,
      theme: newTheme,
      ui: state.ui,
    };
    await saveToStorage(settings);
  },

  updateSnapToGrid: async (snapToGrid) => {
    const state = get();
    const newUI = { ...state.ui, snapToGrid };
    set({ ui: newUI });
    const settings: AppSettings = {
      author: state.author,
      backend: state.backend,
      theme: state.theme,
      ui: newUI,
    };
    await saveToStorage(settings);
    
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
    const settings: AppSettings = {
      author: state.author,
      backend: state.backend,
      theme: state.theme,
      ui: newUI,
    };
    await saveToStorage(settings);
    
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
    const settings: AppSettings = {
      author: state.author,
      backend: state.backend,
      theme: state.theme,
      ui: newUI,
    };
    await saveToStorage(settings);
    
    // Sync with uiStore
    const { useUIStore } = await import('./uiStore');
    useUIStore.getState().setMinimapPosition(minimapPosition);
  },

  resetToDefaults: async () => {
    set({ ...DEFAULT_SETTINGS, loaded: true });
    await saveToStorage(DEFAULT_SETTINGS);
  },
}));
