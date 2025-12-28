/**
 * One Dark Theme
 * Atom's iconic dark theme
 * https://github.com/atom/one-dark-syntax
 */

import { createTheme } from '../createTheme';
import { oneDarkPalette } from '../palettes';

export const oneDarkTheme = createTheme({
  id: 'one-dark',
  name: 'One Dark',
  description: "Atom's iconic dark theme",
  palette: oneDarkPalette,
  headerBackground: '#21252B',
  accentEdge: '#61AFEF',
  isDark: true,
});
