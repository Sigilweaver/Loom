import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isDev = process.env.IS_DEV === 'true' || process.env.NODE_ENV === 'development'

// Read version from package.json
const packagePath = join(__dirname, '../package.json')
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
const version = packageJson.version

function createWindow(): void {
  const windowTitle = `Sigilweaver - Version ${version} - EARLY DEVELOPMENT BUILD`
  
  // Icon path - different for dev vs production
  const iconPath = isDev 
    ? join(__dirname, '../public/assets/icon-512.png')
    : join(__dirname, '../dist/assets/icon-512.png')
  
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: windowTitle,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../dist-electron/preload.js'),
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

  // Ensure title is set after page loads
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.setTitle(windowTitle)
  })

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
    },
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Show XML Viewer',
          accelerator: 'CmdOrCtrl+Alt+X',
          click: () => {
            console.log('Show XML Viewer menu clicked');
            mainWindow.webContents.send('menu-action', 'show-xml-viewer')
          }
        },
        {
          label: 'Hide XML Viewer',
          accelerator: 'CmdOrCtrl+Alt+H',
          click: () => {
            mainWindow.webContents.send('menu-action', 'hide-xml-viewer')
          }
        },
        { type: 'separator' },
        {
          label: 'Export Current XML',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            mainWindow.webContents.send('menu-action', 'export-current-xml')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  console.log('Menu created with Developer submenu');
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
ipcMain.handle('save-file', async (_event, content: string, filename: string) => {
  try {
    await writeFile(filename, content, 'utf8')
    return filename
  } catch (error) {
    console.error('Error saving file:', error)
    return null
  }
})

ipcMain.handle('show-save-dialog', async (_event, defaultPath?: string) => {
  const result = await dialog.showSaveDialog({
    // Cast because defaultPath may be undefined; omit if undefined
    ...(defaultPath ? { defaultPath } : {}),
    filters: [
      { name: 'XML Files', extensions: ['xml'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  
  return result.canceled ? null : result.filePath
})

ipcMain.handle('show-open-dialog', async (_event, options?: any) => {
  console.log('show-open-dialog called with options:', options);
  
  // Get the focused window to attach the dialog to
  const focusedWindow = BrowserWindow.getFocusedWindow();
  
  const dialogOptions = {
    properties: ['openFile'] as const,
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    ...options
  };
  
  const result = focusedWindow 
    ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  
  console.log('Dialog result:', result);
  console.log('FilePaths:', result.filePaths);
  console.log('Returning:', result.canceled ? null : result.filePaths[0]);
  
  return result.canceled ? null : result.filePaths[0];
})
