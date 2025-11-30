/**
 * Contributing page entry point
 */

import '@styles/main.css';
import { initializeLayout } from '@lib/layout';
import { initializeAccessibility } from '@lib/accessibility';
import { initializeNavigation } from '@lib/navigation';
import { initializeScrollEffects } from '@lib/scroll-effects';
import { initializeNodeConnections } from '@lib/node-connections';

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializeLayout();
  initializeAccessibility();
  initializeNavigation();
  initializeScrollEffects();
  initializeNodeConnections();
});
