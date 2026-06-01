/**
 * Theme Factory
 * 
 * DRY utility for creating themes from palettes.
 * All themes use the same structure - only colors differ.
 */

import { Theme, ColorPalette } from '../types/theme';
import { buildFieldStates, buildButtonStates } from './tokens/builders';

// ---------------------------------------------------------------------------
// WCAG helpers - keep text/bg contrast ≥ 4.5:1 (AA normal)
// ---------------------------------------------------------------------------

function srgbChannel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

function ratio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick white or near-black text to maximise contrast against `bg`.
 * `white` and `dark` should be the palette's foundation.white / gray[50].
 */
function wcagAutoText(bg: string, white: string, dark: string): string {
  const bgL = luminance(bg);
  const whiteL = luminance(white);
  const darkL = luminance(dark);
  return ratio(whiteL, bgL) >= ratio(bgL, darkL) ? white : dark;
}

type GrayIdx = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
type BrandIdx = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  palette: ColorPalette;
  /** Header background - defaults to palette.gray[100] for dark themes */
  headerBackground?: string;
  /** Edge/accent color for wires and selections */
  accentEdge?: string;
  /** Animated edge color (e.g. for selection halos) - defaults to palette brand color */
  accentEdgeAnimated?: string;
  /** Whether this is a dark theme (affects some defaults) */
  isDark?: boolean;
  /**
   * Per-theme override of dark-theme header button color indices, as
   * [default, hover, active]. A few dark palettes have light mid-grays or
   * pastel brand tints, so the default neutral/secondary/primary buttons
   * resolve to dark text and look muddy next to the white-text buttons.
   * Supplying darker indices here keeps every toolbar button crisp white.
   * Dark themes only; ignored for light themes.
   */
  headerButtonIndices?: {
    neutral?: [GrayIdx, GrayIdx, GrayIdx];
    secondary?: [GrayIdx, GrayIdx, GrayIdx];
    primary?: [BrandIdx, BrandIdx, BrandIdx];
  };
}

/**
 * Creates a complete theme from a palette and minimal config.
 * This is the single source of truth for theme structure.
 */
