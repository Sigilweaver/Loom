# Theme System Documentation

## Overview

Sigilweaver features a modular theming system with strict TypeScript types and simple helper builders for repeated interactive states. Themes live as separate files and are registered via a slim barrel. Supported themes include Light, Dark, High Contrast, and Sigilweaver.

## Architecture

The theme system uses a hybrid approach combining:
- Explicit, readable objects for brand/identity sections (headers, surfaces)
- Small, deterministic helper builders for repeated controls (inputs, selects, checkboxes, radios, buttons)
- Centralized color palettes shared across themes
- React Context for theme state management
- TypeScript interfaces for compile-time safety

Key files:
- `src/themes/light.ts`, `dark.ts`, `highContrast.ts`, `sigilweaver.ts` – one file per theme
- `src/themes/palettes.ts` – shared color scales
- `src/themes/tokens/builders.ts` – helper builders: `buildFieldStates`, `buildButtonStates`
- `src/themes/index.ts` – barrel exports + theme registry (`availableThemes`, `getThemeById`)

## Theme Structure

Each theme defines colors across these categories:

### Background Colors
- `bg-primary`: Main application background
- `bg-secondary`: Panel backgrounds
- `bg-tertiary`: Subtle backgrounds
- `bg-elevated`: Cards and elevated surfaces

### Text Colors
- `text-primary`: Main text content
- `text-secondary`: Secondary text
- `text-tertiary`: Tertiary/muted text
- `text-inverse`: Text on dark backgrounds
- `text-muted`: Very subtle text

