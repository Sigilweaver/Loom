/**
 * Gruvbox Light Theme
 * Retro groove light variant
 * https://github.com/morhetz/gruvbox
 */

import { createTheme } from '../createTheme';
import { gruvboxLightPalette } from '../palettes';

export const gruvboxLightTheme = createTheme({
  id: 'gruvbox-light',
  name: 'Gruvbox Light',
  description: 'Retro groove light theme',
  palette: gruvboxLightPalette,
  headerBackground: '#3C3836',
  accentEdge: '#689D6A',
  isDark: false,
});
