/**
 * Gruvbox Dark Theme
 * Retro groove color scheme for Vim
 * https://github.com/morhetz/gruvbox
 */

import { createTheme } from '../createTheme';
import { gruvboxDarkPalette } from '../palettes';

export const gruvboxDarkTheme = createTheme({
  id: 'gruvbox-dark',
  name: 'Gruvbox Dark',
  description: 'Retro groove dark theme',
  palette: gruvboxDarkPalette,
  headerBackground: '#1D2021',
  accentEdge: '#8EC07C',
  isDark: true,
});
