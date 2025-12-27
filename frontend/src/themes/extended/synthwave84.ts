/**
 * SynthWave '84 Theme
 * A nostalgic 80s theme with neon vibes
 * https://github.com/robb0wen/synthwave-vscode
 */

import { createTheme } from '../createTheme';
import { synthwave84Palette } from '../palettes';

export const synthwave84Theme = createTheme({
  id: 'synthwave84',
  name: "SynthWave '84",
  description: 'Nostalgic 80s neon vibes',
  palette: synthwave84Palette,
  headerBackground: '#262335',
  accentEdge: '#FF7EDB',
  isDark: true,
});
