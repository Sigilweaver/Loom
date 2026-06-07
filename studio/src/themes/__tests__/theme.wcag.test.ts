import { describe, it, expect } from 'vitest';
import { availableThemes } from '../index';
import type { Theme, ThemeColors, InteractiveElementStyle } from '../../types/theme';
import {
  contrastRatio,
  meetsContrast,
  isStaticColor,
  WCAG_AA_NORMAL,
  WCAG_AA_LARGE,
  ContrastPair,
} from '../wcag-contrast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ContrastPair and auto-skip non-static colors (overlays, rgba). */
function pair(
  label: string,
  fg: string,
  bg: string,
  level: number = WCAG_AA_NORMAL,
): ContrastPair | null {
  if (!isStaticColor(fg) || !isStaticColor(bg)) return null;
  return { label, fg, bg, level };
}

/**
 * Extract text-on-background pairs from an InteractiveElementStyle.
 * Tests the `default` and `disabled` states with the specified background.
 */
function interactivePairs(
  prefix: string,
  style: InteractiveElementStyle,
  fallbackBg?: string,
  level: number = WCAG_AA_NORMAL,
): ContrastPair[] {
  const pairs: ContrastPair[] = [];
  for (const state of ['default', 'hover', 'active'] as const) {
    const s = style[state];
    const bg = s.background || fallbackBg;
    if (bg && s.text) {
      const p = pair(`${prefix} ${state}: text on background`, s.text, bg, level);
      if (p) pairs.push(p);
    }
  }
  // Disabled state may have lower contrast; still require AA large (3:1)
  const dis = style.disabled;
  const disBg = dis.background || fallbackBg;
  if (disBg && dis.text) {
    const p = pair(`${prefix} disabled: text on background`, dis.text, disBg, WCAG_AA_LARGE);
    if (p) pairs.push(p);
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Extract all critical foreground/background pairs from a theme
// ---------------------------------------------------------------------------

function extractContrastPairs(colors: ThemeColors): ContrastPair[] {
  const pairs: ContrastPair[] = [];

  const add = (
    label: string,
    fg: string,
    bg: string,
    level: number = WCAG_AA_NORMAL,
  ) => {
    const p = pair(label, fg, bg, level);
    if (p) pairs.push(p);
  };

  // ── Global surfaces ──────────────────────────────────────────────
  add('Primary text on page', colors.text.primary, colors.surfaces.page);
  add('Secondary text on page', colors.text.secondary, colors.surfaces.page);
  add('Tertiary text on page', colors.text.tertiary, colors.surfaces.page, WCAG_AA_LARGE);
  add('Primary text on panel', colors.text.primary, colors.surfaces.panel);
  add('Secondary text on panel', colors.text.secondary, colors.surfaces.panel);
  add('Primary text on elevated', colors.text.primary, colors.surfaces.elevated);
  add('Disabled text on page', colors.text.disabled, colors.surfaces.page, WCAG_AA_LARGE);

  // ── Borders (non-decorative borders need 3:1 against surface) ─
  add('Primary border on page', colors.borders.primary, colors.surfaces.page, WCAG_AA_LARGE);
  add('Focus border on page', colors.borders.focus, colors.surfaces.page, WCAG_AA_LARGE);

  // ── Header ────────────────────────────────────────────────────────
  const hdr = colors.header;
  // Logo icon is decorative/brand - exempt from WCAG 1.4.3
  add('Header logo text on header bg', hdr.logo.text, hdr.background);
  add('Header title on header bg', hdr.title.text, hdr.background);
  add('Header metadata on header bg', hdr.metadata.text, hdr.background, WCAG_AA_LARGE);

  for (const [btnName, btnStyle] of Object.entries(hdr.buttons) as [string, InteractiveElementStyle][]) {
    pairs.push(...interactivePairs(`Header button "${btnName}"`, btnStyle, hdr.background));
  }
  pairs.push(...interactivePairs('Header theme trigger', hdr.themeSelector.trigger, hdr.background));
  add(
    'Theme dropdown option text on dropdown bg',
    hdr.themeSelector.option.default.text,
    hdr.themeSelector.dropdown.background,
  );

  // ── Config panel ──────────────────────────────────────────────────
  const cp = colors.configPanel;
  add('Config header text on header bg', cp.header.text, cp.header.background);
  add('Config section title on section bg', cp.sections.title, cp.sections.background);
  add('Config field label on panel bg', cp.fields.label, cp.background);

  for (const field of ['input', 'select', 'checkbox', 'radio'] as const) {
    pairs.push(...interactivePairs(`Config ${field}`, cp.fields[field], cp.background));
  }

  // ── Tool palette ──────────────────────────────────────────────────
  const tp = colors.toolPalette;
  add('Tool palette category text on category bg', tp.categories.header.text, tp.categories.header.background);
  add('Tool palette label on palette bg', tp.tools.label, tp.background, WCAG_AA_LARGE);
  pairs.push(...interactivePairs('Tool palette search', tp.search.input, tp.background));
  pairs.push(...interactivePairs('Tool palette item', tp.tools.item, tp.background));

  // ── Canvas controls ───────────────────────────────────────────────
  const cv = colors.canvas;
  pairs.push(...interactivePairs('Canvas control button', cv.controls.button, cv.controls.background));

  // ── Nodes ─────────────────────────────────────────────────────────
  const nd = colors.nodes;
  add('Node header text on header bg', nd.header.text, nd.header.background);
  add('Node content text on content bg', nd.content.text, nd.content.background);

  // ── Modals ────────────────────────────────────────────────────────
  const md = colors.modals;
  add('Modal header text on header bg', md.header.text, md.header.background);
  add('Modal content text on content bg', md.content.text, md.content.background);

  for (const [btnName, btnStyle] of Object.entries(md.buttons) as [string, InteractiveElementStyle][]) {
    pairs.push(...interactivePairs(`Modal button "${btnName}"`, btnStyle));
  }

  // ── Notifications ─────────────────────────────────────────────────
  for (const level of ['success', 'warning', 'error', 'info'] as const) {
    const n = colors.notifications[level];
    add(`Notification ${level}: text on bg`, n.text, n.background);
    add(`Notification ${level}: icon on bg`, n.icon, n.background, WCAG_AA_LARGE);
  }

  // ── Forms ─────────────────────────────────────────────────────────
  const fm = colors.forms;
  add('Form label on page', fm.label, colors.surfaces.page);
  add('Form help text on page', fm.helpText, colors.surfaces.page, WCAG_AA_LARGE);
  add('Form error text on page', fm.errorText, colors.surfaces.page);
  add('Form success text on page', fm.successText, colors.surfaces.page);

  for (const field of ['input', 'select', 'checkbox', 'radio'] as const) {
    pairs.push(...interactivePairs(`Form ${field}`, fm[field], colors.surfaces.page));
  }
  for (const variant of ['primary', 'secondary', 'tertiary', 'danger'] as const) {
    pairs.push(...interactivePairs(`Button "${variant}"`, fm.button[variant]));
  }

  // ── Edges / wires (must be visible against canvas) ─────────────
  const eg = colors.edges;
  const canvasBg = colors.canvas.background;
  add('Edge default stroke on canvas', eg.default.stroke, canvasBg, WCAG_AA_LARGE);
  add('Edge default hover on canvas', eg.default.strokeHover, canvasBg, WCAG_AA_LARGE);
  add('Edge selected stroke on canvas', eg.selected.stroke, canvasBg, WCAG_AA_LARGE);
  add('Edge animated stroke on canvas', eg.animated.stroke, canvasBg, WCAG_AA_LARGE);
  add('Edge invalid stroke on canvas', eg.invalid.stroke, canvasBg, WCAG_AA_LARGE);

  // ── Syntax highlighting ───────────────────────────────────────────
  const sx = colors.syntax;
  add('Syntax tag on syntax bg', sx.tag, sx.background);
  add('Syntax attribute on syntax bg', sx.attribute, sx.background);
  add('Syntax value on syntax bg', sx.value, sx.background);
  add('Syntax comment on syntax bg', sx.comment, sx.background, WCAG_AA_LARGE);
  add('Syntax declaration on syntax bg', sx.declaration, sx.background);
  add('Syntax text on syntax bg', sx.text, sx.background);

  return pairs;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('WCAG contrast compliance', () => {
  for (const theme of availableThemes as Theme[]) {
    describe(`Theme: ${theme.name} (${theme.id})`, () => {
      const pairs = extractContrastPairs(theme.colors);

      it('generates testable contrast pairs', () => {
        // Sanity: each theme should produce a meaningful number of pairs
        expect(pairs.length).toBeGreaterThan(30);
      });

      for (const { label, fg, bg, level = WCAG_AA_NORMAL } of pairs) {
        const levelLabel = level >= WCAG_AA_NORMAL ? 'AA' : 'AA-large';

        it(`${levelLabel} - ${label}`, () => {
          const ratio = contrastRatio(fg, bg);
          const passes = ratio >= level;

          // Provide an informative failure message
          expect(passes, [
            `WCAG ${levelLabel} FAIL: ${label}`,
            `  fg: ${fg}`,
            `  bg: ${bg}`,
            `  ratio: ${ratio.toFixed(2)}:1 (need ≥ ${level}:1)`,
          ].join('\n')).toBe(true);
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Unit tests for contrast utilities themselves
// ---------------------------------------------------------------------------

describe('WCAG contrast utilities', () => {
  describe('contrastRatio', () => {
    it('black vs white = 21:1', () => {
      expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    });

    it('same color = 1:1', () => {
      expect(contrastRatio('#abc123', '#abc123')).toBeCloseTo(1, 2);
    });

    it('is symmetric', () => {
      const a = contrastRatio('#336699', '#ffcc00');
      const b = contrastRatio('#ffcc00', '#336699');
      expect(a).toBeCloseTo(b, 5);
    });
  });

  describe('meetsContrast', () => {
    it('white-on-black meets AA normal', () => {
      expect(meetsContrast('#ffffff', '#000000', WCAG_AA_NORMAL)).toBe(true);
    });

    it('gray-on-gray may fail', () => {
      expect(meetsContrast('#888888', '#999999', WCAG_AA_NORMAL)).toBe(false);
    });
  });

  describe('parseColor', () => {
    it('handles shorthand hex', () => {
      expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 0);
    });

    it('handles rgb()', () => {
      expect(contrastRatio('rgb(255, 255, 255)', 'rgb(0, 0, 0)')).toBeCloseTo(21, 0);
    });

    it('handles rgba()', () => {
      expect(contrastRatio('rgba(255, 255, 255, 1)', 'rgba(0, 0, 0, 1)')).toBeCloseTo(21, 0);
    });
  });

  describe('isStaticColor', () => {
    it('accepts hex colors', () => {
      expect(isStaticColor('#ff0000')).toBe(true);
    });

    it('rejects transparent', () => {
      expect(isStaticColor('transparent')).toBe(false);
    });

    it('rejects semi-transparent rgba', () => {
      expect(isStaticColor('rgba(0, 0, 0, 0.5)')).toBe(false);
    });

    it('accepts fully opaque rgba', () => {
      expect(isStaticColor('rgba(0, 0, 0, 1)')).toBe(true);
    });
  });
});
