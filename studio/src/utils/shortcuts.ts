/**
 * Keyboard shortcut reference.
 *
 * The handlers live next to the features they drive (App.tsx for workflow and
 * tab commands, useCanvasKeyboard for the canvas, DataTable for the grid).
 * This list is what the help dialog and tooltips show, so keep it in sync
 * when a binding changes.
 */

export interface ShortcutEntry {
  /** Keys pressed together; "Mod" is Ctrl, or Cmd on macOS. */
  keys: string[];
  description: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** Display label for one key, with "Mod" resolved for the current platform. */
export function keyLabel(key: string, mac: boolean = isMacPlatform()): string {
  if (key === 'Mod') return mac ? 'Cmd' : 'Ctrl';
  if (key === 'Alt') return mac ? 'Option' : 'Alt';
  return key;
}

/** "Ctrl+Shift+S" style label for tooltips. */
export function formatShortcut(keys: string[], mac: boolean = isMacPlatform()): string {
  return keys.map((k) => keyLabel(k, mac)).join('+');
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Workflow',
    shortcuts: [
      { keys: ['Mod', 'O'], description: 'Open a workflow' },
      { keys: ['Mod', 'S'], description: 'Save' },
      { keys: ['Mod', 'Shift', 'S'], description: 'Save as' },
      { keys: ['Mod', 'P'], description: 'Preview all tools' },
      { keys: ['F5'], description: 'Run the workflow' },
      { keys: ['Mod', 'Alt', 'X'], description: 'Show or hide the workflow code' },
      { keys: ['Mod', 'Z'], description: 'Undo' },
      { keys: ['Mod', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Mod', 'Y'], description: 'Redo (alternative)' },
      { keys: ['?'], description: 'Show this list' },
    ],
  },
  {
    title: 'Tabs',
    shortcuts: [
      { keys: ['Mod', 'T'], description: 'New tab (desktop app)' },
      { keys: ['Mod', 'W'], description: 'Close tab (desktop app)' },
      { keys: ['Mod', 'Tab'], description: 'Next tab (Shift for previous)' },
      { keys: ['Left/Right'], description: 'Move between tabs when the tab bar has focus' },
    ],
  },
  {
    title: 'Canvas',
    shortcuts: [
      { keys: ['Enter'], description: 'Add the focused palette tool to the canvas' },
      { keys: ['Mod', 'C'], description: 'Copy selected tools' },
      { keys: ['Mod', 'X'], description: 'Cut selected tools' },
      { keys: ['Mod', 'V'], description: 'Paste' },
      { keys: ['Mod', 'A'], description: 'Select all tools' },
      { keys: ['Delete'], description: 'Delete the selection (also Backspace)' },
      { keys: ['Arrows'], description: 'Nudge the selection (Shift for larger steps)' },
      { keys: ['Esc'], description: 'Clear the selection' },
      { keys: ['Mod', 'Scroll'], description: 'Zoom' },
    ],
  },
  {
    title: 'Data preview',
    shortcuts: [
      { keys: ['Arrows'], description: 'Move the selected cell (Shift extends)' },
      { keys: ['Mod', 'A'], description: 'Select all cells' },
      { keys: ['Mod', 'C'], description: 'Copy the selection with headers' },
      { keys: ['Mod', 'Shift', 'C'], description: 'Copy the selection without headers' },
      { keys: ['Esc'], description: 'Clear the selection' },
    ],
  },
];
