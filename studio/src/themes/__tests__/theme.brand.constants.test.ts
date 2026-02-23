import { describe, it, expect } from 'vitest';
import { lightTheme, darkTheme, sigilweaverTheme, highContrastTheme } from '../core';
import { HEADER_BACKGROUND, BRAND_EDGE, BRAND_EDGE_ANIMATED } from '../tokens/constants';

describe('Brand constants are applied consistently', () => {
  it('sigilweaver uses the purple brand header', () => {
    expect(sigilweaverTheme.colors.header.background).toBe(HEADER_BACKGROUND);
  });

  it('dark and light themes use palette-native headers (no purple)', () => {
    expect(darkTheme.colors.header.background).not.toBe(HEADER_BACKGROUND);
    expect(lightTheme.colors.header.background).not.toBe(HEADER_BACKGROUND);
    // High contrast is also intentionally different
    expect(highContrastTheme.colors.header.background).not.toBe(HEADER_BACKGROUND);
  });

  it('sigilweaver uses brand edge colors', () => {
    expect(sigilweaverTheme.colors.edges.selected.stroke).toBe(BRAND_EDGE);
    expect(sigilweaverTheme.colors.nodes.selected.border).toBe(BRAND_EDGE);
    expect(sigilweaverTheme.colors.nodes.selected.shadow).toContain(BRAND_EDGE_ANIMATED);
    expect(sigilweaverTheme.colors.canvas.minimap.viewport).toBe(BRAND_EDGE);
  });

  it('all themes define edge colors', () => {
    for (const theme of [darkTheme, lightTheme, sigilweaverTheme, highContrastTheme]) {
      expect(theme.colors.edges.selected.stroke).toBeTruthy();
      expect(theme.colors.edges.animated.stroke).toBeTruthy();
      expect(theme.colors.edges.default.stroke).toBeTruthy();
      expect(theme.colors.edges.invalid.stroke).toBeTruthy();
    }
  });
});
