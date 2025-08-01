import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isDev = process.env.IS_DEV === 'true' || process.env.NODE_ENV === 'development'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  console.log('isDev:', isDev, 'NODE_ENV:', process.env.NODE_ENV, 'IS_DEV:', process.env.IS_DEV)

  if (isDev) {
    console.log('Loading development URL: http://localhost:5173')
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools() // Disabled for cleaner experience
  } else {
    console.log('Loading production file:', join(__dirname, '../dist/index.html'))
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Create menu
  const template: any = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Workflow',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-action', 'new-workflow')
          }
        },
        {
          label: 'Open Workflow',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Workflow Files', extensions: ['xml'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            })
            if (!result.canceled) {
              mainWindow.webContents.send('menu-action', 'open-workflow', result.filePaths[0])
            }
          }
        },
        {
          label: 'Save Workflow',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-action', 'save-workflow')
          }
        },
        { type: 'separator' },
        {
          label: 'Export XML',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('menu-action', 'export-xml')
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Workflow',
      submenu: [
        {
          label: 'Run Workflow',
          accelerator: 'F5',
          click: () => {
            mainWindow.webContents.send('menu-action', 'run-workflow')
          }
        },
        {
          label: 'Validate Workflow',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow.webContents.send('menu-action', 'validate-workflow')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers
ipcMain.handle('save-file', async (event, content: string, filename: string) => {
  try {
    await writeFile(filename, content, 'utf8')
    return filename
  } catch (error) {
    console.error('Error saving file:', error)
    return null
  }
})

ipcMain.handle('show-save-dialog', async (event, defaultPath?: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [
      { name: 'XML Files', extensions: ['xml'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  
  return result.canceled ? null : result.filePath
})
