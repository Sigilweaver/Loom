# Cross-Session State Management & Credits Implementation Guide

## Overview
This implementation adds persistent settings storage and an About/Credits dialog to Sigilweaver.

## Files Created

### 1. Type Definitions
- ✅ `frontend/src/types/settings.ts` - AppSettings interface and defaults
- ✅ Updated `frontend/src/types/electron.d.ts` - Added getSettings/setSettings to electronAPI

### 2. State Management
- ✅ `frontend/src/state/settingsStore.ts` - Zustand store with Electron persistence

### 3. UI Components
- ✅ `frontend/src/components/SettingsDialog.tsx` - Settings dialog with tabs
- ✅ `frontend/src/components/AboutDialog.tsx` - About/credits dialog

## Installation Steps

### Step 1: Install electron-store
```bash
cd frontend
npm install electron-store
```

### Step 2: Update Electron main process
Add to `frontend/electron/main.ts` after imports:

```typescript
import Store from 'electron-store';
import type { AppSettings } from '../src/types/settings';
import { DEFAULT_SETTINGS } from '../src/types/settings';

// Initialize electron-store with schema
const store = new Store<{ settings: AppSettings }>({
  defaults: {
    settings: DEFAULT_SETTINGS,
  },
  name: 'sigilweaver-settings',
});
```

Then add IPC handlers before `app.whenReady()`:

```typescript
// Settings IPC handlers
ipcMain.handle('get-settings', async (): Promise<AppSettings> => {
  return store.get('settings', DEFAULT_SETTINGS);
});

ipcMain.handle('set-settings', async (_event, settings: AppSettings): Promise<void> => {
  store.set('settings', settings);
});
```

### Step 3: Update Electron preload
Add to `frontend/electron/preload.ts` in the `contextBridge.exposeInMainWorld` call:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing handlers ...
  getSettings: async () => {
    return ipcRenderer.invoke('get-settings');
  },
  setSettings: async (settings: any) => {
    return ipcRenderer.invoke('set-settings', settings);
  },
});
```

### Step 4: Update App.tsx to initialize settings
Add to `frontend/src/App.tsx`:

```typescript
import { useSettingsStore } from '@state/settingsStore';
import { useState } from 'react';
import SettingsDialog from './components/SettingsDialog';
import AboutDialog from './components/AboutDialog';

function App() {
  const loadSettings = useSettingsStore(s => s.loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ... rest of App component

  return (
    <ThemeProvider>
      <ReactFlowProvider>
        <div className="flex flex-col h-screen bg-theme-surface-page">
          <Header />
          {/* ... existing components ... */}
          
          {/* Add these dialogs */}
          <SettingsDialog isOpen={showSettings} onClose={() => setShowSettings(false)} />
          <AboutDialog 
            isOpen={showAbout} 
            onClose={() => setShowAbout(false)}
            version="0.0.0-dev" 
          />
        </div>
      </ReactFlowProvider>
    </ThemeProvider>
  );
}
```

### Step 5: Add menu triggers in Header
Update `frontend/src/components/Header.tsx` to add Settings and About menu items.

Add state:
```typescript
const [showSettings, setShowSettings] = useState(false);
const [showAbout, setShowAbout] = useState(false);
```

Add buttons in the header (before theme selector):
```typescript
<button
  onClick={() => setShowSettings(true)}
  className="px-3 py-1.5 text-sm text-theme-text-secondary hover:text-theme-text-primary transition-colors"
  title="Settings"
>
  Settings
</button>

<button
  onClick={() => setShowAbout(true)}
  className="px-3 py-1.5 text-sm text-theme-text-secondary hover:text-theme-text-primary transition-colors"
  title="About"
>
  About
</button>
```

### Step 6: Migrate theme persistence
Update `frontend/src/contexts/ThemeContext.tsx`:

Replace localStorage usage with settings store:

```typescript
import { useSettingsStore } from '@state/settingsStore';

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const themeId = useSettingsStore(s => s.theme.id);
  const updateTheme = useSettingsStore(s => s.updateTheme);
  const loaded = useSettingsStore(s => s.loaded);
  
  const [currentTheme, setCurrentTheme] = useState<Theme>(getThemeById(themeId));

  // Apply theme when settings loaded
  useEffect(() => {
    if (loaded) {
      const theme = getThemeById(themeId);
      setCurrentTheme(theme);
      applyThemeVariables(theme);
    }
  }, [loaded, themeId]);

  const setTheme = async (themeId: string) => {
    const theme = getThemeById(themeId);
    setCurrentTheme(theme);
    applyThemeVariables(theme);
    await updateTheme(themeId);
  };

  // ... rest of provider
};
```

### Step 7: Update workflowStore to use persistent author
Update `frontend/src/state/workflowStore.ts`:

```typescript
import { useSettingsStore } from './settingsStore';

