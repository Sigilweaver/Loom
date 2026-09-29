import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
  safeStorage,
  type IpcMainInvokeEvent,
} from "electron";
import { spawn, ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { userInfo } from "node:os";
import Store from "electron-store";
import {
  BACKEND_PORT,
  hasConnectionRefs,
  proxyBackendRequest,
  type ProxyRequest,
} from "./backendProxy";
import { FileGrants, readGrantedFile, writeGrantedFile } from "./fileAccess";
import { isAppUrl, isSafeExternalUrl, PRODUCTION_CSP } from "./security";
import {
  buildConnectionUri,
  secretsFor,
  type ResolvedRef,
} from "../src/platform/connectionUri";

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
 * Whether the OS can protect credentials at rest. On Linux, Electron falls
 * back to a hard-coded key ("basic_text") when no keyring is available, which
 * offers no real protection, so that case is treated as unavailable.
 */
function isEncryptionUsable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  if (
    process.platform === 'linux' &&
    typeof safeStorage.getSelectedStorageBackend === 'function' &&
    safeStorage.getSelectedStorageBackend() === 'basic_text'
  ) {
    return false;
  }
  return true;
}

/**
 * Encrypt credentials using Electron's safeStorage
 * Uses OS-level encryption (Keychain on macOS, DPAPI on Windows, Secret Service on Linux)
 */
function encryptCredentials(credentials: ConnectionCredentials): string {
  if (!isEncryptionUsable()) {
    // Never store recoverable plaintext.
    throw new Error(
      'Secure credential storage is not available on this system (no OS keychain or keyring found)'
    );
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
  return encrypted.toString('base64');
}

/**
 * Decrypt credentials using Electron's safeStorage. Entries written by older
 * versions on systems without any encryption were plain base64 and are still
 * readable so users can re-enter them; nothing new is written that way.
 */
function decryptCredentials(encryptedBase64: string): ConnectionCredentials {
  if (!safeStorage.isEncryptionAvailable()) {
    return JSON.parse(Buffer.from(encryptedBase64, 'base64').toString('utf8'));
  }
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const decrypted = safeStorage.decryptString(encrypted);
  return JSON.parse(decrypted);
}

/**
 * Look up a connection by id. Ids arrive from the renderer, so only own
 * properties count ("__proto__" and friends must not resolve to anything).
 */
function lookupConnection(
  connections: Record<string, StoredConnection>,
  id: unknown
): StoredConnection | undefined {
  if (typeof id !== 'string') return undefined;
  return Object.prototype.hasOwnProperty.call(connections, id) ? connections[id] : undefined;
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
// True only while a server this shell launched is running. Gates the
// credential proxy and the legacy plaintext resolve (see connection IPC).
let backendOwned = false;

// Ephemeral session token for backend authentication
// Generated fresh on each app launch, passed to backend via env var
let sessionToken: string | null = null;

// Read version from package.json
const packagePath = join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const version = packageJson.version;

// What counts as "the app" for navigation and IPC sender checks.
const appUrlPolicy = { isDev, distDir: join(__dirname, "../dist") };

// Paths the user picked in native dialogs this session (see fileAccess.ts).
const fileGrants = new FileGrants();

/** Hand a link to the OS browser, but only if it is a plain web/mail link. */
function openExternalSafely(url: string): void {
  if (!isSafeExternalUrl(url)) {
    console.warn(`[Security] Blocked external URL with disallowed scheme`);
    return;
  }
  void shell.openExternal(url);
}

/**
 * Reject IPC from anything but the app's own top-level frame. Defence in
 * depth: navigation is already restricted, but privileged handlers must not
 * trust a sender just because it reached the channel.
 */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame || !isAppUrl(frame.url, appUrlPolicy)) {
    throw new Error("Untrusted IPC sender");
  }
}

/** ipcMain.handle with the sender check applied to every channel. */
function handle<Args extends unknown[], Result>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => Result | Promise<Result>
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event);
    return listener(event, ...(args as Args));
  });
}

