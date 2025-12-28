import { describe, it, expect } from 'vitest';
import { lightTheme, darkTheme, sigilweaverTheme, highContrastTheme } from '../core';
import { HEADER_BACKGROUND, BRAND_EDGE, BRAND_EDGE_ANIMATED } from '../tokens/constants';

describe('Brand constants are applied consistently', () => {
  it('uses shared header background for non-accessibility themes', () => {
    expect(lightTheme.colors.header.background).toBe(HEADER_BACKGROUND);
    expect(darkTheme.colors.header.background).toBe(HEADER_BACKGROUND);
    expect(sigilweaverTheme.colors.header.background).toBe(HEADER_BACKGROUND);
    // High contrast intentionally different
    expect(highContrastTheme.colors.header.background).not.toBe(HEADER_BACKGROUND);
  });

  it('uses brand edge color for selected edges', () => {
    expect(lightTheme.colors.edges.selected.stroke).toBe(BRAND_EDGE);
    expect(darkTheme.colors.edges.selected.stroke).toBe(BRAND_EDGE);
    expect(sigilweaverTheme.colors.edges.selected.stroke).toBe(BRAND_EDGE);
    // High contrast is not constrained
    expect(highContrastTheme.colors.edges.selected.stroke).not.toBeUndefined();
  });

  it('uses brand edge for node selection border and halo (non-a11y themes)', () => {
    expect(lightTheme.colors.nodes.selected.border).toBe(BRAND_EDGE);
    expect(darkTheme.colors.nodes.selected.border).toBe(BRAND_EDGE);
    expect(sigilweaverTheme.colors.nodes.selected.border).toBe(BRAND_EDGE);
    expect(lightTheme.colors.nodes.selected.shadow).toContain(BRAND_EDGE_ANIMATED);
    expect(darkTheme.colors.nodes.selected.shadow).toContain(BRAND_EDGE_ANIMATED);
    expect(sigilweaverTheme.colors.nodes.selected.shadow).toContain(BRAND_EDGE_ANIMATED);
  });

  it('uses brand edge for minimap viewport (non-a11y themes)', () => {
    expect(lightTheme.colors.canvas.minimap.viewport).toBe(BRAND_EDGE);
    expect(darkTheme.colors.canvas.minimap.viewport).toBe(BRAND_EDGE);
    expect(sigilweaverTheme.colors.canvas.minimap.viewport).toBe(BRAND_EDGE);
  });
});
