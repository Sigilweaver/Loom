/**
 * Dracula Theme
 * A dark theme for all things
 * https://draculatheme.com/
 */

import { createTheme } from '../createTheme';
import { draculaPalette } from '../palettes';

export const draculaTheme = createTheme({
  id: 'dracula',
  name: 'Dracula',
  description: 'A dark theme for all things',
  palette: draculaPalette,
  headerBackground: '#282A36',
  accentEdge: '#BD93F9',
  isDark: true,
});
