/**
 * Dark Theme (Core)
 * Easy on the eyes for nighttime weaving
 */

import { createTheme } from '../createTheme';
import { darkPalette } from '../palettes';
import { HEADER_BACKGROUND, BRAND_EDGE, BRAND_EDGE_ANIMATED } from '../tokens/constants';

export const darkTheme = createTheme({
  id: 'dark',
  name: 'Dark',
  description: 'Easy on the eyes for nighttime weaving',
  palette: darkPalette,
  headerBackground: HEADER_BACKGROUND,
  accentEdge: BRAND_EDGE,
  accentEdgeAnimated: BRAND_EDGE_ANIMATED,
  isDark: true,
});
