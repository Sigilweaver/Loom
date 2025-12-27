/**
 * Ayu Mirage Theme
 * Ayu's popular dark variant with warm accents
 * https://github.com/dempfi/ayu
 */

import { createTheme } from '../createTheme';
import { ayuMiragePalette } from '../palettes';

export const ayuMirageTheme = createTheme({
  id: 'ayu-mirage',
  name: 'Ayu Mirage',
  description: 'Warm accents on cool dark',
  palette: ayuMiragePalette,
  headerBackground: '#1F2430',
  accentEdge: '#FFAD66',
  isDark: true,
});
