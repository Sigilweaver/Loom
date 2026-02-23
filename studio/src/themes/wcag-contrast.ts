/**
 * WCAG 2.1 Contrast Ratio Utilities
 *
 * Implements the contrast ratio algorithm from
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * Used by theme accessibility tests to validate color pairs.
 */

/**
 * Parse a CSS color string into [r, g, b] (0-255).
 * Supports: #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), named "transparent".
 */
export function parseColor(color: string): [number, number, number] {
  const c = color.trim().toLowerCase();

  // transparent → black (not visible text, but prevents parse crashes)
  if (c === 'transparent') return [0, 0, 0];

  // Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }

  // rgb(r, g, b) / rgba(r, g, b, a)
  const rgbMatch = c.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/,
  );
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10),
    ];
  }

  throw new Error(`Cannot parse color: "${color}"`);
}

/**
 * Relative luminance per WCAG 2.1
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(color: string): number {
  const [r, g, b] = parseColor(color).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colors (1:1 to 21:1).
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA minimum for normal text (≥ 4.5:1) */
export const WCAG_AA_NORMAL = 4.5;
/** WCAG AA minimum for large text / UI components (≥ 3:1) */
export const WCAG_AA_LARGE = 3.0;
/** WCAG AAA minimum for normal text (≥ 7:1) */
export const WCAG_AAA_NORMAL = 7.0;

/**
 * Describes a foreground/background pair to validate.
 */
export interface ContrastPair {
  /** Human-readable label for test output */
  label: string;
  /** Foreground (text/icon) color */
  fg: string;
  /** Background color */
  bg: string;
  /** Required WCAG level (defaults to AA normal) */
  level?: number;
}

/**
 * Returns true when fg-on-bg meets the required contrast level.
 */
export function meetsContrast(
  fg: string,
  bg: string,
  level: number = WCAG_AA_NORMAL,
): boolean {
  return contrastRatio(fg, bg) >= level;
}

/**
 * Helper: skip a pair when either color uses rgba overlay or transparent.
 * These depend on blending context which can't be evaluated from a static hex.
 */
export function isStaticColor(color: string): boolean {
  const c = color.trim().toLowerCase();
  if (c === 'transparent') return false;
  if (c.startsWith('rgba') && c.includes(',')) {
    // Check if alpha < 1
    const alphaMatch = c.match(/,\s*([\d.]+)\s*\)$/);
    if (alphaMatch && parseFloat(alphaMatch[1]) < 1) return false;
  }
  return true;
}
