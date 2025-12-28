/**
 * Catppuccin Latte Theme
 * Soothing pastel theme - light variant
 * https://github.com/catppuccin/catppuccin
 */

import { createTheme } from '../createTheme';
import { catppuccinLattePalette } from '../palettes';

export const catppuccinLatteTheme = createTheme({
  id: 'catppuccin-latte',
  name: 'Catppuccin Latte',
  description: 'Soothing pastel theme (light)',
  palette: catppuccinLattePalette,
  headerBackground: '#5C5F77',
  accentEdge: '#8839EF',
  isDark: false,
});
