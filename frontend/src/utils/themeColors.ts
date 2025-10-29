// Utility to get current theme colors from CSS custom properties
export function getThemeColor(cssVariableName: string): string {
  if (typeof window !== 'undefined') {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVariableName)
      .trim();
    
    if (value) {
      return value;
    }
  }
  
  // Fallback colors if CSS variables aren't available
  const fallbacks: Record<string, string> = {
    '--color-edge-default-stroke': '#6b7280',
    '--color-edge-invalid-stroke': '#dc2626',
    '--color-edge-selected-stroke': '#3b82f6',
  };
  
  return fallbacks[cssVariableName] || '#6b7280';
}
