import { Theme } from '../types/theme';
import { darkPalette } from './palettes';
import { buildFieldStates, buildButtonStates } from './tokens/builders';
import { HEADER_BACKGROUND, BRAND_EDGE, BRAND_EDGE_HOVER_DARK, BRAND_EDGE_ANIMATED, BRAND_EDGE_ANIMATED_HOVER_DARK } from './tokens/constants';

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark Theme',
  description: 'Easy on the eyes for nighttime weaving',
  colors: {
    palette: darkPalette,
    surfaces: {
      page: darkPalette.gray[50],
      panel: darkPalette.gray[100],
      elevated: darkPalette.gray[200],
      overlay: 'rgba(0,0,0,0.65)',
      canvas: darkPalette.gray[100],
    },
    text: {
      primary: darkPalette.gray[900],
      secondary: darkPalette.gray[700],
      tertiary: darkPalette.gray[600],
      inverse: darkPalette.gray[100],
      disabled: darkPalette.gray[500],
    },
    borders: {
      primary: darkPalette.gray[300],
      secondary: darkPalette.gray[200],
      focus: darkPalette.brand.primary[500],
      divider: darkPalette.gray[200],
    },
  header: {
      background: HEADER_BACKGROUND,
      logo: { icon: '#fcd34d', text: '#ffffff' },
      title: { text: '#ffffff' },
  metadata: { text: '#ffffff', divider: '#6a5a86' },
      buttons: {
        new: {
          default: { background: darkPalette.semantic.success[500], border: darkPalette.semantic.success[600], text: darkPalette.foundation.white },
          hover: { background: darkPalette.semantic.success[600], border: darkPalette.semantic.success[700], text: darkPalette.foundation.white },
          active: { background: darkPalette.semantic.success[700], border: darkPalette.semantic.success[800], text: darkPalette.foundation.white },
          disabled: { background: darkPalette.gray[400], border: darkPalette.gray[400], text: darkPalette.gray[600] },
        },
        import: {
          default: { background: darkPalette.brand.primary[500], border: darkPalette.brand.primary[600], text: darkPalette.foundation.white },
          hover: { background: darkPalette.brand.primary[600], border: darkPalette.brand.primary[700], text: darkPalette.foundation.white },
            active: { background: darkPalette.brand.primary[700], border: darkPalette.brand.primary[800], text: darkPalette.foundation.white },
            disabled: { background: darkPalette.gray[400], border: darkPalette.gray[400], text: darkPalette.gray[600] },
        },
        export: {
          default: { background: darkPalette.gray[600], border: darkPalette.gray[700], text: darkPalette.foundation.white },
          hover: { background: darkPalette.gray[700], border: darkPalette.gray[800], text: darkPalette.foundation.white },
          active: { background: darkPalette.gray[800], border: darkPalette.gray[900], text: darkPalette.foundation.white },
          disabled: { background: darkPalette.gray[400], border: darkPalette.gray[400], text: darkPalette.gray[600] },
        },
        viewCode: {
          default: { background: darkPalette.brand.secondary[500], border: darkPalette.brand.secondary[600], text: darkPalette.foundation.white },
          hover: { background: darkPalette.brand.secondary[600], border: darkPalette.brand.secondary[700], text: darkPalette.foundation.white },
          active: { background: darkPalette.brand.secondary[700], border: darkPalette.brand.secondary[800], text: darkPalette.foundation.white },
          disabled: { background: darkPalette.gray[400], border: darkPalette.gray[400], text: darkPalette.gray[600] },
        },
        preview: {
          default: { background: darkPalette.semantic.info[500], border: darkPalette.semantic.info[600], text: darkPalette.foundation.white },
          hover: { background: darkPalette.semantic.info[600], border: darkPalette.semantic.info[700], text: darkPalette.foundation.white },
          active: { background: darkPalette.semantic.info[700], border: darkPalette.semantic.info[800], text: darkPalette.foundation.white },
          disabled: { background: darkPalette.gray[400], border: darkPalette.gray[400], text: darkPalette.gray[600] },
        },
        run: {
          default: { background: darkPalette.semantic.error[500], border: darkPalette.semantic.error[600], text: darkPalette.foundation.white },
          hover: { background: darkPalette.semantic.error[600], border: darkPalette.semantic.error[700], text: darkPalette.foundation.white },
          active: { background: darkPalette.semantic.error[700], border: darkPalette.semantic.error[800], text: darkPalette.foundation.white },
          disabled: { background: darkPalette.gray[400], border: darkPalette.gray[400], text: darkPalette.gray[600] },
        },
      },
  divider: '#6a5a86',
      themeSelector: {
        trigger: {
          default: { background: darkPalette.foundation.transparent, border: darkPalette.gray[300], text: darkPalette.gray[800] },
          hover: { background: darkPalette.gray[200], border: darkPalette.gray[400], text: darkPalette.gray[900] },
          active: { background: darkPalette.gray[300], border: darkPalette.gray[400], text: darkPalette.gray[900] },
          disabled: { background: darkPalette.foundation.transparent, border: darkPalette.gray[200], text: darkPalette.gray[500] },
        },
  dropdown: { background: darkPalette.gray[100], border: darkPalette.gray[300], shadow: '0 10px 25px rgba(0,0,0,0.5)' },
        option: {
          default: { background: darkPalette.foundation.transparent, border: darkPalette.foundation.transparent, text: darkPalette.gray[800] },
          hover: { background: darkPalette.gray[200], border: darkPalette.foundation.transparent, text: darkPalette.gray[900] },
          active: { background: darkPalette.brand.primary[100], border: darkPalette.foundation.transparent, text: darkPalette.brand.primary[600] },
          disabled: { background: darkPalette.foundation.transparent, border: darkPalette.foundation.transparent, text: darkPalette.gray[500] },
        },
      },
    },
    configPanel: {
      background: darkPalette.gray[100],
      border: darkPalette.gray[200],
      shadow: '0 4px 6px rgba(0,0,0,0.4)',
      header: { background: darkPalette.gray[200], border: darkPalette.gray[300], text: darkPalette.gray[900] },
      sections: { background: darkPalette.gray[100], border: darkPalette.gray[200], title: darkPalette.gray[900] },
      fields: {
        label: darkPalette.gray[700],
        input: buildFieldStates({
          bg: { base: darkPalette.gray[100], disabled: darkPalette.gray[200] },
          border: { base: darkPalette.gray[300], hover: darkPalette.gray[400], active: darkPalette.brand.primary[400], disabled: darkPalette.gray[200] },
          text: { base: darkPalette.gray[900], disabled: darkPalette.gray[500] },
          focusShadow: `0 0 0 3px ${darkPalette.brand.primary[900]}`,
        }),
        select: buildFieldStates({
          bg: { base: darkPalette.gray[100], disabled: darkPalette.gray[200] },
          border: { base: darkPalette.gray[300], hover: darkPalette.gray[400], active: darkPalette.brand.primary[400], disabled: darkPalette.gray[200] },
          text: { base: darkPalette.gray[900], disabled: darkPalette.gray[500] },
        }),
        checkbox: buildFieldStates({
          bg: { base: darkPalette.gray[100], hover: darkPalette.gray[200], active: darkPalette.brand.primary[100], disabled: darkPalette.gray[200] },
          border: { base: darkPalette.gray[300], hover: darkPalette.gray[400], active: darkPalette.brand.primary[300], disabled: darkPalette.gray[200] },
          text: { base: darkPalette.brand.primary[400], hover: darkPalette.brand.primary[500], active: darkPalette.foundation.white, disabled: darkPalette.gray[500] },
        }),
        radio: buildFieldStates({
          bg: { base: darkPalette.gray[100], hover: darkPalette.gray[200], active: darkPalette.gray[100], disabled: darkPalette.gray[200] },
          border: { base: darkPalette.gray[300], hover: darkPalette.gray[400], active: darkPalette.brand.primary[300], disabled: darkPalette.gray[200] },
          text: { base: darkPalette.brand.primary[400], hover: darkPalette.brand.primary[500], active: darkPalette.brand.primary[500], disabled: darkPalette.gray[500] },
        }),
      },
    },
    toolPalette: {
      background: darkPalette.gray[100],
      border: darkPalette.gray[200],
      shadow: '0 4px 6px rgba(0,0,0,0.4)',
      search: {
        input: buildFieldStates({
          bg: { base: darkPalette.gray[100], disabled: darkPalette.gray[200] },
          border: { base: darkPalette.gray[300], hover: darkPalette.gray[400], active: darkPalette.brand.primary[400], disabled: darkPalette.gray[200] },
          text: { base: darkPalette.gray[900], disabled: darkPalette.gray[500] },
          focusShadow: `0 0 0 3px ${darkPalette.brand.primary[900]}`,
        }),
        icon: darkPalette.gray[600],
      },
      categories: {
        header: { background: darkPalette.gray[200], text: darkPalette.gray[900], border: darkPalette.gray[300] },
        expanded: { background: darkPalette.gray[100] },
      },
      tools: {
        item: buildFieldStates({
          bg: { base: darkPalette.gray[100], hover: darkPalette.gray[200], active: darkPalette.brand.primary[100], disabled: darkPalette.gray[100] },
          border: { base: darkPalette.foundation.transparent, hover: darkPalette.gray[300], active: darkPalette.brand.primary[300], disabled: darkPalette.foundation.transparent },
          text: { base: darkPalette.gray[700], hover: darkPalette.gray[900], active: darkPalette.gray[900], disabled: darkPalette.gray[500] },
        }),
        icon: darkPalette.gray[600],
        label: darkPalette.gray[700],
        dragPreview: { background: darkPalette.gray[200], border: darkPalette.brand.primary[300], shadow: '0 10px 25px rgba(0,0,0,0.6)' },
      },
    },
    canvas: {
      background: darkPalette.gray[100],
      grid: { primary: darkPalette.gray[300], secondary: darkPalette.gray[200] },
      minimap: { background: darkPalette.gray[200], border: darkPalette.gray[300], viewport: BRAND_EDGE, mask: 'rgba(139,92,246,0.25)' },
      controls: {
        background: darkPalette.gray[100],
        border: darkPalette.gray[200],
        shadow: '0 2px 4px rgba(0,0,0,0.4)',
        button: buildFieldStates({
          bg: { base: darkPalette.gray[200], hover: darkPalette.gray[300], active: darkPalette.brand.primary[400], disabled: darkPalette.gray[200] },
          border: { base: darkPalette.gray[400], hover: darkPalette.gray[500], active: darkPalette.brand.primary[500], disabled: darkPalette.gray[300] },
          text: { base: darkPalette.gray[700], hover: darkPalette.gray[800], active: darkPalette.foundation.white, disabled: darkPalette.gray[600] },
        }),
      },
    },
    nodes: {
      default: { background: darkPalette.gray[100], border: darkPalette.gray[300], shadow: '0 2px 4px rgba(0,0,0,0.3)' },
      selected: { background: darkPalette.gray[100], border: BRAND_EDGE, shadow: `0 0 0 3px ${BRAND_EDGE_ANIMATED}` },
  dragging: { background: darkPalette.gray[100], border: BRAND_EDGE, shadow: '0 10px 25px rgba(0,0,0,0.6)' },
      header: { background: darkPalette.gray[200], text: darkPalette.gray[900], icon: darkPalette.gray[600] },
      content: { background: darkPalette.gray[100], text: darkPalette.gray[700] },
      handles: {
        input: { background: darkPalette.tools.preparation[500], border: darkPalette.tools.preparation[400], connected: BRAND_EDGE },
        output: { background: darkPalette.tools.inout[500], border: darkPalette.tools.inout[400], connected: BRAND_EDGE },
      },
    },
    edges: {
      default: { stroke: darkPalette.gray[400], strokeHover: darkPalette.gray[500] },
      selected: { stroke: BRAND_EDGE, strokeHover: BRAND_EDGE_HOVER_DARK },
      animated: { stroke: BRAND_EDGE_ANIMATED, strokeHover: BRAND_EDGE_ANIMATED_HOVER_DARK },
      invalid: { stroke: darkPalette.semantic.error[400], strokeHover: darkPalette.semantic.error[500] },
    },
    modals: {
      overlay: 'rgba(0,0,0,0.85)',
      container: { background: darkPalette.gray[100], border: darkPalette.gray[300], shadow: '0 25px 50px rgba(0,0,0,0.7)' },
      header: { background: darkPalette.gray[200], border: darkPalette.gray[300], text: darkPalette.gray[900] },
      content: { background: darkPalette.gray[100], text: darkPalette.gray[700] },
      buttons: {
        primary: buildButtonStates({
          bg: { default: darkPalette.brand.primary[600], hover: darkPalette.brand.primary[500], active: darkPalette.brand.primary[700], disabled: darkPalette.gray[300] },
          border: { default: darkPalette.brand.primary[500], hover: darkPalette.brand.primary[400], active: darkPalette.brand.primary[600], disabled: darkPalette.gray[300] },
          text: { default: darkPalette.foundation.white, hover: darkPalette.foundation.white, active: darkPalette.foundation.white, disabled: darkPalette.gray[500] },
        }),
        secondary: buildButtonStates({
          bg: { default: darkPalette.gray[200], hover: darkPalette.gray[300], active: darkPalette.gray[400], disabled: darkPalette.gray[200] },
          border: { default: darkPalette.gray[400], hover: darkPalette.gray[500], active: darkPalette.gray[500], disabled: darkPalette.gray[300] },
          text: { default: darkPalette.gray[800], hover: darkPalette.gray[900], active: darkPalette.gray[950], disabled: darkPalette.gray[600] },
        }),
        cancel: buildButtonStates({
          bg: { default: darkPalette.foundation.transparent, hover: darkPalette.gray[300], active: darkPalette.gray[400], disabled: darkPalette.foundation.transparent },
          border: { default: darkPalette.foundation.transparent, hover: darkPalette.foundation.transparent, active: darkPalette.foundation.transparent, disabled: darkPalette.foundation.transparent },
          text: { default: darkPalette.gray[600], hover: darkPalette.gray[900], active: darkPalette.gray[950], disabled: darkPalette.gray[600] },
        }),
      },
    },
    notifications: {
      success: { background: darkPalette.semantic.success[100], border: darkPalette.semantic.success[200], text: darkPalette.semantic.success[800], icon: darkPalette.semantic.success[500] },
      warning: { background: darkPalette.semantic.warning[100], border: darkPalette.semantic.warning[200], text: darkPalette.semantic.warning[800], icon: darkPalette.semantic.warning[500] },
      error: { background: darkPalette.semantic.error[100], border: darkPalette.semantic.error[200], text: darkPalette.semantic.error[800], icon: darkPalette.semantic.error[500] },
      info: { background: darkPalette.semantic.info[100], border: darkPalette.semantic.info[200], text: darkPalette.semantic.info[800], icon: darkPalette.semantic.info[500] },
    },
    syntax: {
      tag: darkPalette.semantic.info[400],
      attribute: darkPalette.semantic.success[400],
      value: darkPalette.semantic.error[500],
      comment: darkPalette.semantic.success[600],
      declaration: darkPalette.brand.secondary[400],
      text: darkPalette.gray[800],
      background: darkPalette.gray[100],
      selection: darkPalette.brand.primary[200],
    },
    forms: {
      input: buildFieldStates({
        bg: { base: darkPalette.gray[100], disabled: darkPalette.gray[200] },
        border: { base: darkPalette.gray[300], hover: darkPalette.gray[400], active: darkPalette.brand.primary[400], disabled: darkPalette.gray[200] },
        text: { base: darkPalette.gray[900], disabled: darkPalette.gray[500] },
        focusShadow: `0 0 0 3px ${darkPalette.brand.primary[900]}`,
      }),
      select: buildFieldStates({
        bg: { base: darkPalette.gray[100], disabled: darkPalette.gray[200] },
        border: { base: darkPalette.gray[300], hover: darkPalette.gray[400], active: darkPalette.brand.primary[400], disabled: darkPalette.gray[200] },
        text: { base: darkPalette.gray[900], disabled: darkPalette.gray[500] },
      }),
      checkbox: buildFieldStates({
        bg: { base: darkPalette.gray[100], hover: darkPalette.gray[200], active: darkPalette.brand.primary[100], disabled: darkPalette.gray[200] },
        border: { base: darkPalette.gray[300], hover: darkPalette.gray[400], active: darkPalette.brand.primary[300], disabled: darkPalette.gray[200] },
        text: { base: darkPalette.brand.primary[400], hover: darkPalette.brand.primary[500], active: darkPalette.foundation.white, disabled: darkPalette.gray[500] },
      }),
      radio: buildFieldStates({
        bg: { base: darkPalette.gray[100], hover: darkPalette.gray[200], active: darkPalette.gray[100], disabled: darkPalette.gray[200] },
        border: { base: darkPalette.gray[300], hover: darkPalette.gray[400], active: darkPalette.brand.primary[300], disabled: darkPalette.gray[200] },
        text: { base: darkPalette.brand.primary[400], hover: darkPalette.brand.primary[500], active: darkPalette.brand.primary[500], disabled: darkPalette.gray[500] },
      }),
      button: {
        primary: buildButtonStates({
          bg: { default: darkPalette.brand.primary[600], hover: darkPalette.brand.primary[500], active: darkPalette.brand.primary[700], disabled: darkPalette.gray[300] },
          border: { default: darkPalette.brand.primary[500], hover: darkPalette.brand.primary[400], active: darkPalette.brand.primary[600], disabled: darkPalette.gray[300] },
          text: { default: darkPalette.foundation.white, hover: darkPalette.foundation.white, active: darkPalette.foundation.white, disabled: darkPalette.gray[500] },
        }),
        secondary: buildButtonStates({
          bg: { default: darkPalette.gray[200], hover: darkPalette.gray[300], active: darkPalette.gray[400], disabled: darkPalette.gray[200] },
          border: { default: darkPalette.gray[400], hover: darkPalette.gray[500], active: darkPalette.gray[500], disabled: darkPalette.gray[300] },
          text: { default: darkPalette.gray[800], hover: darkPalette.gray[900], active: darkPalette.gray[950], disabled: darkPalette.gray[600] },
        }),
        tertiary: buildButtonStates({
          bg: { default: darkPalette.foundation.transparent, hover: darkPalette.gray[300], active: darkPalette.gray[400], disabled: darkPalette.foundation.transparent },
          border: { default: darkPalette.foundation.transparent, hover: darkPalette.foundation.transparent, active: darkPalette.foundation.transparent, disabled: darkPalette.foundation.transparent },
          text: { default: darkPalette.brand.primary[500], hover: darkPalette.brand.primary[600], active: darkPalette.brand.primary[700], disabled: darkPalette.gray[600] },
        }),
        danger: buildButtonStates({
          bg: { default: darkPalette.semantic.error[600], hover: darkPalette.semantic.error[500], active: darkPalette.semantic.error[700], disabled: darkPalette.gray[300] },
          border: { default: darkPalette.semantic.error[700], hover: darkPalette.semantic.error[600], active: darkPalette.semantic.error[800], disabled: darkPalette.gray[300] },
          text: { default: darkPalette.foundation.white, hover: darkPalette.foundation.white, active: darkPalette.foundation.white, disabled: darkPalette.gray[500] },
        }),
      },
      label: darkPalette.gray[700],
      helpText: darkPalette.gray[600],
      errorText: darkPalette.semantic.error[400],
      successText: darkPalette.semantic.success[400],
    },
  },
};
