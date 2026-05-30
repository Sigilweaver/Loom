import { createTheme } from '../createTheme';
import { sigilweaverPalette } from '../palettes';
import { HEADER_BACKGROUND, BRAND_EDGE, BRAND_EDGE_ANIMATED } from '../tokens/constants';

/**
 * Sigilweaver Signature - the signature dark theme.
 *
 * Now uses `createTheme()` for WCAG‑compliant contrast while keeping the
 * mystical purple-tinted palette.  Brand constants (header background,
 * edge/accent colors) are passed through as overrides.
 */
export const sigilweaverTheme = createTheme({
  id: 'sigilweaver-signature',
  name: 'Sigilweaver Signature',
  description: 'A mystical dark theme inspired by the magic of data weaving',
  palette: sigilweaverPalette,
  headerBackground: HEADER_BACKGROUND,
  accentEdge: BRAND_EDGE,
  accentEdgeAnimated: BRAND_EDGE_ANIMATED,
  isDark: true,
});
