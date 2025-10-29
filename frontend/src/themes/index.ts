// Theme barrel & registry (cleaned)
import { Theme } from '../types/theme';

export * from './palettes';
export * from './light';
export * from './dark';
export * from './highContrast';
export * from './sigilweaver';

import { lightTheme } from './light';
import { darkTheme } from './dark';
import { highContrastTheme } from './highContrast';
import { sigilweaverTheme } from './sigilweaver';

export const availableThemes: Theme[] = [
  lightTheme,
  darkTheme,
  highContrastTheme,
  sigilweaverTheme,
];

export const getThemeById = (id: string): Theme =>
  availableThemes.find(t => t.id === id) || sigilweaverTheme;
