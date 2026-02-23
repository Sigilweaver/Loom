import { Theme } from '../../types/theme';
import { lightPalette } from '../palettes';
import { buildFieldStates, buildButtonStates } from '../tokens/builders';

export const highContrastTheme: Theme = {
  id: 'high-contrast',
  name: 'High Contrast',
  description: 'Maximum contrast for accessibility',
  colors: {
    palette: lightPalette,
    surfaces: {
      page: lightPalette.foundation.white,
      panel: lightPalette.foundation.white,
      elevated: lightPalette.foundation.white,
      overlay: 'rgba(0, 0, 0, 0.8)',
      canvas: lightPalette.foundation.white,
    },
    text: {
      primary: lightPalette.foundation.black,
      secondary: lightPalette.foundation.black,
      tertiary: lightPalette.gray[700],
      inverse: lightPalette.foundation.white,
      disabled: lightPalette.gray[500],
    },
    borders: {
      primary: lightPalette.foundation.black,
      secondary: lightPalette.gray[700],
      focus: '#0066cc',
      divider: lightPalette.foundation.black,
    },
    header: {
      background: lightPalette.foundation.black,
      logo: { icon: lightPalette.foundation.white, text: lightPalette.foundation.white },
      title: { text: lightPalette.foundation.white },
      metadata: { text: lightPalette.gray[400], divider: lightPalette.gray[600] },
      buttons: {
        // Intent-based hierarchy: Run=primary, Preview=secondary, rest=neutral
        new: {
          default: { background: lightPalette.gray[600], border: lightPalette.gray[700], text: lightPalette.foundation.white },
          hover: { background: lightPalette.gray[700], border: lightPalette.gray[800], text: lightPalette.foundation.white },
          active: { background: lightPalette.gray[800], border: lightPalette.gray[900], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[700] },
        },
        import: {
          default: { background: lightPalette.gray[600], border: lightPalette.gray[700], text: lightPalette.foundation.white },
          hover: { background: lightPalette.gray[700], border: lightPalette.gray[800], text: lightPalette.foundation.white },
          active: { background: lightPalette.gray[800], border: lightPalette.gray[900], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[700] },
        },
        export: {
          default: { background: lightPalette.gray[600], border: lightPalette.gray[700], text: lightPalette.foundation.white },
          hover: { background: lightPalette.gray[700], border: lightPalette.gray[800], text: lightPalette.foundation.white },
          active: { background: lightPalette.gray[800], border: lightPalette.gray[900], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[700] },
        },
        viewCode: {
          default: { background: lightPalette.gray[600], border: lightPalette.gray[700], text: lightPalette.foundation.white },
          hover: { background: lightPalette.gray[700], border: lightPalette.gray[800], text: lightPalette.foundation.white },
          active: { background: lightPalette.gray[800], border: lightPalette.gray[900], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[700] },
        },
        preview: {
          default: { background: lightPalette.gray[500], border: lightPalette.gray[600], text: lightPalette.foundation.white },
          hover: { background: lightPalette.gray[600], border: lightPalette.gray[700], text: lightPalette.foundation.white },
          active: { background: lightPalette.gray[700], border: lightPalette.gray[800], text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[700] },
        },
        run: {
          default: { background: '#004499', border: '#002266', text: lightPalette.foundation.white },
          hover: { background: '#0066cc', border: '#004499', text: lightPalette.foundation.white },
          active: { background: '#002266', border: '#001133', text: lightPalette.foundation.white },
          disabled: { background: lightPalette.gray[400], border: lightPalette.gray[400], text: lightPalette.gray[700] },
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
        dropdown: { background: lightPalette.foundation.white, border: lightPalette.foundation.black, shadow: '0 10px 25px rgba(0,0,0,0.5)' },
        option: {
          default: { background: lightPalette.foundation.transparent, border: lightPalette.foundation.transparent, text: lightPalette.foundation.black },
          hover: { background: lightPalette.gray[100], border: lightPalette.foundation.transparent, text: lightPalette.foundation.black },
          active: { background: '#0066cc', border: lightPalette.foundation.transparent, text: lightPalette.foundation.white },
          disabled: { background: lightPalette.foundation.transparent, border: lightPalette.foundation.transparent, text: lightPalette.gray[500] },
        },
      },
    },
    configPanel: {
      background: lightPalette.foundation.white,
      border: lightPalette.foundation.black,
      shadow: '0 4px 6px rgba(0,0,0,0.2)',
      header: { background: lightPalette.gray[100], border: lightPalette.foundation.black, text: lightPalette.foundation.black },
      sections: { background: lightPalette.foundation.white, border: lightPalette.foundation.black, title: lightPalette.foundation.black },
      fields: {
        label: lightPalette.foundation.black,
        input: buildFieldStates({
          bg: { base: lightPalette.foundation.white, disabled: lightPalette.gray[100] },
          border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.gray[400] },
          text: { base: lightPalette.foundation.black, disabled: lightPalette.gray[500] },
          focusShadow: '0 0 0 3px #cceeff',
        }),
        select: buildFieldStates({
          bg: { base: lightPalette.foundation.white, disabled: lightPalette.gray[100] },
          border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.gray[400] },
          text: { base: lightPalette.foundation.black, disabled: lightPalette.gray[500] },
        }),
        checkbox: buildFieldStates({
          bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[50], active: '#0066cc', disabled: lightPalette.gray[100] },
          border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.gray[400] },
          text: { base: '#0066cc', hover: '#0066cc', active: lightPalette.foundation.white, disabled: lightPalette.gray[500] },
        }),
        radio: buildFieldStates({
          bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[50], active: lightPalette.foundation.white, disabled: lightPalette.gray[100] },
          border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.gray[400] },
          text: { base: '#0066cc', hover: '#0066cc', active: '#0066cc', disabled: lightPalette.gray[500] },
        }),
      },
    },
    toolPalette: {
      background: lightPalette.foundation.white,
      border: lightPalette.foundation.black,
      shadow: '0 4px 6px rgba(0,0,0,0.2)',
      search: {
        input: buildFieldStates({
          bg: { base: lightPalette.foundation.white, disabled: lightPalette.gray[100] },
          border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.gray[400] },
          text: { base: lightPalette.foundation.black, disabled: lightPalette.gray[500] },
          focusShadow: '0 0 0 3px #cceeff',
        }),
        icon: lightPalette.gray[600],
      },
      categories: {
        header: { background: lightPalette.gray[100], text: lightPalette.foundation.black, border: lightPalette.foundation.black },
        expanded: { background: lightPalette.foundation.white },
      },
      tools: {
        item: buildFieldStates({
          bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[100], active: '#cceeff', disabled: lightPalette.foundation.white },
          border: { base: lightPalette.foundation.transparent, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.foundation.transparent },
          text: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: lightPalette.foundation.black, disabled: lightPalette.gray[500] },
        }),
        icon: lightPalette.gray[700],
        label: lightPalette.foundation.black,
        dragPreview: { background: lightPalette.foundation.white, border: '#0066cc', shadow: '0 10px 25px rgba(0,0,0,0.5)' },
      },
    },
    canvas: {
      background: lightPalette.foundation.white,
      grid: { primary: lightPalette.foundation.black, secondary: lightPalette.gray[700] },
      minimap: { background: lightPalette.foundation.white, border: lightPalette.foundation.black, viewport: '#0066cc', mask: 'rgba(0,102,204,0.4)' },
      controls: {
        background: lightPalette.foundation.white,
        border: lightPalette.foundation.black,
        shadow: '0 2px 4px rgba(0,0,0,0.3)',
        button: buildFieldStates({
          bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[100], active: '#0066cc', disabled: lightPalette.gray[200] },
          border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#004499', disabled: lightPalette.gray[400] },
          text: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: lightPalette.foundation.white, disabled: lightPalette.gray[500] },
        }),
      },
    },
    nodes: {
      default: { background: lightPalette.foundation.white, border: lightPalette.foundation.black, shadow: '0 2px 4px rgba(0,0,0,0.2)' },
      selected: { background: lightPalette.foundation.white, border: '#0066cc', shadow: '0 0 0 3px #cceeff' },
      dragging: { background: lightPalette.foundation.white, border: '#0066cc', shadow: '0 10px 25px rgba(0,0,0,0.5)' },
      header: { background: lightPalette.gray[100], text: lightPalette.foundation.black, icon: lightPalette.foundation.black },
      content: { background: lightPalette.foundation.white, text: lightPalette.foundation.black },
      handles: {
        input: { background: '#0066cc', border: '#004499', connected: '#002266' },
        output: { background: '#006600', border: '#004400', connected: '#002200' },
      },
    },
    edges: {
      default: { stroke: lightPalette.foundation.black, strokeHover: lightPalette.foundation.black },
      selected: { stroke: '#0066cc', strokeHover: '#0066cc' },
      animated: { stroke: '#6600cc', strokeHover: '#6600cc' },
      invalid: { stroke: '#cc0000', strokeHover: '#cc0000' },
    },
    modals: {
      overlay: 'rgba(0, 0, 0, 0.8)',
      container: { background: lightPalette.foundation.white, border: lightPalette.foundation.black, shadow: '0 25px 50px rgba(0,0,0,0.5)' },
      header: { background: lightPalette.gray[100], border: lightPalette.foundation.black, text: lightPalette.foundation.black },
      content: { background: lightPalette.foundation.white, text: lightPalette.foundation.black },
      buttons: {
        primary: buildButtonStates({
          bg: { default: '#004499', hover: '#0066cc', active: '#002266', disabled: lightPalette.gray[400] },
          border: { default: '#002266', hover: '#004499', active: '#001133', disabled: lightPalette.gray[400] },
          text: { default: lightPalette.foundation.white, hover: lightPalette.foundation.white, active: lightPalette.foundation.white, disabled: lightPalette.gray[700] },
        }),
        secondary: buildButtonStates({
          bg: { default: lightPalette.foundation.white, hover: lightPalette.gray[100], active: lightPalette.gray[200], disabled: lightPalette.gray[100] },
          border: { default: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: lightPalette.foundation.black, disabled: lightPalette.gray[400] },
          text: { default: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: lightPalette.foundation.black, disabled: lightPalette.gray[500] },
        }),
        cancel: buildButtonStates({
          bg: { default: lightPalette.foundation.transparent, hover: lightPalette.gray[100], active: lightPalette.gray[200], disabled: lightPalette.foundation.transparent },
          border: { default: lightPalette.foundation.transparent, hover: lightPalette.foundation.transparent, active: lightPalette.foundation.transparent, disabled: lightPalette.foundation.transparent },
          text: { default: lightPalette.gray[600], hover: lightPalette.foundation.black, active: lightPalette.foundation.black, disabled: lightPalette.gray[500] },
        }),
      },
    },
    notifications: {
      success: { background: '#eeffee', border: '#006600', text: '#004400', icon: '#006600' },
      warning: { background: '#fffaee', border: '#cc6600', text: '#aa4400', icon: '#cc6600' },
      error: { background: '#ffeeee', border: '#cc0000', text: '#990000', icon: '#cc0000' },
      info: { background: '#eeeeff', border: '#0066cc', text: '#004499', icon: '#0066cc' },
    },
    syntax: {
      tag: '#0066cc', attribute: '#006600', value: '#cc0000', comment: '#666666', declaration: '#6600cc', text: lightPalette.foundation.black, background: lightPalette.foundation.white, selection: '#cceeff',
    },
    forms: {
      input: buildFieldStates({
        bg: { base: lightPalette.foundation.white, disabled: lightPalette.gray[100] },
        border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.gray[400] },
        text: { base: lightPalette.foundation.black, disabled: lightPalette.gray[500] },
        focusShadow: '0 0 0 3px #cceeff',
      }),
      select: buildFieldStates({
        bg: { base: lightPalette.foundation.white, disabled: lightPalette.gray[100] },
        border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.gray[400] },
        text: { base: lightPalette.foundation.black, disabled: lightPalette.gray[500] },
      }),
      checkbox: buildFieldStates({
        bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[50], active: '#0066cc', disabled: lightPalette.gray[100] },
        border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.gray[400] },
        text: { base: '#0066cc', hover: '#0066cc', active: lightPalette.foundation.white, disabled: lightPalette.gray[500] },
      }),
      radio: buildFieldStates({
        bg: { base: lightPalette.foundation.white, hover: lightPalette.gray[50], active: lightPalette.foundation.white, disabled: lightPalette.gray[100] },
        border: { base: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: '#0066cc', disabled: lightPalette.gray[400] },
        text: { base: '#0066cc', hover: '#0066cc', active: '#0066cc', disabled: lightPalette.gray[500] },
      }),
      button: {
        primary: buildButtonStates({
          bg: { default: '#004499', hover: '#0066cc', active: '#002266', disabled: lightPalette.gray[400] },
          border: { default: '#002266', hover: '#004499', active: '#001133', disabled: lightPalette.gray[400] },
          text: { default: lightPalette.foundation.white, hover: lightPalette.foundation.white, active: lightPalette.foundation.white, disabled: lightPalette.gray[700] },
        }),
        secondary: buildButtonStates({
          bg: { default: lightPalette.foundation.white, hover: lightPalette.gray[100], active: lightPalette.gray[200], disabled: lightPalette.gray[100] },
          border: { default: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: lightPalette.foundation.black, disabled: lightPalette.gray[400] },
          text: { default: lightPalette.foundation.black, hover: lightPalette.foundation.black, active: lightPalette.foundation.black, disabled: lightPalette.gray[500] },
        }),
        tertiary: buildButtonStates({
          bg: { default: lightPalette.foundation.transparent, hover: '#cceeff', active: '#aaddff', disabled: lightPalette.foundation.transparent },
          border: { default: lightPalette.foundation.transparent, hover: lightPalette.foundation.transparent, active: lightPalette.foundation.transparent, disabled: lightPalette.foundation.transparent },
          text: { default: '#0066cc', hover: '#004499', active: '#002266', disabled: lightPalette.gray[500] },
        }),
        danger: buildButtonStates({
          bg: { default: '#cc0000', hover: '#aa0000', active: '#990000', disabled: lightPalette.gray[400] },
          border: { default: '#990000', hover: '#880000', active: '#660000', disabled: lightPalette.gray[400] },
          text: { default: lightPalette.foundation.white, hover: lightPalette.foundation.white, active: lightPalette.foundation.white, disabled: lightPalette.gray[700] },
        }),
      },
      label: lightPalette.foundation.black,
      helpText: lightPalette.gray[600],
      errorText: '#cc0000',
      successText: '#006600',
    },
  },
};
