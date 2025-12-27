/**
 * One Light Theme
 * Atom's iconic light theme
 * https://github.com/atom/one-light-syntax
 */

import { createTheme } from '../createTheme';
import { oneLightPalette } from '../palettes';

export const oneLightTheme = createTheme({
  id: 'one-light',
  name: 'One Light',
  description: 'Atom iconic light theme',
  palette: oneLightPalette,
  headerBackground: '#383A42',
  accentEdge: '#4078F2',
  isDark: false,
});
