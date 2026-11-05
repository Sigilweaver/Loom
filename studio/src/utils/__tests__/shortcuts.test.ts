import { describe, expect, it } from 'vitest';
import { SHORTCUT_GROUPS, formatShortcut, keyLabel } from '../shortcuts';

describe('shortcut labels', () => {
  it('resolves Mod and Alt per platform', () => {
    expect(formatShortcut(['Mod', 'Shift', 'S'], false)).toBe('Ctrl+Shift+S');
    expect(formatShortcut(['Mod', 'Shift', 'S'], true)).toBe('Cmd+Shift+S');
    expect(keyLabel('Alt', true)).toBe('Option');
    expect(keyLabel('F5', true)).toBe('F5');
  });

  it('lists each shortcut once per group', () => {
    for (const group of SHORTCUT_GROUPS) {
      const descriptions = group.shortcuts.map((s) => s.description);
      expect(new Set(descriptions).size).toBe(descriptions.length);
    }
  });
});
