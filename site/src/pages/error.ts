/**
 * Error page entry point
 * For error pages (403, 404, 418, 500, 502, 503)
 * These pages don't have header/footer, just styles and accessibility
 */

import '@styles/main.css';
import { initializeAccessibility } from '@lib/accessibility';

// Initialize just the accessibility features for error pages
document.addEventListener('DOMContentLoaded', () => {
  initializeAccessibility();
});
