import { app, BrowserWindow, dialog, ipcMain, Menu, shell, safeStorage } from "electron";
import { spawn, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { userInfo } from "node:os";
import Store from "electron-store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDev =
  process.env.IS_DEV === "true" || process.env.NODE_ENV === "development";

// Settings store with base defaults
const DEFAULT_SETTINGS = {
  author: 'User',
  backend: { url: 'http://localhost:8000', autoStart: true },
  theme: { id: 'sigilweaver' },
  ui: { snapToGrid: true, minimapVisible: true, minimapPosition: 'bottom-right' as const },
};

// Get system username for default author (only used if no settings exist)
const getSystemUsername = (): string => {
  try {
    return userInfo().username || 'User';
  } catch {
    return 'User';
  }
};

const store = new Store({ defaults: { settings: DEFAULT_SETTINGS }, name: 'sigilweaver-settings' });

// =============================================================================
// CONNECTION STORE - Secure credential storage using safeStorage
// =============================================================================

interface StoredConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mssql';
  host: string;
  port: number;
  database: string;
  // Credentials stored as base64-encoded encrypted buffer
  encryptedCredentials: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionCredentials {
  username: string;
  password: string;
}

// Separate store for connections (encrypted credentials)
const connectionStore = new Store<{ connections: Record<string, StoredConnection> }>({
  defaults: { connections: {} },
  name: 'sigilweaver-connections',
});

/**
 * Encrypt credentials using Electron's safeStorage
 * Uses OS-level encryption (Keychain on macOS, DPAPI on Windows, Secret Service on Linux)
 */
function encryptCredentials(credentials: ConnectionCredentials): string {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[Connections] Encryption not available, using base64 encoding only');
    // Fallback: just base64 encode (not secure, but allows testing)
    return Buffer.from(JSON.stringify(credentials)).toString('base64');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
  return encrypted.toString('base64');
}

/**
 * Decrypt credentials using Electron's safeStorage
 */
function decryptCredentials(encryptedBase64: string): ConnectionCredentials {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: just base64 decode
    return JSON.parse(Buffer.from(encryptedBase64, 'base64').toString('utf8'));
  }
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const decrypted = safeStorage.decryptString(encrypted);
  return JSON.parse(decrypted);
}

/**
 * Convert stored connection to public info (without credentials)
 */
function toConnectionInfo(stored: StoredConnection) {
  return {
    id: stored.id,
    name: stored.name,
    type: stored.type,
    owner: 'client' as const,
    host: stored.host,
    port: stored.port,
    database: stored.database,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

// =============================================================================
// END CONNECTION STORE
// =============================================================================

// Backend process management
let backendProcess: ChildProcess | null = null;
const BACKEND_PORT = 8000;

// Ephemeral session token for backend authentication
// Generated fresh on each app launch, passed to backend via env var
let sessionToken: string | null = null;

// Read version from package.json
const packagePath = join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const version = packageJson.version;

/**
 * Get the path to the backend executable
 */
function getBackendPath(): { command: string; args: string[]; cwd?: string } {
  if (isDev) {
    // Development: run Python from virtual environment
    const backendDir = join(__dirname, "../../backend");
    const venvPython = process.platform === "win32"
      ? join(backendDir, ".venv", "Scripts", "python.exe")
      : join(backendDir, ".venv", "bin", "python");
    
    return {
      command: venvPython,
      args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
      cwd: backendDir,
    };
  }

  // Production: run bundled executable
  const ext = process.platform === "win32" ? ".exe" : "";
  const backendExe = join(process.resourcesPath, "backend", `backend${ext}`);
  
  return {
    command: backendExe,
    args: [],
  };
}

/**
 * Start the backend server (or verify it's already running in dev mode)
 */
async function startBackend(): Promise<void> {
  // In dev mode, check if backend is already running (started by dev.py)
  if (isDev) {
    try {
      const response = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/health/`);
      if (response.ok) {
        console.log("[Backend] Already running (started by dev.py)");
        return;
      }
    } catch {
      // Backend not running, continue to start it
    }
  }

  return new Promise((resolve, reject) => {
    const { command, args, cwd } = getBackendPath();
    
    // Generate ephemeral session token for this launch
    sessionToken = randomUUID();
    console.log("[Backend] Generated ephemeral session token");
    
    console.log(`[Backend] Starting: ${command} ${args.join(" ")}`);
    if (cwd) console.log(`[Backend] Working directory: ${cwd}`);

    backendProcess = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        POLARS_VERBOSE: "1",
        // In development: disable auth for easier debugging
        // In production: enable ephemeral auth mode with generated token
        AUTH_MODE: isDev ? "disabled" : "ephemeral",
        SESSION_TOKEN: sessionToken,
      },
    });

    backendProcess.stdout?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) console.log(`[Backend] ${message}`);
    });

    backendProcess.stderr?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      // Uvicorn logs INFO/DEBUG to stderr, only treat ERROR/CRITICAL as actual errors
      if (message) {
        if (message.includes("ERROR") || message.includes("CRITICAL") || message.includes("Traceback")) {
          console.error(`[Backend Error] ${message}`);
        } else {
          console.log(`[Backend] ${message}`);
        }
      }
    });

    backendProcess.on("error", (error: Error) => {
      console.error("[Backend] Failed to start:", error);
      reject(error);
    });

    backendProcess.on("exit", (code: number | null) => {
      console.log(`[Backend] Process exited with code ${code}`);
      backendProcess = null;
    });

    // Wait for backend to be ready (check health endpoint)
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds
    const checkInterval = setInterval(async () => {
      attempts++;
      try {
        const response = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/health/`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
        if (response.ok) {
          clearInterval(checkInterval);
          console.log("[Backend] Ready!");
          resolve();
        }
      } catch {
        // Backend not ready yet
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error("Backend failed to start within timeout"));
        }
      }
    }, 500);
  });
}

