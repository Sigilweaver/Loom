/**
 * Night Owl Theme
 * A VS Code theme for the night owls out there
 * https://github.com/sdras/night-owl-vscode-theme
 */

import { createTheme } from '../createTheme';
import { nightOwlPalette } from '../palettes';

export const nightOwlTheme = createTheme({
  id: 'night-owl',
  name: 'Night Owl',
  description: 'For the night owls out there',
  palette: nightOwlPalette,
  headerBackground: '#011627',
  accentEdge: '#7FDBCA',
  isDark: true,
});
