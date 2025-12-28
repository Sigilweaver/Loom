/**
 * Nord Light Theme
 * Arctic, north-bluish color palette - light variant
 * https://www.nordtheme.com/
 */

import { createTheme } from '../createTheme';
import { nordLightPalette } from '../palettes';

export const nordLightTheme = createTheme({
  id: 'nord-light',
  name: 'Nord Light',
  description: 'Arctic, north-bluish palette (light)',
  palette: nordLightPalette,
  headerBackground: '#3B4252',
  accentEdge: '#5E81AC',
  isDark: false,
});
