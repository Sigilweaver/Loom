/**
 * Contributing page entry point
 */

import '@styles/main.css';
import { initializeLayout } from '@lib/layout';
import { initializeAccessibility } from '@lib/accessibility';
import { initializeNavigation } from '@lib/navigation';
import { initializeScrollEffects } from '@lib/scroll-effects';
import { initializeNodeConnections } from '@lib/node-connections';
import { createIcons, Wand2, Sparkles, Scroll, Globe, BookOpen, Rocket, Heart } from 'lucide';

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializeLayout();
  initializeAccessibility();
  initializeNavigation();
  initializeScrollEffects();
  initializeNodeConnections();
  
  // Initialize icons
  createIcons({
    icons: {
      Wand2, Sparkles, Scroll, Globe, BookOpen, Rocket, Heart
    }
  });
});
