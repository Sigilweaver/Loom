# To Do List

## Before Launch

### Pre-Release (Required for v1.0)

- **Backend URL Configuration**: Add settings panel for custom backend URL (both full and client modes)
  - Full mode: Option to override auto-started backend URL
  - Client mode: Required field for external backend connection
  - Health indicator showing backend connection status

- **Auto-Updates**: Implement electron-updater for automatic application updates
  - Requires update server configuration
  - Check for updates on launch
  - Download and install updates in background

- **Code Signing**: Obtain and configure code signing certificates
  - Windows: Authenticode certificate for .exe files (reduces SmartScreen warnings)
  - macOS: Apple Developer ID for app notarization (required for Gatekeeper)
  - Linux: No signing required, but consider AppImage signing

- **Snap Confinement Configuration**:
  - Full version (bundled backend): Use `classic` confinement for backend process spawning
  - Client version: Use `strict` confinement (sandboxed, no backend spawning needed)
  - Update snapcraft.yaml accordingly for each variant

## After Launch

### Likely easy but tricky?

- **Linux file dialog z-order issue**: File dialogs (Import/Export/CSV Browse) sometimes appear behind the main window on Linux. Root cause is Electron's GTK integration - `GtkFileChooserNative` casting errors suggest compatibility issues between Electron 28 and system GTK. Windows works perfectly using native dialogs.
  - Current workaround: Use `event.sender` to get parent window (eliminates race conditions)
  - Still problematic on some Linux window managers/compositors
  - Potential solutions:
    - Wait for Electron GTK fixes in future versions
    - Build custom HTML5-based file picker for Linux
    - Use different dialog library (e.g., node-file-dialog)
    - Document as known limitation for Linux users
