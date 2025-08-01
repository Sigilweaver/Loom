import { contextBridge, ipcRenderer } from 'electron'

declare global {
  interface Window {
    electronAPI: {
      onMenuAction: (callback: (action: string, data?: any) => void) => void
      saveFile: (content: string, filename: string) => Promise<string | null>
      showSaveDialog: (defaultPath?: string) => Promise<string | null>
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuAction: (callback: (action: string, data?: any) => void) => {
    ipcRenderer.on('menu-action', (_event, action, data) => callback(action, data))
  },
  saveFile: async (content: string, filename: string) => {
    return ipcRenderer.invoke('save-file', content, filename)
  },
  showSaveDialog: async (defaultPath?: string) => {
    return ipcRenderer.invoke('show-save-dialog', defaultPath)
  }
})