/**
 * Stop the backend server
 */
function stopBackend(): void {
  if (backendProcess) {
    console.log("[Backend] Stopping...");
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow(): void {
  const windowTitle = `Sigilweaver - Version ${version}`;

  // Icon path - different for dev vs production
  const iconPath = isDev
    ? join(__dirname, "../public/assets/icon-512.png")
    : join(__dirname, "../dist/assets/icon-512.png");

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: windowTitle,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, "../dist-electron/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  // Handle keyboard shortcuts for DevTools at the webContents level
  // This avoids globalShortcut which triggers KDE/Wayland portal dialogs
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const toggleDevTools = () => {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: 'bottom' });
        }
        event.preventDefault();
      };

      if (input.key === 'F12') {
        toggleDevTools();
      } else if (input.key === 'I' && input.control && input.shift) {
        toggleDevTools();
      }
    }
  });

  // Ensure title is set after page loads
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.setTitle(windowTitle);
  });

  // Open external links in default browser instead of Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow navigation within the app (dev server or local files)
    if (url.startsWith('http://localhost:5173') || url.startsWith('file://')) {
      return;
    }
    // Open external URLs in default browser
    event.preventDefault();
    shell.openExternal(url);
  });

  // Create menu
  const template: any = [
    {
      label: "File",
      submenu: [
        {
          label: "New Workflow",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow.webContents.send("menu-action", "new-workflow");
          },
        },
        {
          label: "Open Workflow",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openFile"],
              filters: [
                { name: "Workflow Files", extensions: ["swwf"] },
                { name: "All Files", extensions: ["*"] },
              ],
            });
            if (!result.canceled) {
              mainWindow.webContents.send(
                "menu-action",
                "open-workflow",
                result.filePaths[0]
              );
            }
          },
        },
        {
          label: "Save Workflow",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            mainWindow.webContents.send("menu-action", "save-workflow");
          },
        },
        { type: "separator" },
        { 
          role: "quit",
          accelerator: "CmdOrCtrl+Q"
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectall" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { 
          label: "Toggle Developer Tools",
          accelerator: "F12",
          click: () => {
            if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools();
            } else {
              mainWindow.webContents.openDevTools({ mode: 'bottom' });
            }
          },
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Workflow",
      submenu: [
        {
          label: "Run Workflow",
          accelerator: "F5",
          click: () => {
            mainWindow.webContents.send("menu-action", "run-workflow");
          },
        },
        {
          label: "Validate Workflow",
          accelerator: "CmdOrCtrl+T",
          click: () => {
            mainWindow.webContents.send("menu-action", "validate-workflow");
          },
        },
      ],
    },
    {
      label: "Developer",
      submenu: [
        {
          label: "Show Workflow Viewer",
          accelerator: "CmdOrCtrl+Alt+X",
          click: () => {
            mainWindow.webContents.send("menu-action", "show-workflow-viewer");
          },
        },
        {
          label: "Hide Workflow Viewer",
          accelerator: "CmdOrCtrl+Alt+H",
          click: () => {
            mainWindow.webContents.send("menu-action", "hide-workflow-viewer");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  try {
    // Start backend first
    console.log("[Main] Starting backend...");
    await startBackend();
    console.log("[Main] Backend started successfully");

    // Then create window
    createWindow();

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error("[Main] Failed to start application:", error);
    dialog.showErrorBox(
      "Startup Error",
      "Failed to start the backend server. Please check the logs and try again."
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});

// Settings IPC handlers
ipcMain.handle('get-settings', async () => {
  const settings = store.get('settings', DEFAULT_SETTINGS);
  
  // If author is still a default value, use OS username instead
  // This gives us the hierarchy: persisted custom value > OS username > 'User'
  if (settings.author === 'User' || settings.author === 'SigilWeaver User') {
    return { ...settings, author: getSystemUsername() };
  }
  
  return settings;
});

ipcMain.handle('set-settings', async (_event, settings) => {
  store.set('settings', settings);
});

// Session token IPC handler - provides ephemeral auth token to renderer
ipcMain.handle('get-session-token', async () => {
  return sessionToken;
});

// =============================================================================
// CONNECTION IPC HANDLERS - Secure credential management
// =============================================================================

// Check if encryption is available
ipcMain.handle('connection:isEncryptionAvailable', async () => {
  return safeStorage.isEncryptionAvailable();
});

// List all connections (without credentials)
ipcMain.handle('connection:list', async () => {
  const connections = connectionStore.get('connections', {});
  return Object.values(connections).map(toConnectionInfo);
});

// List connections by type
ipcMain.handle('connection:listByType', async (_event, type: string) => {
  const connections = connectionStore.get('connections', {});
  return Object.values(connections)
    .filter(c => c.type === type)
    .map(toConnectionInfo);
});

// Get a single connection by ID (without credentials)
ipcMain.handle('connection:get', async (_event, id: string) => {
  const connections = connectionStore.get('connections', {});
  const connection = connections[id];
  return connection ? toConnectionInfo(connection) : null;
});

// Create a new connection
ipcMain.handle('connection:create', async (_event, input: {
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mssql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}) => {
  const connections = connectionStore.get('connections', {});
  
  // Check for duplicate names
  const existingNames = Object.values(connections).map(c => c.name.toLowerCase());
  if (existingNames.includes(input.name.toLowerCase())) {
    throw new Error(`A connection named "${input.name}" already exists`);
  }
  
  const id = randomUUID();
  const now = new Date().toISOString();
  
  const stored: StoredConnection = {
    id,
    name: input.name,
    type: input.type,
    host: input.host,
    port: input.port,
    database: input.database,
    encryptedCredentials: encryptCredentials({
      username: input.username,
      password: input.password,
    }),
    createdAt: now,
    updatedAt: now,
  };
  
  connections[id] = stored;
  connectionStore.set('connections', connections);
  
  console.log(`[Connections] Created connection: ${input.name} (${id})`);
  return toConnectionInfo(stored);
});

// Update an existing connection
ipcMain.handle('connection:update', async (_event, id: string, input: {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}) => {
  const connections = connectionStore.get('connections', {});
  const existing = connections[id];
  
  if (!existing) {
    throw new Error(`Connection ${id} not found`);
  }
  
  // Check for duplicate names (excluding current connection)
  if (input.name) {
    const existingNames = Object.values(connections)
      .filter(c => c.id !== id)
      .map(c => c.name.toLowerCase());
    if (existingNames.includes(input.name.toLowerCase())) {
      throw new Error(`A connection named "${input.name}" already exists`);
    }
  }
  
  // Update non-credential fields
  if (input.name !== undefined) existing.name = input.name;
  if (input.host !== undefined) existing.host = input.host;
  if (input.port !== undefined) existing.port = input.port;
  if (input.database !== undefined) existing.database = input.database;
  
  // Update credentials if provided
  if (input.username !== undefined || input.password !== undefined) {
    const currentCreds = decryptCredentials(existing.encryptedCredentials);
    existing.encryptedCredentials = encryptCredentials({
      username: input.username ?? currentCreds.username,
      password: input.password ?? currentCreds.password,
    });
  }
  
  existing.updatedAt = new Date().toISOString();
  connections[id] = existing;
  connectionStore.set('connections', connections);
  
  console.log(`[Connections] Updated connection: ${existing.name} (${id})`);
  return toConnectionInfo(existing);
});

// Delete a connection
ipcMain.handle('connection:delete', async (_event, id: string) => {
  const connections = connectionStore.get('connections', {});
  const existing = connections[id];
  
  if (!existing) {
    throw new Error(`Connection ${id} not found`);
  }
  
  delete connections[id];
  connectionStore.set('connections', connections);
  
  console.log(`[Connections] Deleted connection: ${existing.name} (${id})`);
});

// Resolve connection with decrypted credentials (for backend requests)
ipcMain.handle('connection:resolve', async (_event, id: string) => {
  console.log(`[Connections] Resolving connection: ${id}`);
  const connections = connectionStore.get('connections', {});
  const connection = connections[id];
  
  if (!connection) {
    console.log(`[Connections] Connection not found: ${id}`);
    return null;
  }
  
  const credentials = decryptCredentials(connection.encryptedCredentials);
  console.log(`[Connections] Resolved connection: ${connection.name}`);
  
  return {
    ...toConnectionInfo(connection),
    username: credentials.username,
    password: credentials.password,
  };
});

// Test a connection
ipcMain.handle('connection:test', async (_event, id: string) => {
  const connections = connectionStore.get('connections', {});
  const connection = connections[id];
  
  if (!connection) {
    return { success: false, message: 'Connection not found' };
  }
  
  // For now, just return success - actual testing will be done via backend
  // In future, could use native Node.js pg/mysql drivers here
  return { 
    success: true, 
    message: 'Connection configured (test via backend pending)',
  };
});

// =============================================================================
// END CONNECTION IPC HANDLERS
// =============================================================================

// IPC handlers
ipcMain.handle(
  "save-file",
  async (_event, content: string, filename: string) => {
    try {
      await writeFile(filename, content, "utf8");
      return filename;
    } catch (error) {
      console.error("Error saving file:", error);
      return null;
    }
  }
);

ipcMain.handle("read-file", async (_event, filePath: string) => {
  try {
    const content = await readFile(filePath, "utf8");
    return content;
  } catch (error) {
    console.error("Error reading file:", error);
    throw error;
  }
});

ipcMain.handle("show-save-dialog", async (event, options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
  // Get the window that sent this IPC message
  const parentWindow = BrowserWindow.fromWebContents(event.sender);

  if (!parentWindow) {
    console.error("Could not determine parent window from IPC sender");
    return null;
  }

  if (parentWindow.isMinimized()) {
    parentWindow.restore();
  }
  
  // Simple approach: just ensure window is visible and focused
  parentWindow.show();
  parentWindow.focus();

  const result = await dialog.showSaveDialog(parentWindow, {
    ...(options?.defaultPath ? { defaultPath: options.defaultPath } : {}),
    filters: options?.filters || [
      { name: "Workflow Files", extensions: ["swwf"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  return result.canceled ? null : result.filePath;
});

ipcMain.handle("show-open-dialog", async (event, options?: any) => {
  // Get the window that sent this IPC message
  const parentWindow = BrowserWindow.fromWebContents(event.sender);

  if (!parentWindow) {
    console.error("Could not determine parent window from IPC sender");
    return null;
  }

  if (parentWindow.isMinimized()) {
    parentWindow.restore();
  }
  
  // Simple approach: just ensure window is visible and focused
  parentWindow.show();
  parentWindow.focus();

  const dialogOptions = {
    properties: ["openFile"] as const,
    filters: [
      { name: "CSV Files", extensions: ["csv"] },
      { name: "Text Files", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
    ...options,
  };

  const result = await dialog.showOpenDialog(parentWindow, dialogOptions);

  return result.canceled ? null : result.filePaths[0];
});
