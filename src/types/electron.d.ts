interface ElectronFileFilter {
  name: string;
  extensions: string[];
}

interface ElectronOpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: ElectronFileFilter[];
  properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[];
  message?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      onMenuAction: (callback: (action: string, data?: unknown) => void) => void
      saveFile: (content: string, filename: string) => Promise<string | null>
      showSaveDialog: (defaultPath?: string) => Promise<string | null>
      showOpenDialog: (options?: ElectronOpenDialogOptions) => Promise<string | null>
    }
  }
}

export {}
