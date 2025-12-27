/**
 * Nord Theme
 * Arctic, north-bluish color palette designed by Arctic Ice Studio
 * https://www.nordtheme.com/
 */

import { createTheme } from '../createTheme';
import { nordPalette } from '../palettes';

export const nordTheme = createTheme({
  id: 'nord',
  name: 'Nord',
  description: 'Arctic, north-bluish palette',
  palette: nordPalette,
  headerBackground: '#2E3440',
  accentEdge: '#88C0D0',
  isDark: true,
});
