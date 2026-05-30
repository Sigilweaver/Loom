/**
 * Light Theme (Core)
 * Clean and bright theme for daytime use
 */

import { createTheme } from '../createTheme';
import { lightPalette } from '../palettes';

export const lightTheme = createTheme({
  id: 'light',
  name: 'Light',
  description: 'Clean and bright theme for daytime use',
  palette: lightPalette,
  headerBackground: '#1e293b',  // slate-800 - professional dark header, no purple
  accentEdge: '#0284c7',        // sky-600 - punchy sky blue for light bg
  accentEdgeAnimated: '#0ea5e9', // sky-500
  isDark: false,
});
