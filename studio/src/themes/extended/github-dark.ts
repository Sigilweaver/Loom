/**
 * GitHub Dark Theme
 * GitHub's official dark theme
 * https://primer.style/primitives/colors
 */

import { createTheme } from '../createTheme';
import { githubDarkPalette } from '../palettes';

export const githubDarkTheme = createTheme({
  id: 'github-dark',
  name: 'GitHub Dark',
  description: 'GitHub official dark theme',
  palette: githubDarkPalette,
  headerBackground: '#161B22',
  accentEdge: '#58A6FF',
  isDark: true,
});
