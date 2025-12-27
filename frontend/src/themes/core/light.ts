/**
 * Light Theme (Core)
 * Clean and bright theme for daytime use
 */

import { createTheme } from '../createTheme';
import { lightPalette } from '../palettes';
import { HEADER_BACKGROUND, BRAND_EDGE, BRAND_EDGE_ANIMATED } from '../tokens/constants';

export const lightTheme = createTheme({
  id: 'light',
  name: 'Light',
  description: 'Clean and bright theme for daytime use',
  palette: lightPalette,
  headerBackground: HEADER_BACKGROUND,
  accentEdge: BRAND_EDGE,
  accentEdgeAnimated: BRAND_EDGE_ANIMATED,
  isDark: false,
});