### Tool Category Colors (Preserved for Visual Recognition)
- `tool-inout`: Green (#10b981 in light mode)
- `tool-preparation`: Blue (#3b82f6 in light mode)
- `tool-join`: Purple (#8b5cf6 in light mode)
- `tool-aggregate`: Orange (#f97316 in light mode)
- `tool-favorites`: Yellow (#eab308 in light mode)

### Interactive States
- `interactive-primary`: Primary buttons/actions
- `interactive-secondary`: Secondary buttons
- `interactive-accent`: Accent colors
- Each with hover/active variants

### Semantic Colors
- `error-*`: Error states (red)
- `warning-*`: Warning states (yellow)
- `success-*`: Success states (green)
- `info-*`: Info states (blue)

### Workflow-Specific Colors
- `workflow-canvas`: Canvas background
- `workflow-grid-*`: Grid colors
- `workflow-edge-*`: Connection line colors
- `workflow-node-*`: Node-specific colors

## Usage

### Using Theme Colors in Components

```tsx
// Use theme-aware Tailwind classes
<div className="bg-theme-bg-primary text-theme-text-primary">
  <button className="bg-theme-interactive-primary hover:bg-theme-interactive-primary-hover">
    Click me
  </button>
</div>

// For dynamic styles, use CSS custom properties
<div style={{ borderColor: 'var(--color-tool-inout)' }}>
  Tool with dynamic border
</div>
```

### Theme Switching

```tsx
import { useTheme } from '../contexts/ThemeContext';

function MyComponent() {
  const { currentTheme, setTheme, isDark } = useTheme();
  
  return (
    <button onClick={() => setTheme('dark')}>
      Switch to Dark Theme
    </button>
  );
}
```

### Theme Selector Component

The `ThemeSelector` component provides a dropdown for theme selection:

```tsx
import { ThemeSelector } from './components/ThemeSelector';

<ThemeSelector className="my-custom-class" />
```

## Available Themes

### 1. Light Theme (`light`)
- Clean, bright interface for daytime use
- High contrast for readability
- Standard tool category colors

### 2. Dark Theme (`dark`)
- Easy on the eyes for low-light environments
- Darker backgrounds with lighter text
- Brightened tool category colors for visibility

### 3. High Contrast (`high-contrast`)
- Maximum contrast for accessibility
- Black/white color scheme
- Simplified color palette for clarity

## Theme Persistence

Themes are automatically saved to `localStorage` with the key `sigilweaver-theme` and restored on application startup.

## Customization

### Adding a New Theme

1) Create a new file `src/themes/myCustom.ts` and export a `Theme`:

```ts
import type { Theme } from '../types/theme';
import { lightPalette } from './palettes';
import { buildFieldStates, buildButtonStates } from './tokens/builders';

export const myCustomTheme: Theme = {
  id: 'custom',
  name: 'Custom Theme',
  description: 'My custom theme',
  colors: {
    palette: lightPalette,
    // Prefer explicit for identities (header/surfaces)...
    // Use builders for repeated controls:
    forms: {
      input: buildFieldStates({
        bg: { base: lightPalette.foundation.white, disabled: lightPalette.gray[50] },
        border: { base: lightPalette.gray[300], hover: lightPalette.gray[400], active: lightPalette.brand.primary[500], disabled: lightPalette.gray[200] },
        text: { base: lightPalette.gray[900], disabled: lightPalette.gray[500] },
      }),
      select: /* ... */ undefined as any, // fill out per Theme types
      checkbox: /* ... */ undefined as any,
      radio: /* ... */ undefined as any,
      button: {
        primary: buildButtonStates({
          bg: { default: lightPalette.brand.primary[500], hover: lightPalette.brand.primary[600], active: lightPalette.brand.primary[700], disabled: lightPalette.gray[300] },
          border: { default: lightPalette.brand.primary[600], hover: lightPalette.brand.primary[700], active: lightPalette.brand.primary[800], disabled: lightPalette.gray[300] },
          text: { default: lightPalette.foundation.white, hover: lightPalette.foundation.white, active: lightPalette.foundation.white, disabled: lightPalette.gray[500] },
        }),
        secondary: /* ... */ undefined as any,
        tertiary: /* ... */ undefined as any,
        danger: /* ... */ undefined as any,
      },
      label: lightPalette.gray[700],
      helpText: lightPalette.gray[600],
      errorText: lightPalette.semantic.error[600],
      successText: lightPalette.semantic.success[600],
    },
    // ...complete the rest of ThemeColors shape
  },
};
```

2) Export it and register in `src/themes/index.ts`:

```ts
export * from './myCustom';
import { myCustomTheme } from './myCustom';
export const availableThemes = [
  // ...existing themes
  myCustomTheme,
];
```

### Modifying Existing Themes

Edit the respective theme file under `src/themes/*.ts`. All components will reflect changes via the ThemeContext.

## Helper Builders vs. Explicit Values

- Use explicit objects for identity-defining sections (headers, surfaces, key brand accents).
- Use builders for repeated interactive controls to stay DRY and consistent:
  - `buildFieldStates` for input/select/checkbox/radio and similar items
  - `buildButtonStates` for button variants
- The builders are simple and deterministic (no color math). Pass final tokens only.

## Migration Notes

- Palettes centralized in `palettes.ts`; themes consume them by reference.
- Minimal helper builders introduced to reduce repetition; sigilweaver/light/dark/high-contrast updated accordingly.
- Barrel `index.ts` now only re-exports and registers themes to avoid monolithic files.

## Performance

- Theme switching is instant (<100ms)
- CSS custom properties provide optimal performance
- No runtime color calculations
- Minimal bundle size impact

## Browser Support

The theme system works in all modern browsers that support:
- CSS Custom Properties (all modern browsers)
- ES6 Modules
- React 18+

## Future Enhancements

Potential future improvements:
- Theme builder UI
- System theme detection (light/dark mode)
- User-defined color overrides
- Component-specific theme variants
- Animated theme transitions

## Brand and header constants

Shared identity tokens live in `src/themes/tokens/constants.ts`:

- `HEADER_BACKGROUND`: unified header background used in light, dark, and sigilweaver.
- `BRAND_EDGE`: official brand for edges/wires and node selection borders/halo.
- Hover/animated brand variants for light/dark: `BRAND_EDGE_HOVER_LIGHT`, `BRAND_EDGE_HOVER_DARK`, `BRAND_EDGE_ANIMATED`, `BRAND_EDGE_ANIMATED_HOVER_LIGHT`, `BRAND_EDGE_ANIMATED_HOVER_DARK`.

High Contrast is intentionally excluded from these shared constants to preserve accessibility-specific contrast choices.

## Where constants are applied

- Header background (non-a11y themes) imports `HEADER_BACKGROUND`.
- Edges: `selected` and `animated` strokes use `BRAND_EDGE` and `BRAND_EDGE_ANIMATED`.
- Nodes: `selected.border` uses `BRAND_EDGE` and `selected.shadow` uses `BRAND_EDGE_ANIMATED` to render a subtle halo.
- Canvas minimap: viewport rectangle uses `BRAND_EDGE`.
- Node handle “connected” tint uses `BRAND_EDGE` for quick brand cohesion.

Tests enforce these applications in `src/themes/__tests__/theme.brand.constants.test.ts`.

## Focus-visible guidelines

To improve keyboard accessibility, a global focus outline is provided in `src/index.css`:

```
*:focus-visible {
  outline: 2px solid var(--color-border-focus, #a78bfa);
  outline-offset: 2px;
  border-radius: 4px;
}
```

The outline color defaults to the theme’s `borders.focus`, and falls back to the brand if missing. Tabs elevate their z-index when focused to avoid double borders with the tablist’s top rule.

## Edge state colors (hover/selected/animated)

Edge colors are driven by CSS variables declared by the active theme via `ThemeContext`. The runtime classes from React Flow receive CSS that maps states to variables in `src/index.css`:

- default: `--color-edge-default-stroke`
- default:hover: `--color-edge-default-stroke-hover`
- selected: `--color-edge-selected-stroke`
- selected:hover: `--color-edge-selected-stroke-hover`
- animated: `--color-edge-animated-stroke`
- animated:hover: `--color-edge-animated-stroke-hover`

This ensures hover/selection changes apply without inline style overrides.

## Do’s

- Use constants for shared brand/header identity.
- Prefer theme variables (via `ThemeContext`) over hardcoded colors in components.
- Keep High Contrast independent for maximum accessibility.

## Don’ts

- Don’t recalculate brand shades in components (no color math); use provided constants.
- Don’t hardcode colors for nodes/edges in JSX—use CSS variables.
