# Theme System Documentation

## Overview

Sigilweaver now features a comprehensive theming system that replaces all hard-coded colors with semantic design tokens. The system supports multiple themes including Light, Dark, and High Contrast modes.

## Architecture

The theme system uses a hybrid approach combining:
- **CSS Custom Properties** for dynamic color values
- **Tailwind CSS Extensions** for utility classes
- **React Context** for theme state management
- **TypeScript** for type safety

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

1. Create a theme object in `src/themes/index.ts`:
```typescript
export const myCustomTheme: Theme = {
  id: 'custom',
  name: 'Custom Theme',
  description: 'My custom theme',
  colors: {
    // Define all color tokens...
  }
};
```

2. Add to the `availableThemes` array:
```typescript
export const availableThemes: Theme[] = [
  lightTheme,
  darkTheme,
  highContrastTheme,
  myCustomTheme, // Add here
];
```

### Modifying Existing Themes

Edit color values in the theme objects in `src/themes/index.ts`. All components will automatically reflect the changes.

## Migration Notes

The migration from hard-coded colors was completed systematically:

1. **Legacy Support**: Old color classes remain in Tailwind config for backwards compatibility
2. **CSS Variables**: All themes apply CSS custom properties to `:root`
3. **Component Updates**: All components migrated to use `theme-*` classes
4. **Tool Categories**: Preserved exact color values to maintain visual associations
5. **Accessibility**: High contrast theme ensures WCAG compliance

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
