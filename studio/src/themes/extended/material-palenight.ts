/**
 * Material Palenight Theme
 * Material Theme's popular variant
 * https://material-theme.com/
 */

import { createTheme } from '../createTheme';
import { materialPalenightPalette } from '../palettes';

export const materialPalenightTheme = createTheme({
  id: 'material-palenight',
  name: 'Material Palenight',
  description: "Material Theme's popular variant",
  palette: materialPalenightPalette,
  headerBackground: '#292D3E',
  accentEdge: '#82AAFF',
  isDark: true,
});
