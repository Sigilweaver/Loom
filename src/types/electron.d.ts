declare global {
  interface Window {
    electronAPI?: {
      onMenuAction: (callback: (action: string, data?: any) => void) => void
      saveFile: (content: string, filename: string) => Promise<string | null>
      showSaveDialog: (defaultPath?: string) => Promise<string | null>
      showOpenDialog: (options?: any) => Promise<string | null>
    }
  }
}

export {}