const createDefaultMeta = (): WorkflowMeta => {
  const author = useSettingsStore.getState().author || 'SigilWeaver User';
  
  return {
    name: "New Workflow",
    description: "A new workflow",
    author,
    workflowId: uuidv4(),
    created: new Date().toISOString(),
  };
};
```

### Step 8: Sync UI preferences
Update `frontend/src/state/uiStore.ts` to read from and sync to settings:

```typescript
import { useSettingsStore } from './settingsStore';

export const useUIStore = create<UIState>()((set, get) => {
  // Load initial values from settings
  const settings = useSettingsStore.getState();
  
  return {
    snapToGrid: settings.ui.snapToGrid,
    toggleSnapToGrid: async () => {
      const newValue = !get().snapToGrid;
      set({ snapToGrid: newValue });
      await useSettingsStore.getState().updateSnapToGrid(newValue);
    },

    minimapVisible: settings.ui.minimapVisible,
    toggleMinimap: async () => {
      const newValue = !get().minimapVisible;
      set({ minimapVisible: newValue });
      await useSettingsStore.getState().updateMinimapVisible(newValue);
    },

    minimapPosition: settings.ui.minimapPosition,
    setMinimapPosition: async (pos) => {
      set({ minimapPosition: pos, positionMenuOpen: false });
      await useSettingsStore.getState().updateMinimapPosition(pos);
    },

    // ... rest of store
  };
});
```

## Features Implemented

### Settings Dialog
- **General Tab**: Author name configuration
- **Backend Tab**: Backend URL, auto-start toggle, connection status
- **Appearance Tab**: Theme selection, snap to grid, minimap visibility/position

### About Dialog
- Application version
- Description
- Links to website, docs, GitHub
- Built with credits (frontend & backend libraries)
- License information
- Author attribution

### Persistence
- All settings stored in Electron Store (platform-native locations)
- Falls back to localStorage in browser mode
- Survives app restarts
- Migration from old localStorage theme preference

## Platform-Specific Storage Locations

Electron Store saves to:
- **Linux**: `~/.config/sigilweaver/sigilweaver-settings.json`
- **macOS**: `~/Library/Application Support/sigilweaver/sigilweaver-settings.json`
- **Windows**: `%APPDATA%\sigilweaver\sigilweaver-settings.json`

## Testing

1. Run development mode: `./scripts/dev.sh && npm run electron`
2. Open Settings dialog - change author name
3. Close app, reopen - author name persists
4. Change theme in Settings - persists across sessions
5. Toggle snap-to-grid - persists
6. Open About dialog - verify credits display

## Next Steps (Optional Enhancements)

1. Add backend health check indicator in Settings
2. Add keyboard shortcuts (Cmd/Ctrl+, for Settings)
3. Export/import settings functionality
4. Add more UI preferences (grid size, zoom limits, etc.)
5. Backend URL validation with connectivity test
6. Add "Check for Updates" in About dialog
7. Display actual backend version from API

## Notes

- The settings store uses async operations to ensure Electron IPC completes
- In browser mode (without Electron), falls back to localStorage
- Theme changes are immediately applied to the UI
- Author name is used when creating new workflows
- Backend URL changes require app restart to take effect