/** Deny every renderer permission request except clipboard writes. */
function hardenSession(): void {
  const ses = session.defaultSession;
  const allowed = new Set(["clipboard-sanitized-write"]);
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allowed.has(permission));
  });
  ses.setPermissionCheckHandler((_webContents, permission) => allowed.has(permission));

  if (!isDev) {
    ses.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [PRODUCTION_CSP],
        },
      });
    });
  }
}

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
      backendOwned = false;
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
            backendOwned = true;
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
    backendOwned = false;
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
      preload: join(__dirname, "../dist-electron/preload.cjs"),
      // Least privilege for the renderer: no Node, isolated world, OS sandbox.
      // The preload only needs contextBridge and ipcRenderer, which are
      // available to sandboxed preloads.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
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

  // Never open new Electron windows. Web links go to the default browser;
  // anything else (file:, custom protocol handlers) is dropped.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  // The window may only ever show the app itself.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, appUrlPolicy)) {
      return;
    }
    event.preventDefault();
    openExternalSafely(url);
  });

  // Embedding <webview> or attaching foreign content is never needed.
  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
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
    hardenSession();

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
handle('get-settings', async () => {
  const settings = store.get('settings', DEFAULT_SETTINGS);

  // If author is still a default value, use OS username instead
  // This gives us the hierarchy: persisted custom value > OS username > 'User'
  if (settings.author === 'User' || settings.author === 'Sigilweaver Loom User') {
    return { ...settings, author: getSystemUsername() };
  }

  return settings;
});

handle('set-settings', async (_event, settings: unknown) => {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new Error('Settings must be an object');
  }
  store.set('settings', settings);
});

// Session token IPC handler - provides ephemeral auth token to renderer
handle('get-session-token', async () => {
  return sessionToken;
});

// =============================================================================
// CONNECTION IPC HANDLERS - Secure credential management
// =============================================================================

// Check if encryption is available
handle('connection:isEncryptionAvailable', async () => {
  return isEncryptionUsable();
});

// List all connections (without credentials)
handle('connection:list', async () => {
  const connections = connectionStore.get('connections', {});
  return Object.values(connections).map(toConnectionInfo);
});

// Get a single connection by ID (without credentials)
handle('connection:get', async (_event, id: string) => {
  const connections = connectionStore.get('connections', {});
  const connection = lookupConnection(connections, id);
  return connection ? toConnectionInfo(connection) : null;
});

