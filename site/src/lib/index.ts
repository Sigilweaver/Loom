/**
 * Library exports
 */

export { initializeLayout, getBodyClasses, type LayoutOptions } from './layout';
export { 
  initializeAccessibility,
  setAccessibilityMode,
  toggleAccessibilityMode,
  // Legacy
  initializeAccessibilityMode,
  initializeAnimationPreference,
  toggleAccessibility,
  toggleAnimations,
  setAccessibility,
} from './accessibility';
export { initializeNavigation, toggleMobileMenu, closeMobileMenu } from './navigation';
export { initializeScrollEffects, initializeHeroAnimations } from './scroll-effects';
export { initializeNodeConnections } from './node-connections';
export { navConfig, simpleNavConfig, type NavConfig, type NavLink } from './config';
