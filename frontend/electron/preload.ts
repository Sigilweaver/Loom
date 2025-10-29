const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuAction: (callback: (action: string, data?: any) => void) => {
    ipcRenderer.on('menu-action', (_event: any, action: any, data: any) => callback(action, data))
  },
  saveFile: async (content: string, filename: string) => {
    return ipcRenderer.invoke('save-file', content, filename)
  },
  readFile: async (filePath: string) => {
    return ipcRenderer.invoke('read-file', filePath)
  },
  showSaveDialog: async (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
    return ipcRenderer.invoke('show-save-dialog', options)
  },
  showOpenDialog: async (options?: any) => {
    return ipcRenderer.invoke('show-open-dialog', options)
  }
})
