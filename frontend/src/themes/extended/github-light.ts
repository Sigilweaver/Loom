/**
 * GitHub Light Theme
 * GitHub's official light theme
 * https://primer.style/primitives/colors
 */

import { createTheme } from '../createTheme';
import { githubLightPalette } from '../palettes';

export const githubLightTheme = createTheme({
  id: 'github-light',
  name: 'GitHub Light',
  description: 'GitHub official light theme',
  palette: githubLightPalette,
  headerBackground: '#24292F',
  accentEdge: '#0969DA',
  isDark: false,
});
