import { app, BrowserWindow, dialog, ipcMain, Menu, shell, safeStorage } from "electron";
import { spawn, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
  backend: { url: 'http://localhost:25811', autoStart: true },
  theme: { id: 'sigilweaver-signature' },
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

const store = new Store({ defaults: { settings: DEFAULT_SETTINGS }, name: 'application-settings' });

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
  name: 'connections',
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
const BACKEND_PORT = 25811;

// Ephemeral session token for backend authentication
// Generated fresh on each app launch, passed to backend via env var
let sessionToken: string | null = null;

// Read version from package.json
const packagePath = join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const version = packageJson.version;

/**
 * Get the path to the server executable
 */
function getBackendPath(): { command: string; args: string[]; cwd?: string } | null {
  if (isDev) {
    // Development: run Python from virtual environment
    const serverDir = join(__dirname, "../../server");
    const venvPython = process.platform === "win32"
      ? join(serverDir, ".venv", "Scripts", "python.exe")
      : join(serverDir, ".venv", "bin", "python");

    // Check if venv exists before trying to use it
    if (!existsSync(venvPython)) {
      console.log(`[Backend] Python venv not found at: ${venvPython}`);
      console.log("[Backend] Run 'cd server && uv sync' to set up the server");
      return null;
    }

    return {
      command: venvPython,
      args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
      cwd: serverDir,
    };
  }

  // Production: run bundled executable
  const ext = process.platform === "win32" ? ".exe" : "";
  const serverExe = join(process.resourcesPath, "server", `server${ext}`);

  // Check if server exists (Client build won't have it)
  if (!existsSync(serverExe)) {
    console.log(`[Backend] Server binary not found at: ${serverExe}`);
    return null; // Client build - no server bundled
  }
  console.log(`[Backend] Server binary found at: ${serverExe}`);

  return {
    command: serverExe,
    args: [],
    cwd: join(process.resourcesPath, "server"),
  };
}

/**
 * Start the backend server based on build type and configuration
 * 
 * Build types:
 * - Dev mode: NEVER spawn server, user must use ./scripts/dev.py --server
 * - Client build: NEVER spawn (server doesn't exist)
 * - Full build: Spawn based on autoStart setting
 */
async function startBackend(): Promise<void> {
  // DEV MODE: Never auto-spawn, user must start server manually
  if (isDev) {
    console.log("[Backend] Dev mode - start server manually or use: ./scripts/dev.py --server");
    return;
  }

  // PRODUCTION: Check if server is bundled (Full vs Client build)
  const backendPath = getBackendPath();
  if (!backendPath) {
    console.log("[Backend] Client build - no bundled server");
    console.log("[Backend] Connect to a remote server via Settings");
    return;
  }

  // FULL BUILD: Check autoStart setting
  const settings = store.get('settings') as typeof DEFAULT_SETTINGS;
  const autoStart = settings?.backend?.autoStart ?? true;

  if (!autoStart) {
    console.log("[Backend] autoStart disabled in settings");
    return;
  }

  // Start the bundled server
  const { command, args, cwd } = backendPath;

  // Generate ephemeral session token for this launch
  sessionToken = randomUUID();

  // Resolve a writable data directory for the server's working files.
  // The app resources directory may be read-only (AppImage, NSIS install),
  // so we use Electron's per-user data directory instead.
  const serverDataDir = join(app.getPath('userData'), 'server-data');

  console.log("[Backend] Starting bundled server (Full build)");
  console.log(`[Backend] Command: ${command}`);
  console.log(`[Backend] Working directory: ${cwd ?? "(inherited)"}`);
  console.log(`[Backend] Server data directory: ${serverDataDir}`);
  console.log("[Backend] Auth mode: ephemeral");

  return new Promise((resolve, reject) => {
    let settled = false;

    const proc = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        POLARS_VERBOSE: "1",
        // Production: enable ephemeral auth mode with generated token
        AUTH_MODE: "ephemeral",
        SESSION_TOKEN: sessionToken!,
        // Override server working paths to a writable location.
        // The server config reads these via pydantic-settings (case-insensitive env vars).
        ARCHIVE_PATH: join(serverDataDir, "archives"),
        AUDIT_PATH: join(serverDataDir, "audit"),
        CACHE_PATH: join(serverDataDir, "cache"),
        CONNECTION_STORE_PATH: join(serverDataDir, "connections.json"),
      },
    });
    backendProcess = proc;

    console.log(`[Backend] Spawned process (pid: ${proc.pid ?? "unknown"})`);

    proc.stdout?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) console.log(`[Backend stdout] ${message}`);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        if (message.includes("ERROR") || message.includes("CRITICAL") || message.includes("Traceback")) {
          console.error(`[Backend stderr] ${message}`);
        } else {
          console.log(`[Backend stderr] ${message}`);
        }
      }
    });

    proc.on("error", (error: Error) => {
      console.error("[Backend] Failed to spawn process:", error.message);
      if (!settled) {
        settled = true;
        clearInterval(checkInterval);
        reject(error);
      }
    });

    proc.on("exit", (code: number | null, signal: string | null) => {
      console.log(`[Backend] Process exited (code: ${code}, signal: ${signal})`);
      backendProcess = null;
      if (!settled) {
        settled = true;
        clearInterval(checkInterval);
        reject(new Error(
          `Backend process exited unexpectedly (code: ${code}, signal: ${signal})`
        ));
      }
    });

    // Poll health endpoint until the server is accepting requests
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds
    const checkInterval = setInterval(async () => {
      if (settled) {
        clearInterval(checkInterval);
        return;
      }
      attempts++;
      try {
        const response = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/health/`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
        if (response.ok) {
          if (!settled) {
            settled = true;
            clearInterval(checkInterval);
            console.log(`[Backend] Health check passed on attempt ${attempts}`);
            resolve();
          }
        } else {
          console.log(`[Backend] Health check attempt ${attempts}/${maxAttempts} returned ${response.status}`);
        }
      } catch {
        if (attempts >= maxAttempts && !settled) {
          settled = true;
          clearInterval(checkInterval);
          console.error(`[Backend] Health check failed after ${maxAttempts} attempts (${maxAttempts * 0.5}s)`);
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
    console.log(`[Backend] Stopping server (pid: ${backendProcess.pid ?? "unknown"})...`);
    backendProcess.kill();
    backendProcess = null;
    console.log("[Backend] Stop signal sent");
  } else {
    console.log("[Backend] No backend process to stop");
  }
}

function createWindow(): void {
  const windowTitle = `Sigilweaver Loom - Version ${version}`;

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
    mainWindow.loadURL("http://localhost:25810");
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
    if (url.startsWith('http://localhost:25810') || url.startsWith('file://')) {
      return;
    }
    // Open external URLs in default browser
    event.preventDefault();
    shell.openExternal(url);
  });

  // Remove system menu bar
  Menu.setApplicationMenu(null);
}

app.whenReady().then(async () => {
  console.log(`[Main] Sigilweaver Loom v${version} starting (platform: ${process.platform}, arch: ${process.arch})`);
  console.log(`[Main] App path: ${app.getAppPath()}`);
  console.log(`[Main] Resources path: ${process.resourcesPath}`);
  console.log(`[Main] User data: ${app.getPath('userData')}`);
  console.log(`[Main] Dev mode: ${isDev}`);

  try {
    // Start backend first
    await startBackend();

    // Then create window
    createWindow();

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Main] Failed to start application:", message);
    dialog.showErrorBox(
      "Startup Error",
      `Failed to start the backend server.\n\n${message}\n\nCheck the logs at: ${app.getPath('userData')}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  console.log("[Main] All windows closed");
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  console.log("[Main] Application quitting");
  stopBackend();
});

// Settings IPC handlers
ipcMain.handle('get-settings', async () => {
  const settings = store.get('settings', DEFAULT_SETTINGS);

  // If author is still a default value, use OS username instead
  // This gives us the hierarchy: persisted custom value > OS username > 'User'
  if (settings.author === 'User' || settings.author === 'Sigilweaver Loom User') {
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
