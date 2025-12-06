/**
 * Main entry point
 * Initializes the site with all shared functionality
 */

import '@styles/main.css';
import { initializeLayout } from '@lib/layout';
import { initializeAccessibility } from '@lib/accessibility';
import { initializeNavigation } from '@lib/navigation';
import { initializeScrollEffects, initializeHeroAnimations } from '@lib/scroll-effects';
import { initializeNodeConnections } from '@lib/node-connections';
import { createIcons, Shield, Check, Globe, Clipboard, AlertTriangle, BookOpen, Search, Sparkles, Lock, Lightbulb, Key, MessageSquare, UserCog, Moon, Settings, Brush, Coffee, Clock, Loader2, Zap, Wrench, Timer, Bomb, UserX, RefreshCw, FileText, Mail, Wand2, Menu, Heart, Target } from 'lucide';

// Export for use by page-specific scripts
export { initializeLayout } from '@lib/layout';
export { initializeAccessibility, toggleAccessibilityMode } from '@lib/accessibility';
export { initializeNavigation } from '@lib/navigation';
export { initializeScrollEffects, initializeHeroAnimations } from '@lib/scroll-effects';
export { initializeNodeConnections } from '@lib/node-connections';
export * from '@components/index';
export * from '@lib/config';

/**
 * Check if accessibility mode is enabled
 */
function isA11yMode(): boolean {
  return document.documentElement.classList.contains('a11y');
}

/**
 * Initialize all site functionality
 * Called on DOMContentLoaded
 */
export function initializeSite(): void {
  // Initialize layout components
  initializeLayout();
  
  // Initialize icons for static HTML
  createIcons({
    icons: {
      Shield, Check, Globe, Clipboard, AlertTriangle, BookOpen, Search, Sparkles, Lock, Lightbulb, Key, MessageSquare, UserCog, Moon, Settings, Brush, Coffee, Clock, Loader2, Zap, Wrench, Timer, Bomb, UserX, RefreshCw, FileText, Mail, Wand2, Menu, Heart, Target
    }
  });

  // Initialize accessibility preferences FIRST
  // This sets the a11y class before other initializations check it
  initializeAccessibility();
  
  // Initialize navigation
  initializeNavigation();
  
  // Only initialize animations/effects if NOT in a11y mode
  if (!isA11yMode()) {
    // Initialize scroll effects
    initializeScrollEffects();
    
    // Initialize hero animations if present
    if (document.querySelector('.hero')) {
      initializeHeroAnimations();
    }
    
    // Initialize node connections
    initializeNodeConnections();
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeSite);