export function createTheme(config: ThemeConfig): Theme {
  const { id, name, description, palette: p, isDark = true } = config;
  
  // Derive header background and accent from config or sensible defaults
  const headerBg = config.headerBackground ?? p.gray[100];
  const accent = config.accentEdge ?? p.brand.primary[isDark ? 400 : 700];
  const accentHover = p.brand.primary[isDark ? 500 : 800];
  const accentAnimated = config.accentEdgeAnimated ?? p.brand.primary[isDark ? 500 : 600];
  
  // WCAG auto-text: picks pure white or black for maximum contrast on a given bg.
  // We use #ffffff/#000000 rather than palette foundation colors because tinted
  // palettes (e.g. Catppuccin Latte, Gruvbox Light) have narrower contrast ranges.
  const autoText = (bg: string) => wcagAutoText(bg, '#ffffff', '#000000');
  // Accent for text-on-gray (checkbox marks, radio dots) - needs ≥ 4.5:1
  // Use deeper indices so the accent contrasts against gray backgrounds
  const accentText = p.brand.primary[isDark ? 700 : 800];
  const accentTextHover = p.brand.primary[isDark ? 800 : 900];
  // Disabled text must contrast against its disabled background (gray[200])
  const disabledText = autoText(p.gray[200]);
  // Header disabled text contrasts against disabled bg (gray[300/400])
  const headerDisabledText = autoText(p.gray[isDark ? 300 : 400]);
  
  // Overlay alpha depends on theme darkness
  const overlayAlpha = isDark ? 0.85 : 0.5;
  const shadowAlpha = isDark ? 0.4 : 0.1;
  const deepShadowAlpha = isDark ? 0.6 : 0.25;
  
  // ── Header button presets (intent-based hierarchy) ────────────
  // Light themes always have dark headers, so header buttons need white
  // text.  Walk from gray[500] upward to find the lightest gray where
  // autoText picks white - each palette hits this threshold at a
  // different index (Core Light at 500, Solarized Light not until 800).
  const hdrIdx: [GrayIdx, GrayIdx, GrayIdx] = isDark
    ? (config.headerButtonIndices?.neutral ?? [500, 400, 600])   // dark themes: mid default, lighter hover, darker active
    : (() => {
        const base = ([500, 600, 700, 800] as const).find(
          i => autoText(p.gray[i]) === '#ffffff',
        ) ?? 800;
        return [
          base,
          Math.min(base + 100, 900) as GrayIdx,
          Math.min(base + 200, 950) as GrayIdx,
        ] as [GrayIdx, GrayIdx, GrayIdx];
      })();
  // Secondary header button starts one step lighter than neutral on
  // dark themes; on light themes it matches neutral (the primary CTA
  // Run button provides the visual hierarchy instead).
  const hdrSecIdx: [GrayIdx, GrayIdx, GrayIdx] = isDark
    ? (config.headerButtonIndices?.secondary ?? [400, 300, 500])
    : hdrIdx;

  // Primary CTA (Run): brand color stands out from the neutral toolbar.
  // Indices are [default, hover, active] into brand.primary.
  const hdrPrimIdx: [BrandIdx, BrandIdx, BrandIdx] = isDark
    ? (config.headerButtonIndices?.primary ?? [400, 300, 500])
    : [500, 600, 700];
  const headerPrimaryBtn = buildButtonStates({
    bg: { default: p.brand.primary[hdrPrimIdx[0]], hover: p.brand.primary[hdrPrimIdx[1]], active: p.brand.primary[hdrPrimIdx[2]], disabled: p.gray[isDark ? 300 : 400] },
    border: { default: p.brand.primary[isDark ? 300 : 600], hover: p.brand.primary[isDark ? 200 : 700], active: p.brand.primary[isDark ? 400 : 800], disabled: p.gray[isDark ? 300 : 400] },
    text: { default: autoText(p.brand.primary[hdrPrimIdx[0]]), hover: autoText(p.brand.primary[hdrPrimIdx[1]]), active: autoText(p.brand.primary[hdrPrimIdx[2]]), disabled: headerDisabledText },
  });
  // Secondary (Preview): slightly lighter neutral to hint at importance
  const headerSecondaryBtn = buildButtonStates({
    bg: { default: p.gray[hdrSecIdx[0]], hover: p.gray[hdrSecIdx[1]], active: p.gray[hdrSecIdx[2]], disabled: p.gray[isDark ? 300 : 400] },
    border: { default: p.gray[isDark ? 300 : hdrSecIdx[1]], hover: p.gray[isDark ? 200 : hdrSecIdx[2]], active: p.gray[isDark ? 400 : Math.min(hdrSecIdx[2] + 100, 900) as GrayIdx], disabled: p.gray[isDark ? 300 : 400] },
    text: { default: autoText(p.gray[hdrSecIdx[0]]), hover: autoText(p.gray[hdrSecIdx[1]]), active: autoText(p.gray[hdrSecIdx[2]]), disabled: headerDisabledText },
  });
  // Neutral (Open, Save, New, View Code etc.): quiet utility buttons
  const headerNeutralBtn = buildButtonStates({
    bg: { default: p.gray[hdrIdx[0]], hover: p.gray[hdrIdx[1]], active: p.gray[hdrIdx[2]], disabled: p.gray[isDark ? 300 : 400] },
    border: { default: p.gray[isDark ? 400 : hdrIdx[1]], hover: p.gray[isDark ? 300 : hdrIdx[2]], active: p.gray[isDark ? 500 : Math.min(hdrIdx[2] + 100, 900) as GrayIdx], disabled: p.gray[isDark ? 300 : 400] },
    text: { default: autoText(p.gray[hdrIdx[0]]), hover: autoText(p.gray[hdrIdx[1]]), active: autoText(p.gray[hdrIdx[2]]), disabled: headerDisabledText },
  });
  
  // For surfaces/backgrounds: dark themes use low indices (50-200), light themes also use low indices
  // For text: dark themes use high indices (700-900), light themes also use high indices
  // This works because light palettes have light colors at low indices and dark colors at high indices
  // Dark palettes (inverted) have dark colors at low indices and light colors at high indices
  // Focus border: ensure ≥ 3:1 against page background. If the accent colour
  // doesn't meet this threshold (e.g. pastel brand constant on a white page),
  // fall back to a deeper brand.primary index.
  const pageBg = p.gray[50];
  const focusBorder =
    ratio(luminance(accent), luminance(pageBg)) >= 3.5
      ? accent
      : p.brand.primary[isDark ? 400 : 800];
  
  // ── Edge / wire contrast ──────────────────────────────────────────
  // Ensure every wire color meets ≥ 4.5:1 (AA-normal) against the canvas.
  // This exceeds the 3:1 WCAG minimum for graphical objects (1.4.11) to
  // keep wires clearly visible on the pipeline canvas.
  const canvasBg = p.gray[isDark ? 100 : 50];
  const canvasL = luminance(canvasBg);

  const EDGE_CONTRAST = 4.5;
  type PaletteScale = Record<number, string>;
  const ensureEdgeContrast = (color: string, scale: PaletteScale): string => {
    if (ratio(luminance(color), canvasL) >= EDGE_CONTRAST) return color;
    // Walk through progressively higher-contrast indices
    const indices = isDark
      ? [500, 600, 700, 800, 900] as const
      : [600, 700, 800, 900] as const;
    for (const idx of indices) {
      if (scale[idx] && ratio(luminance(scale[idx]), canvasL) >= EDGE_CONTRAST) return scale[idx];
    }
    return isDark ? '#ffffff' : '#000000'; // ultimate fallback
  };

  const edgeDefault = ensureEdgeContrast(p.gray[isDark ? 500 : 600], p.gray);
  const edgeDefaultHover = ensureEdgeContrast(p.gray[isDark ? 600 : 700], p.gray);
  const edgeAccent = ensureEdgeContrast(accent, p.brand.primary);
  const edgeAccentHover = ensureEdgeContrast(accentHover, p.brand.primary);
  const edgeAnimated = ensureEdgeContrast(accentAnimated, p.brand.primary);
  const edgeInvalid = ensureEdgeContrast(p.semantic.error[isDark ? 400 : 500], p.semantic.error);
  const edgeInvalidHover = ensureEdgeContrast(p.semantic.error[isDark ? 500 : 600], p.semantic.error);
  
  // ── Border contrast ────────────────────────────────────────────
  // Pick the *softest* gray that still meets ≥ 3:1 against the page
  // background so borders delineate panels without looking busy.
  const pageBgL = luminance(pageBg);
  const softBorder = ((): string => {
    // Start from lighter shades and walk up until 3:1 is met
    const indices = isDark
      ? [400, 500, 600, 700, 800] as const
      : [400, 500, 600, 700, 800] as const;
    for (const idx of indices) {
      if (ratio(luminance(p.gray[idx]), pageBgL) >= 3.0) return p.gray[idx];
    }
    return p.gray[isDark ? 700 : 800]; // fallback
  })();
  
  return {
    id,
    name,
    description,
    colors: {
      palette: p,
      
      surfaces: {
        page: p.gray[50],
        panel: p.gray[100],
        elevated: p.gray[isDark ? 200 : 50],
        overlay: `rgba(0,0,0,${overlayAlpha})`,
        canvas: p.gray[isDark ? 100 : 50],
      },
      
      text: {
        primary: p.gray[900],
        secondary: p.gray[isDark ? 800 : 900],
        tertiary: p.gray[isDark ? 700 : 800],
        inverse: p.gray[100],
        disabled: p.gray[isDark ? 700 : 800],
      },
      
      borders: {
        primary: softBorder,
        secondary: p.gray[isDark ? 300 : 400],
        focus: focusBorder,
        divider: p.gray[isDark ? 300 : 200],
      },
      
      header: {
        background: headerBg,
        logo: { icon: p.brand.secondary[isDark ? 500 : 700], text: autoText(headerBg) },
        title: { text: autoText(headerBg) },
        metadata: { text: autoText(headerBg), divider: p.gray[500] },
        buttons: {
          // ── Button intent hierarchy ──────────────────────────
          // Run  = primary CTA  → brand.primary (stands out)
          // Preview = secondary → slightly elevated neutral
          // Everything else     → neutral (utility actions)
          new: headerNeutralBtn,
          import: headerNeutralBtn,
          export: headerNeutralBtn,
          viewCode: headerNeutralBtn,
          preview: headerSecondaryBtn,
          run: headerPrimaryBtn,
        },
        divider: p.gray[500],
        themeSelector: {
          trigger: {
            default: { background: p.foundation.transparent, border: p.gray[isDark ? 500 : 400], text: autoText(headerBg) },
            hover: { background: p.gray[isDark ? 200 : 700], border: p.gray[isDark ? 400 : 500], text: autoText(p.gray[isDark ? 200 : 700]) },
            active: { background: p.gray[isDark ? 300 : 600], border: p.gray[isDark ? 400 : 500], text: autoText(p.gray[isDark ? 300 : 600]) },
            disabled: { background: p.foundation.transparent, border: p.gray[isDark ? 300 : 500], text: autoText(headerBg) },
          },
          dropdown: { background: p.gray[100], border: p.gray[300], shadow: `0 10px 25px rgba(0,0,0,${deepShadowAlpha})` },
          option: {
            default: { background: p.foundation.transparent, border: p.foundation.transparent, text: p.gray[isDark ? 800 : 900] },
            hover: { background: p.gray[200], border: p.foundation.transparent, text: p.gray[900] },
            active: { background: p.brand.primary[100], border: p.foundation.transparent, text: p.brand.primary[isDark ? 600 : 700] },
            disabled: { background: p.foundation.transparent, border: p.foundation.transparent, text: p.gray[500] },
          },
        },
      },
      
      configPanel: {
        background: p.gray[100],
        border: p.gray[200],
        shadow: `0 4px 6px rgba(0,0,0,${shadowAlpha})`,
        header: { background: p.gray[200], border: p.gray[300], text: p.gray[900] },
        sections: { background: p.gray[100], border: p.gray[200], title: p.gray[900] },
        fields: {
          label: p.gray[isDark ? 800 : 900],
          input: buildFieldStates({
            bg: { base: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
            border: { base: p.gray[isDark ? 400 : 300], hover: p.gray[isDark ? 500 : 400], active: accent, disabled: p.gray[isDark ? 300 : 200] },
            text: { base: p.gray[900], disabled: disabledText },
            focusShadow: `0 0 0 3px ${p.brand.primary[isDark ? 900 : 100]}`,
          }),
          select: buildFieldStates({
            bg: { base: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
            border: { base: p.gray[isDark ? 400 : 300], hover: p.gray[isDark ? 500 : 400], active: accent, disabled: p.gray[isDark ? 300 : 200] },
            text: { base: p.gray[900], disabled: disabledText },
          }),
          checkbox: buildFieldStates({
            bg: { base: p.gray[isDark ? 100 : 50], hover: p.gray[200], active: p.brand.primary[100], disabled: p.gray[200] },
            border: { base: p.gray[isDark ? 400 : 300], hover: p.gray[isDark ? 500 : 400], active: p.brand.primary[isDark ? 400 : 500], disabled: p.gray[isDark ? 300 : 200] },
            text: { base: accentText, hover: accentTextHover, active: autoText(p.brand.primary[100]), disabled: disabledText },
          }),
          radio: buildFieldStates({
            bg: { base: p.gray[isDark ? 100 : 50], hover: p.gray[200], active: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
            border: { base: p.gray[isDark ? 400 : 300], hover: p.gray[isDark ? 500 : 400], active: p.brand.primary[isDark ? 400 : 500], disabled: p.gray[isDark ? 300 : 200] },
            text: { base: accentText, hover: accentTextHover, active: accentTextHover, disabled: disabledText },
          }),
        },
      },
      
      toolPalette: {
        background: p.gray[100],
        border: p.gray[200],
        shadow: `0 4px 6px rgba(0,0,0,${shadowAlpha})`,
        search: {
          input: buildFieldStates({
            bg: { base: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
            border: { base: p.gray[isDark ? 400 : 300], hover: p.gray[isDark ? 500 : 400], active: accent, disabled: p.gray[isDark ? 300 : 200] },
            text: { base: p.gray[900], disabled: disabledText },
            focusShadow: `0 0 0 3px ${p.brand.primary[isDark ? 900 : 100]}`,
          }),
          icon: p.gray[600],
        },
        categories: {
          header: { background: p.gray[200], text: p.gray[900], border: p.gray[300] },
          expanded: { background: p.gray[100] },
        },
        tools: {
          item: buildFieldStates({
            bg: { base: p.gray[100], hover: p.gray[200], active: p.brand.primary[100], disabled: p.gray[100] },
            border: { base: p.foundation.transparent, hover: p.gray[300], active: p.brand.primary[isDark ? 400 : 300], disabled: p.foundation.transparent },
            text: { base: p.gray[isDark ? 800 : 900], hover: p.gray[900], active: p.gray[900], disabled: disabledText },
          }),
          icon: p.gray[600],
          label: p.gray[isDark ? 800 : 900],
          dragPreview: { background: p.gray[200], border: p.brand.primary[300], shadow: `0 10px 25px rgba(0,0,0,${deepShadowAlpha})` },
        },
      },
      
      canvas: {
        background: p.gray[isDark ? 100 : 50],
        grid: { primary: p.gray[isDark ? 500 : 400], secondary: p.gray[isDark ? 400 : 300] },
        minimap: { background: p.gray[200], border: p.gray[300], viewport: accent, mask: `${accent}40` },
        controls: {
          background: p.gray[100],
          border: p.gray[200],
          shadow: `0 2px 4px rgba(0,0,0,${shadowAlpha})`,
          button: buildFieldStates({
            bg: { base: p.gray[200], hover: p.gray[300], active: accent, disabled: p.gray[200] },
            border: { base: p.gray[400], hover: p.gray[500], active: accentHover, disabled: p.gray[isDark ? 400 : 300] },
            text: { base: p.gray[isDark ? 800 : 900], hover: autoText(p.gray[300]), active: autoText(accent), disabled: disabledText },
          }),
        },
      },
      
      nodes: {
        default: { background: p.gray[100], border: p.gray[300], shadow: `0 2px 4px rgba(0,0,0,${shadowAlpha * 0.75})` },
        selected: { background: p.gray[100], border: accent, shadow: `0 0 0 3px ${accentAnimated}` },
        dragging: { background: p.gray[100], border: accent, shadow: `0 10px 25px rgba(0,0,0,${deepShadowAlpha})` },
        header: { background: p.gray[200], text: p.gray[900], icon: p.gray[600] },
        content: { background: p.gray[100], text: p.gray[isDark ? 800 : 900] },
        handles: {
          input: { background: p.tools.compute[isDark ? 500 : 600], border: p.tools.compute[isDark ? 400 : 700], connected: accent },
          output: { background: p.tools.connect[isDark ? 500 : 600], border: p.tools.connect[isDark ? 400 : 700], connected: accent },
        },
      },
      
      edges: {
        default: { stroke: edgeDefault, strokeHover: edgeDefaultHover },
        selected: { stroke: edgeAccent, strokeHover: edgeAccentHover },
        animated: { stroke: edgeAnimated, strokeHover: edgeAccentHover },
        invalid: { stroke: edgeInvalid, strokeHover: edgeInvalidHover },
      },
      
      modals: {
        overlay: `rgba(0,0,0,${overlayAlpha})`,
        container: { background: p.gray[100], border: p.gray[300], shadow: `0 25px 50px rgba(0,0,0,${deepShadowAlpha + 0.2})` },
        header: { background: p.gray[200], border: p.gray[300], text: p.gray[900] },
        content: { background: p.gray[100], text: p.gray[isDark ? 800 : 900] },
        buttons: {
          primary: buildButtonStates({
            bg: { default: p.brand.primary[isDark ? 500 : 500], hover: p.brand.primary[isDark ? 400 : 600], active: p.brand.primary[isDark ? 600 : 700], disabled: p.gray[isDark ? 300 : 300] },
            border: { default: p.brand.primary[isDark ? 400 : 600], hover: p.brand.primary[isDark ? 300 : 700], active: p.brand.primary[isDark ? 500 : 800], disabled: p.gray[isDark ? 300 : 300] },
            text: { default: autoText(p.brand.primary[isDark ? 500 : 500]), hover: autoText(p.brand.primary[isDark ? 400 : 600]), active: autoText(p.brand.primary[isDark ? 600 : 700]), disabled: disabledText },
          }),
          secondary: buildButtonStates({
            bg: { default: p.gray[200], hover: p.gray[300], active: p.gray[400], disabled: p.gray[200] },
            border: { default: p.gray[400], hover: p.gray[500], active: p.gray[500], disabled: p.gray[isDark ? 400 : 300] },
            text: { default: p.gray[900], hover: p.gray[950], active: autoText(p.gray[400]), disabled: disabledText },
          }),
          cancel: buildButtonStates({
            bg: { default: p.foundation.transparent, hover: p.gray[300], active: p.gray[400], disabled: p.foundation.transparent },
            border: { default: p.foundation.transparent, hover: p.foundation.transparent, active: p.foundation.transparent, disabled: p.foundation.transparent },
            text: { default: p.gray[isDark ? 800 : 900], hover: p.gray[950], active: autoText(p.gray[400]), disabled: disabledText },
          }),
        },
      },
      
      notifications: {
        success: { background: p.semantic.success[100], border: p.semantic.success[isDark ? 200 : 400], text: p.semantic.success[900], icon: p.semantic.success[800] },
        warning: { background: p.semantic.warning[100], border: p.semantic.warning[isDark ? 200 : 400], text: p.semantic.warning[900], icon: p.semantic.warning[800] },
        error: { background: p.semantic.error[100], border: p.semantic.error[isDark ? 200 : 400], text: p.semantic.error[900], icon: p.semantic.error[800] },
        info: { background: p.semantic.info[100], border: p.semantic.info[isDark ? 200 : 400], text: p.semantic.info[900], icon: p.semantic.info[800] },
      },
      
      syntax: {
        tag: p.semantic.info[isDark ? 700 : 800],
        attribute: p.semantic.success[isDark ? 700 : 800],
        value: p.semantic.error[isDark ? 800 : 800],
        comment: p.gray[800],
        declaration: p.brand.secondary[isDark ? 700 : 800],
        text: p.gray[900],
        background: p.gray[100],
        selection: p.brand.primary[isDark ? 200 : 100],
      },
      
      forms: {
        input: buildFieldStates({
          bg: { base: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
          border: { base: p.gray[isDark ? 400 : 300], hover: p.gray[isDark ? 500 : 400], active: accent, disabled: p.gray[isDark ? 300 : 200] },
          text: { base: p.gray[900], disabled: disabledText },
          focusShadow: `0 0 0 3px ${p.brand.primary[isDark ? 900 : 100]}`,
        }),
        select: buildFieldStates({
          bg: { base: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
          border: { base: p.gray[isDark ? 400 : 300], hover: p.gray[isDark ? 500 : 400], active: accent, disabled: p.gray[isDark ? 300 : 200] },
          text: { base: p.gray[900], disabled: disabledText },
        }),
        checkbox: buildFieldStates({
          bg: { base: p.gray[isDark ? 100 : 50], hover: p.gray[200], active: p.brand.primary[100], disabled: p.gray[200] },
          border: { base: p.gray[isDark ? 400 : 300], hover: p.gray[isDark ? 500 : 400], active: p.brand.primary[isDark ? 400 : 500], disabled: p.gray[isDark ? 300 : 200] },
          text: { base: accentText, hover: accentTextHover, active: autoText(p.brand.primary[100]), disabled: disabledText },
        }),
        radio: buildFieldStates({
          bg: { base: p.gray[isDark ? 100 : 50], hover: p.gray[200], active: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
          border: { base: p.gray[isDark ? 400 : 300], hover: p.gray[isDark ? 500 : 400], active: p.brand.primary[isDark ? 400 : 500], disabled: p.gray[isDark ? 300 : 200] },
          text: { base: accentText, hover: accentTextHover, active: accentTextHover, disabled: disabledText },
        }),
        button: {
          primary: buildButtonStates({
            bg: { default: p.brand.primary[isDark ? 500 : 500], hover: p.brand.primary[isDark ? 400 : 600], active: p.brand.primary[isDark ? 600 : 700], disabled: p.gray[isDark ? 300 : 300] },
            border: { default: p.brand.primary[isDark ? 400 : 600], hover: p.brand.primary[isDark ? 300 : 700], active: p.brand.primary[isDark ? 500 : 800], disabled: p.gray[isDark ? 300 : 300] },
            text: { default: autoText(p.brand.primary[isDark ? 500 : 500]), hover: autoText(p.brand.primary[isDark ? 400 : 600]), active: autoText(p.brand.primary[isDark ? 600 : 700]), disabled: disabledText },
          }),
          secondary: buildButtonStates({
            bg: { default: p.gray[200], hover: p.gray[300], active: p.gray[400], disabled: p.gray[200] },
            border: { default: p.gray[400], hover: p.gray[500], active: p.gray[500], disabled: p.gray[isDark ? 400 : 300] },
            text: { default: p.gray[900], hover: p.gray[950], active: autoText(p.gray[400]), disabled: disabledText },
          }),
          tertiary: buildButtonStates({
            bg: { default: p.foundation.transparent, hover: p.gray[300], active: p.gray[400], disabled: p.foundation.transparent },
            border: { default: p.foundation.transparent, hover: p.foundation.transparent, active: p.foundation.transparent, disabled: p.foundation.transparent },
            text: { default: p.brand.primary[isDark ? 700 : 700], hover: autoText(p.gray[300]), active: autoText(p.gray[400]), disabled: disabledText },
          }),
          danger: buildButtonStates({
            bg: { default: p.semantic.error[isDark ? 500 : 500], hover: p.semantic.error[isDark ? 400 : 600], active: p.semantic.error[isDark ? 600 : 700], disabled: p.gray[isDark ? 300 : 300] },
            border: { default: p.semantic.error[isDark ? 600 : 600], hover: p.semantic.error[isDark ? 500 : 700], active: p.semantic.error[isDark ? 700 : 800], disabled: p.gray[isDark ? 300 : 300] },
            text: { default: autoText(p.semantic.error[isDark ? 500 : 500]), hover: autoText(p.semantic.error[isDark ? 400 : 600]), active: autoText(p.semantic.error[isDark ? 600 : 700]), disabled: disabledText },
          }),
        },
        label: p.gray[isDark ? 800 : 900],
        helpText: p.gray[isDark ? 800 : 900],
        errorText: p.semantic.error[isDark ? 700 : 800],
        successText: p.semantic.success[isDark ? 700 : 800],
      },
    },
  };
}