// Create a new connection
handle('connection:create', async (_event, input: {
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
handle('connection:update', async (_event, id: string, input: {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}) => {
  const connections = connectionStore.get('connections', {});
  const existing = lookupConnection(connections, id);

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
handle('connection:delete', async (_event, id: string) => {
  const connections = connectionStore.get('connections', {});
  const existing = lookupConnection(connections, id);

  if (!existing) {
    throw new Error(`Connection ${id} not found`);
  }

  delete connections[id];
  connectionStore.set('connections', connections);

  console.log(`[Connections] Deleted connection: ${existing.name} (${id})`);
});

/**
 * Resolve a stored connection to its URI (with credentials) plus the secrets
 * to scrub from responses. Main-process only: this never crosses IPC.
 */
function resolveConnectionRef(id: string): ResolvedRef | null {
  const stored = lookupConnection(connectionStore.get('connections', {}), id);
  if (!stored) return null;
  const credentials = decryptCredentials(stored.encryptedCredentials);
  const resolved = {
    type: stored.type,
    host: stored.host,
    port: stored.port,
    database: stored.database,
    username: credentials.username,
    password: credentials.password,
  };
  return { uri: buildConnectionUri(resolved), secrets: secretsFor(resolved) };
}

// Whether requests carrying connection references can be proxied by this
// process. True only while the bundled server (launched by this process) is
// running; the renderer then never needs plaintext credentials.
handle('connection:proxyAvailable', async () => {
  return backendOwned && sessionToken !== null;
});

// Forward a request to the bundled server, swapping connection references for
// real connection URIs and redacting credentials from the response.
handle('backend:request', async (_event, request: ProxyRequest) => {
  if (!backendOwned || !sessionToken) {
    throw new Error('Connection proxy is not available: the bundled server is not running');
  }
  if (!hasConnectionRefs(request?.body)) {
    // Nothing to inject; the renderer should have used plain fetch.
    throw new Error('Request carries no connection references');
  }
  return proxyBackendRequest(request, {
    token: sessionToken,
    resolve: resolveConnectionRef,
  });
});

// Legacy: resolve a connection to plaintext credentials for the renderer.
// Only permitted when this process does not own the server (Client build,
// dev, or a remote server), because then the renderer must build the request
// itself. With a bundled server the proxy above is used and this is refused.
handle('connection:resolve', async (_event, id: string) => {
  if (backendOwned) {
    throw new Error(
      'Credentials are not available to the renderer while the bundled server is running'
    );
  }
  const connection = lookupConnection(connectionStore.get('connections', {}), id);
  if (!connection) {
    return null;
  }

  const credentials = decryptCredentials(connection.encryptedCredentials);
  return {
    ...toConnectionInfo(connection),
    username: credentials.username,
    password: credentials.password,
  };
});

// Test a connection
handle('connection:test', async (_event, id: string) => {
  const connections = connectionStore.get('connections', {});
  const connection = lookupConnection(connections, id);

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

// =============================================================================
// FILE IPC HANDLERS
//
// The renderer can only read or write paths the user chose in a native dialog
// during this session (see fileAccess.ts). Dialogs are the only way to obtain
// such a path; there is no channel that accepts an arbitrary path directly.
// =============================================================================

interface FileFilterInput {
  name: string;
  extensions: string[];
}

interface DialogInput {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  message?: string;
  filters?: FileFilterInput[];
}

/** Keep only well-formed filters from renderer input. */
function sanitizeFilters(filters: unknown): FileFilterInput[] | undefined {
  if (!Array.isArray(filters)) return undefined;
  const clean = filters.filter(
    (f): f is FileFilterInput =>
      typeof f?.name === "string" &&
      Array.isArray(f.extensions) &&
      f.extensions.every((e: unknown) => typeof e === "string")
  );
  return clean.length > 0 ? clean : undefined;
}

/** Copy only the dialog fields we support; never spread renderer input. */
function pickDialogOptions(options: DialogInput | undefined) {
  const picked: Electron.SaveDialogOptions & Electron.OpenDialogOptions = {};
  if (typeof options?.title === "string") picked.title = options.title;
  if (typeof options?.defaultPath === "string") picked.defaultPath = options.defaultPath;
  if (typeof options?.buttonLabel === "string") picked.buttonLabel = options.buttonLabel;
  if (typeof options?.message === "string") picked.message = options.message;
  return { picked, filters: sanitizeFilters(options?.filters) };
}

/** Restore and focus the window that asked for a dialog. */
function focusSenderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  if (!parentWindow) {
    throw new Error("Could not determine parent window from IPC sender");
  }
  if (parentWindow.isMinimized()) {
    parentWindow.restore();
  }
  parentWindow.show();
  parentWindow.focus();
  return parentWindow;
}

handle("save-file", async (_event, content: string, filename: string) => {
  // Errors propagate to the renderer so a failed save is never reported as
  // success.
  return writeGrantedFile(fileGrants, filename, content);
});

handle("read-file", async (_event, filePath: string) => {
  return readGrantedFile(fileGrants, filePath);
});

handle("show-save-dialog", async (event, options?: DialogInput) => {
  const parentWindow = focusSenderWindow(event);
  const { picked, filters } = pickDialogOptions(options);

  const result = await dialog.showSaveDialog(parentWindow, {
    ...picked,
    filters: filters ?? [
      { name: "Workflow Files", extensions: ["swwf"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) return null;
  await fileGrants.grant(result.filePath);
  return result.filePath;
});

handle("show-open-dialog", async (event, options?: DialogInput) => {
  const parentWindow = focusSenderWindow(event);
  const { picked, filters } = pickDialogOptions(options);

  const result = await dialog.showOpenDialog(parentWindow, {
    ...picked,
    properties: ["openFile"],
    filters: filters ?? [
      { name: "CSV Files", extensions: ["csv"] },
      { name: "Text Files", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  const chosen = result.canceled ? undefined : result.filePaths[0];
  if (!chosen) return null;
  await fileGrants.grant(chosen);
  return chosen;
});
