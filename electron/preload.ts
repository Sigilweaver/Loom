const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuAction: (callback: (action: string, data?: any) => void) => {
    ipcRenderer.on('menu-action', (_event: any, action: any, data: any) => callback(action, data))
  },
  saveFile: async (content: string, filename: string) => {
    return ipcRenderer.invoke('save-file', content, filename)
  },
  showSaveDialog: async (defaultPath?: string) => {
    return ipcRenderer.invoke('show-save-dialog', defaultPath)
  },
  showOpenDialog: async (options?: any) => {
    return ipcRenderer.invoke('show-open-dialog', options)
  }
})
