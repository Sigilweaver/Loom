/**
 * Solarized Light Theme
 * Precision light theme
 * https://ethanschoonover.com/solarized/
 */

import { createTheme } from '../createTheme';
import { solarizedLightPalette } from '../palettes';

export const solarizedLightTheme = createTheme({
  id: 'solarized-light',
  name: 'Solarized Light',
  description: 'Precision light theme',
  palette: solarizedLightPalette,
  headerBackground: '#073642',
  accentEdge: '#2AA198',
  isDark: false,
});
