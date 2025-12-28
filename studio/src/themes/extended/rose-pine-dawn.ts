/**
 * Rose Pine Dawn Theme
 * All natural pine, faux fur and a bit of soho vibes - light variant
 * https://rosepinetheme.com/
 */

import { createTheme } from '../createTheme';
import { rosePineDawnPalette } from '../palettes';

export const rosePineDawnTheme = createTheme({
  id: 'rose-pine-dawn',
  name: 'Rose Pine Dawn',
  description: 'Natural pine and soho vibes (light)',
  palette: rosePineDawnPalette,
  headerBackground: '#575279',
  accentEdge: '#907AA9',
  isDark: false,
});
