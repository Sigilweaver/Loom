/**
 * Simple page entry point
 * For pages that don't need full site functionality (error pages, legal pages)
 */

import '@styles/main.css';
import { initializeLayout } from '@lib/layout';
import { initializeAccessibility } from '@lib/accessibility';
import { initializeNavigation } from '@lib/navigation';
import { simpleNavConfig } from '@lib/config';
import { createIcons, Clipboard, Heart } from 'lucide';

// Initialize the page with simple navigation
document.addEventListener('DOMContentLoaded', () => {
  initializeLayout({
    header: { config: simpleNavConfig, showAccessibilityToggle: true },
    floatingElements: false, // No background animations for simple pages
  });

  initializeAccessibility();
  initializeNavigation();

  // Initialize icons (including Heart for footer)
  createIcons({
    icons: {
      Clipboard,
      Heart
    }
  });
});
