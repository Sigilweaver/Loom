const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
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
  // Legacy plaintext resolution; refused by the main process while the
  // bundled server runs (see connectionProxyAvailable / backendRequest).
  resolveConnection: async (id: string) => {
    return ipcRenderer.invoke('connection:resolve', id)
  },
  // True when the main process can inject credentials into requests to the
  // bundled server, so the renderer never handles plaintext.
  connectionProxyAvailable: async () => {
    return ipcRenderer.invoke('connection:proxyAvailable')
  },
  // Forward a request carrying loom-connection:// references to the bundled
  // server. The main process substitutes credentials and redacts responses.
  backendRequest: async (request: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
  }) => {
    return ipcRenderer.invoke('backend:request', request)
  },
  testConnection: async (id: string) => {
    return ipcRenderer.invoke('connection:test', id)
  },
})
