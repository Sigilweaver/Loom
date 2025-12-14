const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuAction: (callback: (action: string, data?: any) => void) => {
    const handler = (_event: any, action: any, data: any) => callback(action, data);
    ipcRenderer.on('menu-action', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('menu-action', handler);
    };
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
  },
  getSettings: async () => {
    return ipcRenderer.invoke('get-settings')
  },
  setSettings: async (settings: any) => {
    return ipcRenderer.invoke('set-settings', settings)
  },
  getSessionToken: async () => {
    return ipcRenderer.invoke('get-session-token')
  },
  
  // Connection management APIs (credentials encrypted via safeStorage)
  isEncryptionAvailable: async () => {
    return ipcRenderer.invoke('connection:isEncryptionAvailable')
  },
  listConnections: async () => {
    return ipcRenderer.invoke('connection:list')
  },
  listConnectionsByType: async (type: string) => {
    return ipcRenderer.invoke('connection:listByType', type)
  },
  getConnection: async (id: string) => {
    return ipcRenderer.invoke('connection:get', id)
  },
  createConnection: async (input: any) => {
    return ipcRenderer.invoke('connection:create', input)
  },
  updateConnection: async (id: string, input: any) => {
    return ipcRenderer.invoke('connection:update', id, input)
  },
  deleteConnection: async (id: string) => {
    return ipcRenderer.invoke('connection:delete', id)
  },
  resolveConnection: async (id: string) => {
    return ipcRenderer.invoke('connection:resolve', id)
  },
  testConnection: async (id: string) => {
    return ipcRenderer.invoke('connection:test', id)
  },
})
