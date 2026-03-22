/**
 * Theme System Barrel Export
 * 
 * Central export point for all themes and utilities.
 * 
 * Folder Structure:
 *   themes/
 *     core/           - Built-in themes (sigilweaver-signature, dark, light, high-contrast)
 *     extended/       - Additional themes (nord, dracula, github, etc.)
 *     palettes/       - Color palettes for all themes
 *     tokens/         - Token builders and shared constants
 *     createTheme.ts  - Theme factory function
 *     index.ts        - This file
 */

import { Theme } from '../types/theme';

// Re-export palettes
export * from './palettes';

// Re-export core themes
export * from './core';

// Re-export extended themes
export * from './extended';

// Import core themes
import {
  sigilweaverTheme,
  darkTheme,
  lightTheme,
  highContrastTheme,
} from './core';

// Import extended themes
import {
  // Classics
  nordTheme,
  nordLightTheme,
  draculaTheme,
  githubDarkTheme,
  githubLightTheme,
  gruvboxDarkTheme,
  gruvboxLightTheme,
  solarizedDarkTheme,
  solarizedLightTheme,
  // Standards
  oneDarkTheme,
  oneLightTheme,
  monokaiTheme,
  materialPalenightTheme,
  // Hype
  catppuccinMochaTheme,
  catppuccinLatteTheme,
  tokyoNightTheme,
  tokyoNightLightTheme,
  rosePineTheme,
  rosePineDawnTheme,
  // Utility
  nightOwlTheme,
  ayuMirageTheme,
  // Fun
  cobalt2Theme,
  synthwave84Theme,
} from './extended';

/**
 * All available themes in display order
 * 
 * Organization:
 * 1. Core themes (Sigilweaver Signature, Dark, Light, High Contrast)
 * 2. Extended themes ordered by popularity
 */
export const availableThemes: Theme[] = [
  // === CORE ===
  sigilweaverTheme,
  darkTheme,
  lightTheme,
  highContrastTheme,
  
  // === EXTENDED (by popularity) ===
  draculaTheme,
  githubDarkTheme,
  githubLightTheme,
  oneDarkTheme,
  oneLightTheme,
  nordTheme,
  nordLightTheme,
  monokaiTheme,
  gruvboxDarkTheme,
  gruvboxLightTheme,
  catppuccinMochaTheme,
  catppuccinLatteTheme,
  tokyoNightTheme,
  tokyoNightLightTheme,
  solarizedDarkTheme,
  solarizedLightTheme,
  materialPalenightTheme,
  rosePineTheme,
  rosePineDawnTheme,
  nightOwlTheme,
  ayuMirageTheme,
  cobalt2Theme,
  synthwave84Theme,
];

/**
 * Get a theme by ID, falling back to Sigilweaver Signature theme
 */
export const getThemeById = (id: string): Theme =>
  availableThemes.find(t => t.id === id) || sigilweaverTheme;
