/**
 * Cobalt2 Theme
 * Official theme by Wes Bos
 * https://github.com/wesbos/cobalt2-vscode
 */

import { createTheme } from '../createTheme';
import { cobalt2Palette } from '../palettes';

export const cobalt2Theme = createTheme({
  id: 'cobalt2',
  name: 'Cobalt2',
  description: 'The Wes Bos classic',
  palette: cobalt2Palette,
  headerBackground: '#193549',
  accentEdge: '#FFC600',
  isDark: true,
});
