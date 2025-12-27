/**
 * Tokyo Night Theme
 * A clean VS Code theme inspired by Tokyo city lights
 * https://github.com/enkia/tokyo-night-vscode-theme
 */

import { createTheme } from '../createTheme';
import { tokyoNightPalette } from '../palettes';

export const tokyoNightTheme = createTheme({
  id: 'tokyo-night',
  name: 'Tokyo Night',
  description: 'Inspired by Tokyo city lights',
  palette: tokyoNightPalette,
  headerBackground: '#1A1B26',
  accentEdge: '#7AA2F7',
  isDark: true,
});
