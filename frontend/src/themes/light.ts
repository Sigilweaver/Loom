import { Theme } from '../types/theme';
import { lightPalette } from './palettes';
import { buildFieldStates, buildButtonStates } from './tokens/builders';
import { HEADER_BACKGROUND, BRAND_EDGE, BRAND_EDGE_HOVER_LIGHT, BRAND_EDGE_ANIMATED, BRAND_EDGE_ANIMATED_HOVER_LIGHT } from './tokens/constants';

export const lightTheme: Theme = {
  id: 'light',
  name: 'Light Theme',
  description: 'Clean and bright theme for daytime use',
  colors: {
    palette: lightPalette,
    surfaces: {
      page: lightPalette.foundation.white,
      panel: lightPalette.gray[50],
      elevated: lightPalette.foundation.white,
      overlay: 'rgba(0, 0, 0, 0.5)',
      canvas: lightPalette.gray[50],
    },
    text: {
      primary: lightPalette.gray[900],
      secondary: lightPalette.gray[700],
      tertiary: lightPalette.gray[500],
      inverse: lightPalette.foundation.white,
      disabled: lightPalette.gray[400],
    },
    borders: {
      primary: lightPalette.gray[200],
      secondary: lightPalette.gray[100],
      focus: lightPalette.brand.primary[500],
      divider: lightPalette.gray[200],
    },
    header: {
      background: HEADER_BACKGROUND,
      logo: { icon: '#fcd34d', text: '#ffffff' },
      title: { text: '#ffffff' },
  metadata: { text: '#ffffff', divider: '#6a5a86' },
      buttons: {
        new: {
          default: { background: lightPalette.semantic.success[500], border: lightPalette.semantic.success[600], text: lightPalette.foundation.white },
          hover: { background: lightPalette.semantic.success[600], border: lightPalette.semantic.success[700], text: lightPalette.foundation.white },
          active: { background: lightPalette.semantic.success[700], border: lightPalette.semantic.success[800], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[600] },
        },
        import: {
          default: { background: lightPalette.brand.primary[500], border: lightPalette.brand.primary[600], text: lightPalette.foundation.white },
          hover: { background: lightPalette.brand.primary[600], border: lightPalette.brand.primary[700], text: lightPalette.foundation.white },
            active: { background: lightPalette.brand.primary[700], border: lightPalette.brand.primary[800], text: lightPalette.foundation.white },
            disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[600] },
        },
        export: {
          default: { background: lightPalette.gray[600], border: lightPalette.gray[700], text: lightPalette.foundation.white },
          hover: { background: lightPalette.gray[700], border: lightPalette.gray[800], text: lightPalette.foundation.white },
          active: { background: lightPalette.gray[800], border: lightPalette.gray[900], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[600] },
        },
        viewCode: {
          default: { background: lightPalette.brand.secondary[500], border: lightPalette.brand.secondary[600], text: lightPalette.foundation.white },
          hover: { background: lightPalette.brand.secondary[600], border: lightPalette.brand.secondary[700], text: lightPalette.foundation.white },
          active: { background: lightPalette.brand.secondary[700], border: lightPalette.brand.secondary[800], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[600] },
        },
        preview: {
          default: { background: lightPalette.semantic.info[500], border: lightPalette.semantic.info[600], text: lightPalette.foundation.white },
          hover: { background: lightPalette.semantic.info[600], border: lightPalette.semantic.info[700], text: lightPalette.foundation.white },
          active: { background: lightPalette.semantic.info[700], border: lightPalette.semantic.info[800], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[600] },
        },
        run: {
          default: { background: lightPalette.semantic.error[500], border: lightPalette.semantic.error[600], text: lightPalette.foundation.white },
          hover: { background: lightPalette.semantic.error[600], border: lightPalette.semantic.error[700], text: lightPalette.foundation.white },
          active: { background: lightPalette.semantic.error[700], border: lightPalette.semantic.error[800], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[600] },
        },
      },
      divider: lightPalette.gray[600],
      themeSelector: {
        trigger: {
          default: { background: lightPalette.foundation.transparent, border: lightPalette.gray[600], text: lightPalette.foundation.white },
          hover: { background: lightPalette.gray[800], border: lightPalette.gray[500], text: lightPalette.foundation.white },
          active: { background: lightPalette.gray[700], border: lightPalette.gray[500], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.foundation.transparent, border: lightPalette.gray[700], text: lightPalette.gray[600] },
        },
        dropdown: { background: lightPalette.foundation.white, border: lightPalette.gray[200], shadow: '0 10px 25px rgba(0, 0, 0, 0.15)' },
        option: {
          default: { background: lightPalette.foundation.transparent, border: lightPalette.foundation.transparent, text: lightPalette.gray[900] },
          hover: { background: lightPalette.gray[50], border: lightPalette.foundation.transparent, text: lightPalette.gray[900] },
          active: { background: lightPalette.brand.primary[50], border: lightPalette.foundation.transparent, text: lightPalette.brand.primary[900] },
          disabled: { background: lightPalette.foundation.transparent, border: lightPalette.foundation.transparent, text: lightPalette.gray[400] },
        },
      },
    },
    configPanel: {
      background: lightPalette.foundation.white,
      border: lightPalette.gray[200],
      shadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      header: { background: lightPalette.gray[50], border: lightPalette.gray[200], text: lightPalette.gray[900] },
      sections: { background: lightPalette.foundation.white, border: lightPalette.gray[200], title: lightPalette.gray[900] },
      fields: {
        label: lightPalette.gray[700],
        input: {
          default: { background: lightPalette.foundation.white, border: lightPalette.gray[300], text: lightPalette.gray[900] },
          hover: { background: lightPalette.foundation.white, border: lightPalette.gray[400], text: lightPalette.gray[900] },
          active: { background: lightPalette.foundation.white, border: lightPalette.brand.primary[500], text: lightPalette.gray[900] },
          disabled: { background: lightPalette.gray[50], border: lightPalette.gray[200], text: lightPalette.gray[500] },
          focus: { background: lightPalette.foundation.white, border: lightPalette.brand.primary[500], text: lightPalette.gray[900], shadow: `0 0 0 3px ${lightPalette.brand.primary[100]}` },
        },
        select: {
          default: { background: lightPalette.foundation.white, border: lightPalette.gray[300], text: lightPalette.gray[900] },
          hover: { background: lightPalette.foundation.white, border: lightPalette.gray[400], text: lightPalette.gray[900] },
          active: { background: lightPalette.foundation.white, border: lightPalette.brand.primary[500], text: lightPalette.gray[900] },
          disabled: { background: lightPalette.gray[50], border: lightPalette.gray[200], text: lightPalette.gray[500] },
        },
        checkbox: {
          default: { background: lightPalette.foundation.white, border: lightPalette.gray[300], text: lightPalette.brand.primary[500] },
          hover: { background: lightPalette.gray[50], border: lightPalette.gray[400], text: lightPalette.brand.primary[600] },
          active: { background: lightPalette.brand.primary[500], border: lightPalette.brand.primary[500], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[50], border: lightPalette.gray[200], text: lightPalette.gray[400] },
        },
        radio: {
          default: { background: lightPalette.foundation.white, border: lightPalette.gray[300], text: lightPalette.brand.primary[500] },
          hover: { background: lightPalette.gray[50], border: lightPalette.gray[400], text: lightPalette.brand.primary[600] },
          active: { background: lightPalette.foundation.white, border: lightPalette.brand.primary[500], text: lightPalette.brand.primary[500] },
          disabled: { background: lightPalette.gray[50], border: lightPalette.gray[200], text: lightPalette.gray[400] },
        },
      },
    },
    toolPalette: {
      background: lightPalette.foundation.white,
      border: lightPalette.gray[200],
      shadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      search: {
        input: buildFieldStates({
          bg: { base: lightPalette.foundation.white, disabled: lightPalette.gray[50] },
          border: { base: lightPalette.gray[300], hover: lightPalette.gray[400], active: lightPalette.brand.primary[500], disabled: lightPalette.gray[200] },
          text: { base: lightPalette.gray[900], disabled: lightPalette.gray[500] },
          focusShadow: `0 0 0 3px ${lightPalette.brand.primary[100]}`,
        }),
        icon: lightPalette.gray[400],
      },
      categories: { header: { background: lightPalette.gray[50], text: lightPalette.gray[900], border: lightPalette.gray[200] }, expanded: { background: lightPalette.foundation.white } },
      tools: {
        item: buildFieldStates({
          bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[50], active: lightPalette.brand.primary[50], disabled: lightPalette.foundation.white },
          border: { base: lightPalette.foundation.transparent, hover: lightPalette.gray[200], active: lightPalette.brand.primary[200], disabled: lightPalette.foundation.transparent },
          text: { base: lightPalette.gray[700], hover: lightPalette.gray[900], active: lightPalette.gray[900], disabled: lightPalette.gray[400] },
        }),
        icon: lightPalette.gray[600],
        label: lightPalette.gray[700],
        dragPreview: { background: lightPalette.foundation.white, border: lightPalette.brand.primary[300], shadow: '0 10px 25px rgba(0, 0, 0, 0.15)' },
      },
    },
    canvas: {
      background: lightPalette.gray[50],
      grid: { primary: lightPalette.gray[200], secondary: lightPalette.gray[100] },
  minimap: { background: lightPalette.foundation.white, border: lightPalette.gray[200], viewport: BRAND_EDGE, mask: 'rgba(139, 92, 246, 0.3)' },
      controls: {
        background: lightPalette.foundation.white,
        border: lightPalette.gray[200],
        shadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        button: buildFieldStates({
          bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[50], active: lightPalette.brand.primary[500], disabled: lightPalette.gray[100] },
          border: { base: lightPalette.gray[200], hover: lightPalette.gray[300], active: lightPalette.brand.primary[600], disabled: lightPalette.gray[200] },
          text: { base: lightPalette.gray[600], hover: lightPalette.gray[700], active: lightPalette.foundation.white, disabled: lightPalette.gray[400] },
        }),
      },
    },
    nodes: {
      default: { background: lightPalette.foundation.white, border: lightPalette.gray[200], shadow: '0 2px 4px rgba(0, 0, 0, 0.05)' },
  selected: { background: lightPalette.foundation.white, border: BRAND_EDGE, shadow: `0 0 0 3px ${BRAND_EDGE_ANIMATED}` },
  dragging: { background: lightPalette.foundation.white, border: BRAND_EDGE, shadow: '0 10px 25px rgba(0, 0, 0, 0.15)' },
      header: { background: lightPalette.gray[50], text: lightPalette.gray[900], icon: lightPalette.gray[600] },
      content: { background: lightPalette.foundation.white, text: lightPalette.gray[700] },
      handles: {
  input: { background: lightPalette.tools.preparation[500], border: lightPalette.tools.preparation[600], connected: BRAND_EDGE },
  output: { background: lightPalette.tools.inout[500], border: lightPalette.tools.inout[600], connected: BRAND_EDGE },
      },
    },
    edges: {
      default: { stroke: lightPalette.gray[700], strokeHover: lightPalette.gray[800] },
      selected: { stroke: BRAND_EDGE, strokeHover: BRAND_EDGE_HOVER_LIGHT },
      animated: { stroke: BRAND_EDGE_ANIMATED, strokeHover: BRAND_EDGE_ANIMATED_HOVER_LIGHT },
      invalid: { stroke: lightPalette.semantic.error[600], strokeHover: lightPalette.semantic.error[700] },
    },
    modals: {
      overlay: 'rgba(0, 0, 0, 0.5)',
      container: { background: lightPalette.foundation.white, border: lightPalette.gray[200], shadow: '0 25px 50px rgba(0, 0, 0, 0.25)' },
      header: { background: lightPalette.gray[50], border: lightPalette.gray[200], text: lightPalette.gray[900] },
      content: { background: lightPalette.foundation.white, text: lightPalette.gray[700] },
      buttons: {
        primary: buildButtonStates({
          bg: { default: lightPalette.brand.primary[500], hover: lightPalette.brand.primary[600], active: lightPalette.brand.primary[700], disabled: lightPalette.gray[300] },
          border: { default: lightPalette.brand.primary[600], hover: lightPalette.brand.primary[700], active: lightPalette.brand.primary[800], disabled: lightPalette.gray[300] },
          text: { default: lightPalette.foundation.white, hover: lightPalette.foundation.white, active: lightPalette.foundation.white, disabled: lightPalette.gray[500] },
        }),
        secondary: buildButtonStates({
          bg: { default: lightPalette.foundation.white, hover: lightPalette.gray[50], active: lightPalette.gray[100], disabled: lightPalette.gray[50] },
          border: { default: lightPalette.gray[300], hover: lightPalette.gray[400], active: lightPalette.gray[400], disabled: lightPalette.gray[200] },
          text: { default: lightPalette.gray[700], hover: lightPalette.gray[900], active: lightPalette.gray[900], disabled: lightPalette.gray[400] },
        }),
        cancel: buildButtonStates({
          bg: { default: lightPalette.foundation.transparent, hover: lightPalette.gray[50], active: lightPalette.gray[100], disabled: lightPalette.foundation.transparent },
          border: { default: lightPalette.foundation.transparent, hover: lightPalette.foundation.transparent, active: lightPalette.foundation.transparent, disabled: lightPalette.foundation.transparent },
          text: { default: lightPalette.gray[600], hover: lightPalette.gray[900], active: lightPalette.gray[900], disabled: lightPalette.gray[400] },
        }),
      },
    },
    notifications: {
      success: { background: lightPalette.semantic.success[50], border: lightPalette.semantic.success[200], text: lightPalette.semantic.success[800], icon: lightPalette.semantic.success[600] },
      warning: { background: lightPalette.semantic.warning[50], border: lightPalette.semantic.warning[200], text: lightPalette.semantic.warning[800], icon: lightPalette.semantic.warning[600] },
      error: { background: lightPalette.semantic.error[50], border: lightPalette.semantic.error[200], text: lightPalette.semantic.error[800], icon: lightPalette.semantic.error[600] },
      info: { background: lightPalette.semantic.info[50], border: lightPalette.semantic.info[200], text: lightPalette.semantic.info[800], icon: lightPalette.semantic.info[600] },
    },
    syntax: {
      tag: lightPalette.semantic.info[700],
      attribute: lightPalette.semantic.success[700],
      value: lightPalette.semantic.error[600],
      comment: lightPalette.semantic.success[500],
      declaration: lightPalette.brand.secondary[700],
      text: lightPalette.gray[900],
      background: lightPalette.gray[50],
      selection: lightPalette.brand.primary[100],
    },
    forms: {
      input: buildFieldStates({
        bg: { base: lightPalette.foundation.white, disabled: lightPalette.gray[50] },
        border: { base: lightPalette.gray[300], hover: lightPalette.gray[400], active: lightPalette.brand.primary[500], disabled: lightPalette.gray[200] },
        text: { base: lightPalette.gray[900], disabled: lightPalette.gray[500] },
        focusShadow: `0 0 0 3px ${lightPalette.brand.primary[100]}`,
      }),
      select: buildFieldStates({
        bg: { base: lightPalette.foundation.white, disabled: lightPalette.gray[50] },
        border: { base: lightPalette.gray[300], hover: lightPalette.gray[400], active: lightPalette.brand.primary[500], disabled: lightPalette.gray[200] },
        text: { base: lightPalette.gray[900], disabled: lightPalette.gray[500] },
      }),
      checkbox: buildFieldStates({
        bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[50], active: lightPalette.brand.primary[500], disabled: lightPalette.gray[50] },
        border: { base: lightPalette.gray[300], hover: lightPalette.gray[400], active: lightPalette.brand.primary[500], disabled: lightPalette.gray[200] },
        text: { base: lightPalette.brand.primary[500], hover: lightPalette.brand.primary[600], active: lightPalette.foundation.white, disabled: lightPalette.gray[400] },
      }),
      radio: buildFieldStates({
        bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[50], active: lightPalette.foundation.white, disabled: lightPalette.gray[50] },
        border: { base: lightPalette.gray[300], hover: lightPalette.gray[400], active: lightPalette.brand.primary[500], disabled: lightPalette.gray[200] },
        text: { base: lightPalette.brand.primary[500], hover: lightPalette.brand.primary[600], active: lightPalette.brand.primary[500], disabled: lightPalette.gray[400] },
      }),
      button: {
        primary: buildButtonStates({
          bg: { default: lightPalette.brand.primary[500], hover: lightPalette.brand.primary[600], active: lightPalette.brand.primary[700], disabled: lightPalette.gray[300] },
          border: { default: lightPalette.brand.primary[600], hover: lightPalette.brand.primary[700], active: lightPalette.brand.primary[800], disabled: lightPalette.gray[300] },
          text: { default: lightPalette.foundation.white, hover: lightPalette.foundation.white, active: lightPalette.foundation.white, disabled: lightPalette.gray[500] },
        }),
        secondary: buildButtonStates({
          bg: { default: lightPalette.foundation.white, hover: lightPalette.gray[50], active: lightPalette.gray[100], disabled: lightPalette.gray[50] },
          border: { default: lightPalette.gray[300], hover: lightPalette.gray[400], active: lightPalette.gray[400], disabled: lightPalette.gray[200] },
          text: { default: lightPalette.gray[700], hover: lightPalette.gray[900], active: lightPalette.gray[900], disabled: lightPalette.gray[400] },
        }),
        tertiary: buildButtonStates({
          bg: { default: lightPalette.foundation.transparent, hover: lightPalette.brand.primary[50], active: lightPalette.brand.primary[100], disabled: lightPalette.foundation.transparent },
          border: { default: lightPalette.foundation.transparent, hover: lightPalette.foundation.transparent, active: lightPalette.foundation.transparent, disabled: lightPalette.foundation.transparent },
          text: { default: lightPalette.brand.primary[600], hover: lightPalette.brand.primary[700], active: lightPalette.brand.primary[800], disabled: lightPalette.gray[400] },
        }),
        danger: buildButtonStates({
          bg: { default: lightPalette.semantic.error[500], hover: lightPalette.semantic.error[600], active: lightPalette.semantic.error[700], disabled: lightPalette.gray[300] },
          border: { default: lightPalette.semantic.error[600], hover: lightPalette.semantic.error[700], active: lightPalette.semantic.error[800], disabled: lightPalette.gray[300] },
          text: { default: lightPalette.foundation.white, hover: lightPalette.foundation.white, active: lightPalette.foundation.white, disabled: lightPalette.gray[500] },
        }),
      },
      label: lightPalette.gray[700],
      helpText: lightPalette.gray[600],
      errorText: lightPalette.semantic.error[600],
      successText: lightPalette.semantic.success[600],
    },
  },
};
