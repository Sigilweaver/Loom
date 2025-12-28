/**
 * Theme Factory
 * 
 * DRY utility for creating themes from palettes.
 * All themes use the same structure - only colors differ.
 */

import { Theme, ColorPalette } from '../types/theme';
import { buildFieldStates, buildButtonStates } from './tokens/builders';

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
}

/**
 * Creates a complete theme from a palette and minimal config.
 * This is the single source of truth for theme structure.
 */
export function createTheme(config: ThemeConfig): Theme {
  const { id, name, description, palette: p, isDark = true } = config;
  
  // Derive header background and accent from config or sensible defaults
  const headerBg = config.headerBackground ?? p.gray[100];
  const accent = config.accentEdge ?? p.brand.primary[400];
  const accentHover = p.brand.primary[isDark ? 300 : 500];
  const accentAnimated = config.accentEdgeAnimated ?? p.brand.primary[isDark ? 300 : 500];
  
  // Overlay alpha depends on theme darkness
  const overlayAlpha = isDark ? 0.85 : 0.5;
  const shadowAlpha = isDark ? 0.4 : 0.1;
  const deepShadowAlpha = isDark ? 0.6 : 0.25;
  
  // For surfaces/backgrounds: dark themes use low indices (50-200), light themes also use low indices
  // For text: dark themes use high indices (700-900), light themes also use high indices
  // This works because light palettes have light colors at low indices and dark colors at high indices
  // Dark palettes (inverted) have dark colors at low indices and light colors at high indices
  
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
        secondary: p.gray[700],
        tertiary: p.gray[600],
        inverse: p.gray[100],
        disabled: p.gray[500],
      },
      
      borders: {
        primary: p.gray[300],
        secondary: p.gray[200],
        focus: accent,
        divider: p.gray[200],
      },
      
      header: {
        background: headerBg,
        logo: { icon: p.brand.secondary[400], text: p.foundation.white },
        title: { text: p.foundation.white },
        metadata: { text: p.foundation.white, divider: p.gray[500] },
        buttons: {
          new: buildButtonStates({
            bg: { default: p.semantic.success[isDark ? 400 : 500], hover: p.semantic.success[isDark ? 300 : 600], active: p.semantic.success[isDark ? 500 : 700], disabled: p.gray[400] },
            border: { default: p.semantic.success[isDark ? 300 : 600], hover: p.semantic.success[isDark ? 200 : 700], active: p.semantic.success[isDark ? 400 : 800], disabled: p.gray[400] },
            text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[600] },
          }),
          import: buildButtonStates({
            bg: { default: p.brand.primary[isDark ? 400 : 500], hover: p.brand.primary[isDark ? 300 : 600], active: p.brand.primary[isDark ? 500 : 700], disabled: p.gray[400] },
            border: { default: p.brand.primary[isDark ? 300 : 600], hover: p.brand.primary[isDark ? 200 : 700], active: p.brand.primary[isDark ? 400 : 800], disabled: p.gray[400] },
            text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[600] },
          }),
          export: buildButtonStates({
            bg: { default: p.gray[500], hover: p.gray[isDark ? 400 : 600], active: p.gray[isDark ? 600 : 700], disabled: p.gray[400] },
            border: { default: p.gray[isDark ? 400 : 600], hover: p.gray[isDark ? 300 : 700], active: p.gray[isDark ? 500 : 800], disabled: p.gray[400] },
            text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[600] },
          }),
          viewCode: buildButtonStates({
            bg: { default: p.brand.secondary[isDark ? 400 : 500], hover: p.brand.secondary[isDark ? 300 : 600], active: p.brand.secondary[isDark ? 500 : 700], disabled: p.gray[400] },
            border: { default: p.brand.secondary[isDark ? 300 : 600], hover: p.brand.secondary[isDark ? 200 : 700], active: p.brand.secondary[isDark ? 400 : 800], disabled: p.gray[400] },
            text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[600] },
          }),
          preview: buildButtonStates({
            bg: { default: p.semantic.info[isDark ? 400 : 500], hover: p.semantic.info[isDark ? 300 : 600], active: p.semantic.info[isDark ? 500 : 700], disabled: p.gray[400] },
            border: { default: p.semantic.info[isDark ? 300 : 600], hover: p.semantic.info[isDark ? 200 : 700], active: p.semantic.info[isDark ? 400 : 800], disabled: p.gray[400] },
            text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[600] },
          }),
          run: buildButtonStates({
            bg: { default: p.semantic.error[isDark ? 400 : 500], hover: p.semantic.error[isDark ? 300 : 600], active: p.semantic.error[isDark ? 500 : 700], disabled: p.gray[400] },
            border: { default: p.semantic.error[isDark ? 300 : 600], hover: p.semantic.error[isDark ? 200 : 700], active: p.semantic.error[isDark ? 400 : 800], disabled: p.gray[400] },
            text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[600] },
          }),
        },
        divider: p.gray[500],
        themeSelector: {
          trigger: {
            default: { background: p.foundation.transparent, border: p.gray[isDark ? 500 : 400], text: p.foundation.white },
            hover: { background: p.gray[isDark ? 200 : 700], border: p.gray[isDark ? 400 : 500], text: p.foundation.white },
            active: { background: p.gray[isDark ? 300 : 600], border: p.gray[isDark ? 400 : 500], text: p.foundation.white },
            disabled: { background: p.foundation.transparent, border: p.gray[isDark ? 300 : 500], text: p.gray[500] },
          },
          dropdown: { background: p.gray[100], border: p.gray[300], shadow: `0 10px 25px rgba(0,0,0,${deepShadowAlpha})` },
          option: {
            default: { background: p.foundation.transparent, border: p.foundation.transparent, text: p.gray[800] },
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
          label: p.gray[700],
          input: buildFieldStates({
            bg: { base: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
            border: { base: p.gray[300], hover: p.gray[400], active: accent, disabled: p.gray[200] },
            text: { base: p.gray[900], disabled: p.gray[500] },
            focusShadow: `0 0 0 3px ${p.brand.primary[isDark ? 900 : 100]}`,
          }),
          select: buildFieldStates({
            bg: { base: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
            border: { base: p.gray[300], hover: p.gray[400], active: accent, disabled: p.gray[200] },
            text: { base: p.gray[900], disabled: p.gray[500] },
          }),
          checkbox: buildFieldStates({
            bg: { base: p.gray[isDark ? 100 : 50], hover: p.gray[200], active: p.brand.primary[100], disabled: p.gray[200] },
            border: { base: p.gray[300], hover: p.gray[400], active: p.brand.primary[isDark ? 400 : 500], disabled: p.gray[200] },
            text: { base: accent, hover: accentHover, active: p.foundation.white, disabled: p.gray[500] },
          }),
          radio: buildFieldStates({
            bg: { base: p.gray[isDark ? 100 : 50], hover: p.gray[200], active: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
            border: { base: p.gray[300], hover: p.gray[400], active: p.brand.primary[isDark ? 400 : 500], disabled: p.gray[200] },
            text: { base: accent, hover: accentHover, active: accentHover, disabled: p.gray[500] },
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
            border: { base: p.gray[300], hover: p.gray[400], active: accent, disabled: p.gray[200] },
            text: { base: p.gray[900], disabled: p.gray[500] },
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
            text: { base: p.gray[700], hover: p.gray[900], active: p.gray[900], disabled: p.gray[500] },
          }),
          icon: p.gray[600],
          label: p.gray[700],
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
            border: { base: p.gray[400], hover: p.gray[500], active: accentHover, disabled: p.gray[300] },
            text: { base: p.gray[700], hover: p.gray[800], active: p.foundation.white, disabled: p.gray[600] },
          }),
        },
      },
      
      nodes: {
        default: { background: p.gray[100], border: p.gray[300], shadow: `0 2px 4px rgba(0,0,0,${shadowAlpha * 0.75})` },
        selected: { background: p.gray[100], border: accent, shadow: `0 0 0 3px ${accentAnimated}` },
        dragging: { background: p.gray[100], border: accent, shadow: `0 10px 25px rgba(0,0,0,${deepShadowAlpha})` },
        header: { background: p.gray[200], text: p.gray[900], icon: p.gray[600] },
        content: { background: p.gray[100], text: p.gray[700] },
        handles: {
          input: { background: p.tools.preparation[500], border: p.tools.preparation[isDark ? 400 : 600], connected: accent },
          output: { background: p.tools.inout[500], border: p.tools.inout[isDark ? 400 : 600], connected: accent },
        },
      },
      
      edges: {
        default: { stroke: p.gray[isDark ? 400 : 500], strokeHover: p.gray[isDark ? 500 : 600] },
        selected: { stroke: accent, strokeHover: accentHover },
        animated: { stroke: accentAnimated, strokeHover: accentHover },
        invalid: { stroke: p.semantic.error[isDark ? 400 : 500], strokeHover: p.semantic.error[isDark ? 500 : 600] },
      },
      
      modals: {
        overlay: `rgba(0,0,0,${overlayAlpha})`,
        container: { background: p.gray[100], border: p.gray[300], shadow: `0 25px 50px rgba(0,0,0,${deepShadowAlpha + 0.2})` },
        header: { background: p.gray[200], border: p.gray[300], text: p.gray[900] },
        content: { background: p.gray[100], text: p.gray[700] },
        buttons: {
          primary: buildButtonStates({
            bg: { default: p.brand.primary[isDark ? 500 : 500], hover: p.brand.primary[isDark ? 400 : 600], active: p.brand.primary[isDark ? 600 : 700], disabled: p.gray[300] },
            border: { default: p.brand.primary[isDark ? 400 : 600], hover: p.brand.primary[isDark ? 300 : 700], active: p.brand.primary[isDark ? 500 : 800], disabled: p.gray[300] },
            text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[500] },
          }),
          secondary: buildButtonStates({
            bg: { default: p.gray[200], hover: p.gray[300], active: p.gray[400], disabled: p.gray[200] },
            border: { default: p.gray[400], hover: p.gray[500], active: p.gray[500], disabled: p.gray[300] },
            text: { default: p.gray[800], hover: p.gray[900], active: p.gray[950], disabled: p.gray[600] },
          }),
          cancel: buildButtonStates({
            bg: { default: p.foundation.transparent, hover: p.gray[300], active: p.gray[400], disabled: p.foundation.transparent },
            border: { default: p.foundation.transparent, hover: p.foundation.transparent, active: p.foundation.transparent, disabled: p.foundation.transparent },
            text: { default: p.gray[600], hover: p.gray[900], active: p.gray[950], disabled: p.gray[600] },
          }),
        },
      },
      
      notifications: {
        success: { background: p.semantic.success[100], border: p.semantic.success[isDark ? 200 : 400], text: p.semantic.success[800], icon: p.semantic.success[500] },
        warning: { background: p.semantic.warning[100], border: p.semantic.warning[isDark ? 200 : 400], text: p.semantic.warning[800], icon: p.semantic.warning[500] },
        error: { background: p.semantic.error[100], border: p.semantic.error[isDark ? 200 : 400], text: p.semantic.error[800], icon: p.semantic.error[500] },
        info: { background: p.semantic.info[100], border: p.semantic.info[isDark ? 200 : 400], text: p.semantic.info[800], icon: p.semantic.info[500] },
      },
      
      syntax: {
        tag: p.semantic.info[isDark ? 400 : 600],
        attribute: p.semantic.success[isDark ? 400 : 600],
        value: p.semantic.error[isDark ? 500 : 600],
        comment: p.semantic.success[600],
        declaration: p.brand.secondary[isDark ? 400 : 600],
        text: p.gray[800],
        background: p.gray[100],
        selection: p.brand.primary[isDark ? 200 : 100],
      },
      
      forms: {
        input: buildFieldStates({
          bg: { base: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
          border: { base: p.gray[300], hover: p.gray[400], active: accent, disabled: p.gray[200] },
          text: { base: p.gray[900], disabled: p.gray[500] },
          focusShadow: `0 0 0 3px ${p.brand.primary[isDark ? 900 : 100]}`,
        }),
        select: buildFieldStates({
          bg: { base: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
          border: { base: p.gray[300], hover: p.gray[400], active: accent, disabled: p.gray[200] },
          text: { base: p.gray[900], disabled: p.gray[500] },
        }),
        checkbox: buildFieldStates({
          bg: { base: p.gray[isDark ? 100 : 50], hover: p.gray[200], active: p.brand.primary[100], disabled: p.gray[200] },
          border: { base: p.gray[300], hover: p.gray[400], active: p.brand.primary[isDark ? 400 : 500], disabled: p.gray[200] },
          text: { base: accent, hover: accentHover, active: p.foundation.white, disabled: p.gray[500] },
        }),
        radio: buildFieldStates({
          bg: { base: p.gray[isDark ? 100 : 50], hover: p.gray[200], active: p.gray[isDark ? 100 : 50], disabled: p.gray[200] },
          border: { base: p.gray[300], hover: p.gray[400], active: p.brand.primary[isDark ? 400 : 500], disabled: p.gray[200] },
          text: { base: accent, hover: accentHover, active: accentHover, disabled: p.gray[500] },
        }),
        button: {
          primary: buildButtonStates({
            bg: { default: p.brand.primary[isDark ? 500 : 500], hover: p.brand.primary[isDark ? 400 : 600], active: p.brand.primary[isDark ? 600 : 700], disabled: p.gray[300] },
            border: { default: p.brand.primary[isDark ? 400 : 600], hover: p.brand.primary[isDark ? 300 : 700], active: p.brand.primary[isDark ? 500 : 800], disabled: p.gray[300] },
            text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[500] },
          }),
          secondary: buildButtonStates({
            bg: { default: p.gray[200], hover: p.gray[300], active: p.gray[400], disabled: p.gray[200] },
            border: { default: p.gray[400], hover: p.gray[500], active: p.gray[500], disabled: p.gray[300] },
            text: { default: p.gray[800], hover: p.gray[900], active: p.gray[950], disabled: p.gray[600] },
          }),
          tertiary: buildButtonStates({
            bg: { default: p.foundation.transparent, hover: p.gray[300], active: p.gray[400], disabled: p.foundation.transparent },
            border: { default: p.foundation.transparent, hover: p.foundation.transparent, active: p.foundation.transparent, disabled: p.foundation.transparent },
            text: { default: p.brand.primary[isDark ? 500 : 600], hover: p.brand.primary[isDark ? 400 : 700], active: p.brand.primary[isDark ? 600 : 800], disabled: p.gray[600] },
          }),
          danger: buildButtonStates({
            bg: { default: p.semantic.error[isDark ? 500 : 500], hover: p.semantic.error[isDark ? 400 : 600], active: p.semantic.error[isDark ? 600 : 700], disabled: p.gray[300] },
            border: { default: p.semantic.error[isDark ? 600 : 600], hover: p.semantic.error[isDark ? 500 : 700], active: p.semantic.error[isDark ? 700 : 800], disabled: p.gray[300] },
            text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[500] },
          }),
        },
        label: p.gray[700],
        helpText: p.gray[600],
        errorText: p.semantic.error[isDark ? 400 : 600],
        successText: p.semantic.success[isDark ? 400 : 600],
      },
    },
  };
}
