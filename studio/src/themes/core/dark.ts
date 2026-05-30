/**
 * Dark Theme (Core)
 * Easy on the eyes for nighttime weaving
 */

import { createTheme } from '../createTheme';
import { darkPalette } from '../palettes';

export const darkTheme = createTheme({
  id: 'dark',
  name: 'Dark',
  description: 'Easy on the eyes for nighttime weaving',
  palette: darkPalette,
  headerBackground: '#1f2937',  // gray-800 - clean charcoal, no purple
  accentEdge: '#38bdf8',        // sky-400 - matches the sky-blue brand.primary
  accentEdgeAnimated: '#7dd3fc', // sky-300
  isDark: true,
});
