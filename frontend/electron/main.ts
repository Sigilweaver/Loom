import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { spawn, ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDev =
  process.env.IS_DEV === "true" || process.env.NODE_ENV === "development";

// Backend process management
let backendProcess: ChildProcess | null = null;
const BACKEND_PORT = 8000;

// Read version from package.json
const packagePath = join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const version = packageJson.version;

/**
 * Get the path to the backend executable
 */
function getBackendPath(): { command: string; args: string[]; cwd?: string } {
  if (isDev) {
    // Development: run Python directly with uvicorn
    return {
      command: "python",
      args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
      cwd: join(__dirname, "../../backend"),
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
 * Start the backend server
 */
async function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const { command, args, cwd } = getBackendPath();
    
    console.log(`[Backend] Starting: ${command} ${args.join(" ")}`);
    if (cwd) console.log(`[Backend] Working directory: ${cwd}`);

    backendProcess = spawn(command, args, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    backendProcess.stdout?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) console.log(`[Backend] ${message}`);
    });

    backendProcess.stderr?.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) console.error(`[Backend Error] ${message}`);
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
        const response = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/health/`);
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

  console.log(
    "isDev:",
    isDev,
    "NODE_ENV:",
    process.env.NODE_ENV,
    "IS_DEV:",
    process.env.IS_DEV
  );

  if (isDev) {
    console.log("Loading development URL: http://localhost:5173");
    mainWindow.loadURL("http://localhost:5173");
    // mainWindow.webContents.openDevTools() // Disabled for cleaner experience
  } else {
    console.log(
      "Loading production file:",
      join(__dirname, "../dist/index.html")
    );
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  // Ensure title is set after page loads
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.setTitle(windowTitle);
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
        { role: "quit" },
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
        { role: "toggleDevTools" },
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
            console.log("Show Workflow Viewer menu clicked");
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
  console.log("Menu created with Developer submenu");
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
  console.log("show-open-dialog called with options:", options);

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

  console.log("Dialog result:", result);
  console.log("FilePaths:", result.filePaths);
  console.log("Returning:", result.canceled ? null : result.filePaths[0]);

  return result.canceled ? null : result.filePaths[0];
});
