/**
 * Solarized Dark Theme
 * Precision colors for machines and people
 * https://ethanschoonover.com/solarized/
 */

import { createTheme } from '../createTheme';
import { solarizedDarkPalette } from '../palettes';

export const solarizedDarkTheme = createTheme({
  id: 'solarized-dark',
  name: 'Solarized Dark',
  description: 'Precision dark theme',
  palette: solarizedDarkPalette,
  headerBackground: '#002B36',
  accentEdge: '#2AA198',
  isDark: true,
});
