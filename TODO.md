# To Do List

## Before Launch

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
