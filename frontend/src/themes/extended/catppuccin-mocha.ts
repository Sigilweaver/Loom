/**
 * Catppuccin Mocha Theme
 * Soothing pastel theme for the high-spirited
 * https://github.com/catppuccin/catppuccin
 */

import { createTheme } from '../createTheme';
import { catppuccinMochaPalette } from '../palettes';

export const catppuccinMochaTheme = createTheme({
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  description: 'Soothing pastel theme',
  palette: catppuccinMochaPalette,
  headerBackground: '#1E1E2E',
  accentEdge: '#CBA6F7',
  isDark: true,
});
