/**
 * Rose Pine Theme
 * All natural pine, faux fur and a bit of soho vibes
 * https://rosepinetheme.com/
 */

import { createTheme } from '../createTheme';
import { rosePinePalette } from '../palettes';

export const rosePineTheme = createTheme({
  id: 'rose-pine',
  name: 'Rose Pine',
  description: 'Natural pine with soho vibes',
  palette: rosePinePalette,
  headerBackground: '#191724',
  accentEdge: '#EBBCBA',
  isDark: true,
});
