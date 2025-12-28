import { describe, it, expect } from 'vitest';
import { availableThemes } from '../index';
import type { Theme } from '../../types/theme';

// Minimal structural integrity checks to catch accidental shape drift.
describe('Theme integrity', () => {
  it('exports at least one theme', () => {
    expect(availableThemes.length).toBeGreaterThan(0);
  });

  for (const theme of availableThemes as Theme[]) {
    describe(`${theme.id} shape`, () => {
      it('has required top-level sections', () => {
        expect(theme.colors).toBeDefined();
        expect(theme.colors.surfaces).toBeDefined();
        expect(theme.colors.text).toBeDefined();
        expect(theme.colors.borders).toBeDefined();
        expect(theme.colors.header).toBeDefined();
        expect(theme.colors.configPanel).toBeDefined();
        expect(theme.colors.toolPalette).toBeDefined();
        expect(theme.colors.canvas).toBeDefined();
        expect(theme.colors.nodes).toBeDefined();
        expect(theme.colors.edges).toBeDefined();
        expect(theme.colors.modals).toBeDefined();
        expect(theme.colors.notifications).toBeDefined();
        expect(theme.colors.syntax).toBeDefined();
        expect(theme.colors.forms).toBeDefined();
      });

      it('has interactive states for common controls', () => {
        const { forms, toolPalette, canvas, header } = theme.colors;
        // Forms
        for (const key of ['input', 'select', 'checkbox', 'radio'] as const) {
          const ctl = forms[key];
          expect(ctl.default).toBeDefined();
          expect(ctl.hover).toBeDefined();
          expect(ctl.active).toBeDefined();
          expect(ctl.disabled).toBeDefined();
        }
        // Buttons
        for (const variant of ['primary', 'secondary', 'tertiary', 'danger'] as const) {
          const btn = forms.button[variant];
          expect(btn.default).toBeDefined();
          expect(btn.hover).toBeDefined();
          expect(btn.active).toBeDefined();
          expect(btn.disabled).toBeDefined();
        }
        // Tool palette search input
        expect(toolPalette.search.input.default).toBeDefined();
        // Canvas control button
        expect(canvas.controls.button.default).toBeDefined();
        // Header theme selector trigger
        expect(header.themeSelector.trigger.default).toBeDefined();
      });
    });
  }
});
