/**
 * Monokai Theme
 * The legendary Sublime Text theme
 * https://monokai.pro/
 */

import { createTheme } from '../createTheme';
import { monokaiPalette } from '../palettes';

export const monokaiTheme = createTheme({
  id: 'monokai',
  name: 'Monokai',
  description: 'The legendary Sublime Text theme',
  palette: monokaiPalette,
  headerBackground: '#272822',
  accentEdge: '#F92672',
  isDark: true,
});
