/**
 * Tokyo Night Light Theme
 * Clean theme inspired by Tokyo city lights - light variant
 * https://github.com/enkia/tokyo-night-vscode-theme
 */

import { createTheme } from '../createTheme';
import { tokyoNightLightPalette } from '../palettes';

export const tokyoNightLightTheme = createTheme({
  id: 'tokyo-night-light',
  name: 'Tokyo Night Light',
  description: 'Tokyo city lights (light)',
  palette: tokyoNightLightPalette,
  headerBackground: '#343B58',
  accentEdge: '#34548A',
  isDark: false,
});
